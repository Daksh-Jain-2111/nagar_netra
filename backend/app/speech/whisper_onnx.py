"""
Whisper speech recognition on ONNX Runtime (numpy only, no torch).

Runs the encoder/decoder ONNX export published by the k2-fsa/sherpa-onnx project
(github.com/k2-fsa/sherpa-onnx/releases, tag `asr-models`, e.g. sherpa-onnx-whisper-small).
Decoding is implemented here (greedy, no timestamps) because Whisper's byte-level BPE splits
Devanagari characters across tokens: tokens must be joined as bytes before UTF-8 decoding,
otherwise Marathi/Hindi text loses characters.
"""
import base64
import threading
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np

SAMPLE_RATE = 16000
N_FFT = 400
HOP_LENGTH = 160
CHUNK_SECONDS = 30
N_SAMPLES = CHUNK_SECONDS * SAMPLE_RATE      # 480000 samples -> 3000 frames
MAX_NEW_TOKENS = 220


def _hz_to_mel(f):
    f = np.asanyarray(f, dtype=np.float64)
    f_sp = 200.0 / 3
    mels = f / f_sp
    min_log_hz, min_log_mel, logstep = 1000.0, 1000.0 / f_sp, np.log(6.4) / 27.0
    return np.where(f >= min_log_hz, min_log_mel + np.log(np.maximum(f, 1e-10) / min_log_hz) / logstep, mels)


def _mel_to_hz(m):
    m = np.asanyarray(m, dtype=np.float64)
    f_sp = 200.0 / 3
    freqs = f_sp * m
    min_log_hz, min_log_mel, logstep = 1000.0, 1000.0 / f_sp, np.log(6.4) / 27.0
    return np.where(m >= min_log_mel, min_log_hz * np.exp(logstep * (m - min_log_mel)), freqs)


def mel_filterbank(n_mels: int, sr: int = SAMPLE_RATE, n_fft: int = N_FFT) -> np.ndarray:
    """Slaney-style mel filterbank (identical to librosa.filters.mel defaults used by Whisper)."""
    fft_freqs = np.linspace(0, sr / 2, 1 + n_fft // 2)
    mel_pts = _mel_to_hz(np.linspace(_hz_to_mel(0.0), _hz_to_mel(sr / 2), n_mels + 2))
    fdiff = np.diff(mel_pts)
    ramps = mel_pts[:, None] - fft_freqs[None, :]
    weights = np.zeros((n_mels, len(fft_freqs)))
    for i in range(n_mels):
        lower = -ramps[i] / fdiff[i]
        upper = ramps[i + 2] / fdiff[i + 1]
        weights[i] = np.maximum(0, np.minimum(lower, upper))
    enorm = 2.0 / (mel_pts[2: n_mels + 2] - mel_pts[:n_mels])
    weights *= enorm[:, None]
    return weights.astype(np.float32)


def log_mel_spectrogram(audio: np.ndarray, filters: np.ndarray) -> np.ndarray:
    """Whisper log-mel features for one 30 s chunk -> (n_mels, 3000)."""
    audio = np.pad(audio.astype(np.float32), (0, max(0, N_SAMPLES - len(audio))))[:N_SAMPLES]
    padded = np.pad(audio, (N_FFT // 2, N_FFT // 2), mode="reflect")
    window = (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(N_FFT) / N_FFT)).astype(np.float32)  # periodic Hann
    n_frames = 1 + (len(padded) - N_FFT) // HOP_LENGTH
    idx = np.arange(N_FFT)[None, :] + HOP_LENGTH * np.arange(n_frames)[:, None]
    frames = padded[idx] * window
    magnitudes = np.abs(np.fft.rfft(frames, axis=1)) ** 2          # (frames, 201)
    magnitudes = magnitudes[:-1]                                     # drop last frame -> 3000
    mel = filters @ magnitudes.T                                     # (n_mels, 3000)
    log_spec = np.log10(np.maximum(mel, 1e-10))
    log_spec = np.maximum(log_spec, log_spec.max() - 8.0)
    return ((log_spec + 4.0) / 4.0).astype(np.float32)


class WhisperOnnx:
    def __init__(self, encoder_path: Path, decoder_path: Path, tokens_path: Path, intra_op_threads: int = 0):
        import onnxruntime as ort

        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        if intra_op_threads > 0:
            opts.intra_op_num_threads = intra_op_threads
        self.encoder = ort.InferenceSession(str(encoder_path), sess_options=opts, providers=["CPUExecutionProvider"])
        self.decoder = ort.InferenceSession(str(decoder_path), sess_options=opts, providers=["CPUExecutionProvider"])
        meta = self.encoder.get_modelmeta().custom_metadata_map
        self.model_type = meta.get("model_type", "whisper")
        self.n_mels = int(meta["n_mels"])
        self.n_text_layer = int(meta["n_text_layer"])
        self.n_text_ctx = int(meta["n_text_ctx"])
        self.n_text_state = int(meta["n_text_state"])
        self.sot = int(meta["sot"])
        self.eot = int(meta["eot"])
        self.transcribe_token = int(meta["transcribe"])
        self.no_timestamps = int(meta["no_timestamps"])
        self.blank = int(meta.get("blank_id", 220))
        codes = meta["all_language_codes"].split(",")
        tokens = [int(t) for t in meta["all_language_tokens"].split(",")]
        self.lang_tokens: Dict[str, int] = dict(zip(codes, tokens))
        self.filters = mel_filterbank(self.n_mels)
        self.token_bytes: Dict[int, bytes] = {}
        with open(tokens_path, "r", encoding="utf-8") as fh:
            for line in fh:
                parts = line.strip().split()
                if len(parts) == 2:
                    self.token_bytes[int(parts[1])] = base64.b64decode(parts[0])
        self._lock = threading.Lock()

    def supports_language(self, code: str) -> bool:
        return code in self.lang_tokens

    def _decode_chunk(self, mel: np.ndarray, language: Optional[str]) -> List[int]:
        cross_k, cross_v = self.encoder.run(None, {"mel": mel[None, ...]})
        shape = (self.n_text_layer, 1, self.n_text_ctx, self.n_text_state)
        self_k = np.zeros(shape, dtype=np.float32)
        self_v = np.zeros(shape, dtype=np.float32)
        prompt = [self.sot]
        if language and language in self.lang_tokens:
            prompt.append(self.lang_tokens[language])
        prompt += [self.transcribe_token, self.no_timestamps]

        tokens = np.array([prompt], dtype=np.int64)
        offset = 0
        out: List[int] = []
        for step in range(MAX_NEW_TOKENS):
            logits, self_k, self_v = self.decoder.run(None, {
                "tokens": tokens, "in_n_layer_self_k_cache": self_k, "in_n_layer_self_v_cache": self_v,
                "n_layer_cross_k": cross_k, "n_layer_cross_v": cross_v,
                "offset": np.array([offset], dtype=np.int64),
            })
            offset += tokens.shape[1]
            last = logits[0, -1].astype(np.float32)
            last[self.eot + 1:] = -np.inf                     # never emit special tokens as text
            if step == 0:
                last[self.blank] = -np.inf
                last[self.eot] = -np.inf
            token = int(np.argmax(last))
            if token == self.eot or offset >= self.n_text_ctx - 1:
                break
            out.append(token)
            # stop degenerate loops (same 1-4 token pattern repeated many times)
            if len(out) > 24 and any(out[-k:] * 6 == out[-6 * k:] for k in (1, 2, 3, 4)):
                break
            tokens = np.array([[token]], dtype=np.int64)
        return out

    def detect_language(self, audio_16k: np.ndarray, candidates=None) -> Optional[str]:
        """Most likely language among `candidates` (all Whisper languages if None)."""
        mel = log_mel_spectrogram(audio_16k[:N_SAMPLES], self.filters)
        with self._lock:
            cross_k, cross_v = self.encoder.run(None, {"mel": mel[None, ...]})
            shape = (self.n_text_layer, 1, self.n_text_ctx, self.n_text_state)
            logits, _, _ = self.decoder.run(None, {
                "tokens": np.array([[self.sot]], dtype=np.int64),
                "in_n_layer_self_k_cache": np.zeros(shape, dtype=np.float32),
                "in_n_layer_self_v_cache": np.zeros(shape, dtype=np.float32),
                "n_layer_cross_k": cross_k, "n_layer_cross_v": cross_v,
                "offset": np.array([0], dtype=np.int64),
            })
        codes = [c for c in (candidates or self.lang_tokens) if c in self.lang_tokens]
        if not codes:
            return None
        last = logits[0, -1]
        return max(codes, key=lambda c: last[self.lang_tokens[c]])

    def transcribe(self, audio_16k: np.ndarray, language: Optional[str]) -> str:
        texts = []
        with self._lock:
            for start in range(0, max(1, len(audio_16k)), N_SAMPLES):
                chunk = audio_16k[start:start + N_SAMPLES]
                if len(chunk) < SAMPLE_RATE * 0.3:
                    continue
                mel = log_mel_spectrogram(chunk, self.filters)
                ids = self._decode_chunk(mel, language)
                raw = b"".join(self.token_bytes.get(i, b"") for i in ids)
                texts.append(raw.decode("utf-8", errors="ignore").strip())
        return " ".join(t for t in texts if t).strip()
