import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Real microphone recording.
 *  1. MediaRecorder (Chrome, Edge, Firefox, Safari 14.1+): audio/webm;codecs=opus or audio/mp4.
 *  2. Fallback for browsers without MediaRecorder (older Safari / in-app WebViews): Web Audio capture
 *     encoded to a 16 kHz PCM WAV file in the browser.
 * Microphone access only works on secure pages (https:// or http://localhost).
 */
export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'recorded' | 'error';
export type RecorderError =
  | 'permission_denied' | 'no_microphone' | 'unsupported' | 'insecure_context' | 'recording_failed' | 'empty_recording';

const PREFERRED_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
const MIN_SECONDS = 0.7;
const WAV_RATE = 16000;

type GetUserMedia = (c: MediaStreamConstraints) => Promise<MediaStream>;

function resolveGetUserMedia(): GetUserMedia | null {
  if (typeof navigator === 'undefined') return null;
  if (navigator.mediaDevices?.getUserMedia) return c => navigator.mediaDevices.getUserMedia(c);
  const legacy = (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia;
  if (legacy) return c => new Promise((resolve, reject) => legacy.call(navigator, c, resolve, reject));
  return null;
}

/** Why recording cannot start in this browser/page, or null if it can. */
export function recordingBlocker(): RecorderError | null {
  if (typeof window === 'undefined') return 'unsupported';
  if (!resolveGetUserMedia()) return window.isSecureContext === false ? 'insecure_context' : 'unsupported';
  const hasMediaRecorder = typeof (window as any).MediaRecorder !== 'undefined';
  const hasAudioContext = !!((window as any).AudioContext || (window as any).webkitAudioContext);
  return hasMediaRecorder || hasAudioContext ? null : 'unsupported';
}

function pickMimeType(): string | undefined {
  const MR: any = (window as any).MediaRecorder;
  return PREFERRED_TYPES.find(t => MR?.isTypeSupported?.(t));
}

function encodeWav(chunks: Float32Array[], inputRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let off = 0;
  for (const c of chunks) { merged.set(c, off); off += c.length; }
  const ratio = inputRate / WAV_RATE;
  const outLen = Math.max(0, Math.floor(total / ratio));
  const pcm = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    // simple averaging decimation (anti-aliasing) from inputRate to 16 kHz
    const start = Math.floor(i * ratio);
    const end = Math.min(total, Math.floor((i + 1) * ratio)) || start + 1;
    let sum = 0;
    for (let j = start; j < end; j++) sum += merged[j];
    const v = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
    pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); writeStr(8, 'WAVE');
  writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, WAV_RATE, true); view.setUint32(28, WAV_RATE * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  writeStr(36, 'data'); view.setUint32(40, pcm.length * 2, true);
  new Int16Array(buffer, 44).set(pcm);
  return new Blob([buffer], { type: 'audio/wav' });
}

export function useVoiceRecorder(maxSeconds = 60) {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<RecorderError | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [level, setLevel] = useState(0); // live microphone input level 0..1 (from the real signal)

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const pcmRef = useRef<Float32Array[]>([]);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const modeRef = useRef<'media' | 'wav'>('media');
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const durationRef = useRef(0);

  const cleanupStream = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timerRef.current = null;
    rafRef.current = null;
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const finish = useCallback((recorded: Blob) => {
    durationRef.current = (performance.now() - startedAtRef.current) / 1000;
    cleanupStream();
    if (recorded.size === 0 || durationRef.current < MIN_SECONDS) {
      setStatus('error');
      setError('empty_recording');
      return;
    }
    setBlob(recorded);
    setBlobUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(recorded);
    });
    setElapsed(Math.round(durationRef.current));
    setStatus('recorded');
  }, [cleanupStream]);

  const stop = useCallback(() => {
    if (modeRef.current === 'wav') {
      if (processorRef.current && audioCtxRef.current) {
        const rate = audioCtxRef.current.sampleRate;
        finish(encodeWav(pcmRef.current, rate));
      }
      return;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, [finish]);

  const start = useCallback(async () => {
    setError(null);
    const blocker = recordingBlocker();
    if (blocker) {
      setStatus('error');
      setError(blocker);
      return;
    }
    setStatus('requesting');
    let stream: MediaStream;
    try {
      stream = await resolveGetUserMedia()!({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err: any) {
      setStatus('error');
      setError(err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError' || err?.name === 'SecurityError'
        ? 'permission_denied'
        : err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError' || err?.name === 'NotReadableError'
          ? 'no_microphone' : 'recording_failed');
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    pcmRef.current = [];

    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      ctx = new Ctx() as AudioContext;
      if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
      audioCtxRef.current = ctx;
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
    } catch { /* level meter / WAV fallback unavailable */ }

    const hasMediaRecorder = typeof (window as any).MediaRecorder !== 'undefined';
    if (hasMediaRecorder) {
      modeRef.current = 'media';
      const mimeType = pickMimeType();
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined);
      } catch {
        try { recorder = new MediaRecorder(stream); } catch {
          cleanupStream(); setStatus('error'); setError('unsupported'); return;
        }
      }
      recorderRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onerror = () => { cleanupStream(); setStatus('error'); setError('recording_failed'); };
      recorder.onstop = () => finish(new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' }));
      recorder.start(250);
    } else if (ctx) {
      // Web Audio -> WAV fallback
      modeRef.current = 'wav';
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = e => pcmRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      ctx.createMediaStreamSource(stream).connect(processor);
      processor.connect(ctx.destination);
      processorRef.current = processor;
    } else {
      cleanupStream(); setStatus('error'); setError('unsupported'); return;
    }

    if (analyser) {
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser!.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    }

    startedAtRef.current = performance.now();
    setElapsed(0);
    setStatus('recording');
    timerRef.current = window.setInterval(() => {
      const secs = (performance.now() - startedAtRef.current) / 1000;
      setElapsed(Math.floor(secs));
      if (secs >= maxSeconds) stop();
    }, 250);
  }, [cleanupStream, finish, maxSeconds, stop]);

  const reset = useCallback(() => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') { rec.onstop = null; rec.stop(); }
    cleanupStream();
    setBlob(null);
    setBlobUrl(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setElapsed(0);
    setError(null);
    setStatus('idle');
  }, [cleanupStream]);

  /** Use an existing audio file (phone recorder app / file picker) instead of the live microphone. */
  const loadFile = useCallback((file: File, durationSeconds: number) => {
    reset();
    durationRef.current = durationSeconds;
    setBlob(file);
    setBlobUrl(URL.createObjectURL(file));
    setElapsed(Math.round(durationSeconds));
    setStatus('recorded');
  }, [reset]);

  useEffect(() => () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      rec.stop();
    }
    cleanupStream();
  }, [cleanupStream]);

  return {
    status, error, elapsed, blob, blobUrl, level,
    durationSeconds: durationRef.current,
    mimeType: blob?.type || '',
    start, stop, reset, loadFile,
  };
}

export const formatClock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
