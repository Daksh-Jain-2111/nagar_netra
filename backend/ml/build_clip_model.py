"""
Build the zero-shot CLIP civic issue model artifact used by the `clip_zero_shot` provider.

    pip install -r backend/ml/requirements-build.txt
    python -m backend.ml.build_clip_model                      # from the project root

Steps:
  1. Download OpenCLIP ViT-B/16 (LAION-400M, epoch 32) weights from the official open_clip GitHub
     release (checksum verified).
  2. Export the image encoder to ONNX and quantize it to int8 (dynamic quantization).
  3. Embed the per-issue prompts (backend/ml/clip_prompts.json) with the CLIP text encoder and
     average them into one embedding per issue code -> class_embeddings.npy.
  4. Write manifest.json (labels, preprocessing, logit scale, SHA-256 of every file) and optionally
     split large files into parts for transfer.

Runtime needs only onnxruntime + numpy + Pillow; torch/open_clip are build-time dependencies.
"""
import argparse
import datetime
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.app.rules.issue_mapping_rules import load_taxonomy  # noqa: E402

MODEL_ARCH = "ViT-B-16"
PRETRAINED_TAG = "laion400m_e32"
WEIGHTS_URL = ("https://github.com/mlfoundations/open_clip/releases/download/"
               "v0.2-weights/vit_b_16-laion400m_e32-55e67d44.pt")
WEIGHTS_SHA256_PREFIX = "55e67d44"   # open_clip encodes the sha256 prefix in the file name
PROMPTS_PATH = Path(__file__).resolve().parent / "clip_prompts.json"
DEFAULT_OUT = ROOT / "backend" / "ml_models" / "clip-vit-b16-laion400m"
CACHE_DIR = ROOT / "backend" / "ml_models" / ".cache"
OPENAI_MEAN = [0.48145466, 0.4578275, 0.40821073]
OPENAI_STD = [0.26862954, 0.26130258, 0.27577711]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(4 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch_weights(weights_path: Path = None) -> Path:
    if weights_path:
        return weights_path
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    target = CACHE_DIR / WEIGHTS_URL.rsplit("/", 1)[-1]
    if not target.is_file():
        print(f"Downloading {WEIGHTS_URL} ...")
        tmp = target.with_suffix(".part")
        urllib.request.urlretrieve(WEIGHTS_URL, tmp)
        tmp.replace(target)
    digest = sha256_file(target)
    if not digest.startswith(WEIGHTS_SHA256_PREFIX):
        raise SystemExit(f"Checksum mismatch for {target.name}: {digest[:8]} != {WEIGHTS_SHA256_PREFIX}")
    return target


def load_prompts(taxonomy_codes):
    prompts = json.loads(PROMPTS_PATH.read_text(encoding="utf-8"))["prompts"]
    unknown = sorted(set(prompts) - set(taxonomy_codes))
    missing = sorted(set(taxonomy_codes) - set(prompts))
    if unknown:
        raise SystemExit(f"Prompts defined for codes not in the taxonomy: {unknown}")
    if missing:
        raise SystemExit(f"Taxonomy codes without prompts: {missing}")
    return {code: prompts[code] for code in taxonomy_codes}


def split_file(path: Path, part_mb: int):
    size = part_mb * 1024 * 1024
    parts = []
    with open(path, "rb") as fh:
        idx = 0
        while True:
            chunk = fh.read(size)
            if not chunk:
                break
            part = path.with_name(f"{path.name}.part-{idx:03d}")
            part.write_bytes(chunk)
            parts.append(part.name)
            idx += 1
    return parts


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--weights", type=Path, default=None, help="Local open_clip .pt file (skip download)")
    parser.add_argument("--no-quantize", action="store_true", help="Keep the fp32 encoder (~4x larger)")
    parser.add_argument("--split-mb", type=int, default=0,
                        help="Also split the encoder into N-MB parts and keep only the parts")
    args = parser.parse_args()

    import torch
    import open_clip
    import onnxruntime as ort

    taxonomy = load_taxonomy()
    labels = taxonomy.codes
    prompts = load_prompts(labels)
    out = args.out
    out.mkdir(parents=True, exist_ok=True)

    weights = fetch_weights(args.weights)
    model, _, preprocess = open_clip.create_model_and_transforms(MODEL_ARCH, pretrained=str(weights))
    model.eval()
    tokenizer = open_clip.get_tokenizer(MODEL_ARCH)

    # --- class embeddings -----------------------------------------------------------------
    # Issue classes: mean of their prompt embeddings (prompt ensembling) -> one row each.
    # Reject classes: one row per prompt (distinct "not a civic issue" concepts); at runtime a
    # label's score is the max over its rows.
    rows, row_labels = [], []
    with torch.no_grad():
        for label_idx, code in enumerate(labels):
            tokens = tokenizer(prompts[code])
            emb = model.encode_text(tokens).float()
            emb = emb / emb.norm(dim=-1, keepdim=True)
            if taxonomy.get(code).is_reject:
                for vec in emb:
                    rows.append(vec.numpy())
                    row_labels.append(label_idx)
            else:
                mean = emb.mean(dim=0)
                rows.append((mean / mean.norm()).numpy())
                row_labels.append(label_idx)
        logit_scale = float(model.logit_scale.exp().item())
    class_embs = np.stack(rows).astype(np.float32)
    emb_path = out / "class_embeddings.npy"
    np.save(emb_path, class_embs)

    # --- image encoder -> ONNX -------------------------------------------------------------
    class ImageEncoder(torch.nn.Module):
        def __init__(self, clip_model):
            super().__init__()
            self.clip = clip_model

        def forward(self, pixel_values):
            return self.clip.encode_image(pixel_values)

    image_size = model.visual.image_size
    image_size = image_size[0] if isinstance(image_size, (tuple, list)) else int(image_size)
    fp32_path = out / "vision_encoder.fp32.onnx"
    dummy = torch.randn(2, 3, image_size, image_size)
    torch.onnx.export(
        ImageEncoder(model), (dummy,), str(fp32_path),
        input_names=["pixel_values"], output_names=["image_embeds"],
        dynamic_axes={"pixel_values": {0: "batch"}, "image_embeds": {0: "batch"}},
        opset_version=17, dynamo=False,
    )

    encoder_path = fp32_path
    if not args.no_quantize:
        from onnxruntime.quantization import QuantType, quantize_dynamic
        encoder_path = out / "vision_encoder.int8.onnx"
        # Only MatMul/Gemm are quantized: ConvInteger with int8 weights is not implemented in many
        # onnxruntime CPU builds, so the patch-embedding Conv stays fp32.
        quantize_dynamic(str(fp32_path), str(encoder_path), weight_type=QuantType.QInt8, per_channel=True,
                         op_types_to_quantize=["MatMul", "Gemm"])
        fp32_path.unlink()

    # --- parity check vs. PyTorch -----------------------------------------------------------
    with torch.no_grad():
        ref = model.encode_image(dummy).numpy()
    sess = ort.InferenceSession(str(encoder_path), providers=["CPUExecutionProvider"])
    got = sess.run(["image_embeds"], {"pixel_values": dummy.numpy()})[0]
    cos = (ref * got).sum(1) / (np.linalg.norm(ref, axis=1) * np.linalg.norm(got, axis=1))
    print(f"ONNX vs PyTorch embedding cosine similarity: {cos.round(4).tolist()}")
    if cos.min() < 0.98:
        raise SystemExit("ONNX export parity check failed (cosine < 0.98)")

    encoder_entry = {"path": encoder_path.name, "sha256": sha256_file(encoder_path)}
    if args.split_mb:
        encoder_entry["parts"] = split_file(encoder_path, args.split_mb)
        encoder_path.unlink()

    prompts_digest = hashlib.sha256(json.dumps(prompts, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    manifest = {
        "format_version": 1,
        "provider": "clip_zero_shot",
        "model_id": f"open_clip/{MODEL_ARCH}/{PRETRAINED_TAG}",
        "artifact_version": f"{taxonomy.version}-{'fp32' if args.no_quantize else 'int8'}",
        "description": "Zero-shot CLIP baseline (not fine-tuned on civic complaint photos).",
        "labels": labels,
        "embedding_labels": row_labels,
        "image_size": image_size,
        "mean": OPENAI_MEAN,
        "std": OPENAI_STD,
        "interpolation": "bicubic",
        "clip": {
            "logit_scale": round(logit_scale, 4),
            "embedding_dim": int(class_embs.shape[1]),
            "input_name": "pixel_values",
            "output_name": "image_embeds",
        },
        "files": {
            "vision_encoder": encoder_entry,
            "class_embeddings": {"path": emb_path.name, "sha256": sha256_file(emb_path)},
        },
        "build": {
            "built_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "weights_url": WEIGHTS_URL,
            "taxonomy_version": taxonomy.version,
            "prompts_sha256": prompts_digest,
            "torch": torch.__version__,
            "open_clip": open_clip.__version__,
        },
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Model artifact written to {out}")


if __name__ == "__main__":
    main()
