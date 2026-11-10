"""
Download the offline speech-to-text model (OpenAI Whisper, ONNX export by k2-fsa/sherpa-onnx).

    python backend/scripts/download_speech_model.py            # whisper turbo (default, best for Marathi/Hindi)
    python backend/scripts/download_speech_model.py --model small   # smaller/faster, lower accuracy

Downloads from the project's GitHub release, verifies SHA-256 and extracts only the int8 encoder,
decoder and tokens into backend/ml_models/whisper-<model>/. Re-running resumes/skips completed work.
Set STT_MODEL_DIR in backend/.env if you use --model small.
"""
import argparse
import hashlib
import shutil
import sys
import tarfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RELEASE = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models"
MODELS = {
    "turbo": ("sherpa-onnx-whisper-turbo.tar.bz2",
              "b11acbbcd660b44a8e0df33724feb5aaa709cf65668f2823d59f656312544f22"),
    "small": ("sherpa-onnx-whisper-small.tar.bz2",
              "486a46afbb7ba798507190ffe02fea2dd726049af212e774537efac6afb210a6"),
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(8 * 1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, target: Path) -> None:
    tmp = target.with_suffix(target.suffix + ".part")
    have = tmp.stat().st_size if tmp.exists() else 0
    req = urllib.request.Request(url, headers={"Range": f"bytes={have}-"} if have else {})
    with urllib.request.urlopen(req) as resp:
        total = int(resp.headers.get("Content-Length", 0)) + have
        mode = "ab" if have and resp.status == 206 else "wb"
        done = have if mode == "ab" else 0
        with open(tmp, mode) as out:
            while True:
                chunk = resp.read(4 * 1024 * 1024)
                if not chunk:
                    break
                out.write(chunk)
                done += len(chunk)
                if total:
                    sys.stdout.write(f"\r  {done / 1e6:7.1f} / {total / 1e6:.1f} MB")
                    sys.stdout.flush()
    print()
    tmp.replace(target)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=sorted(MODELS), default="turbo")
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    archive_name, expected = MODELS[args.model]
    out_dir = args.out or ROOT / "backend" / "ml_models" / f"whisper-{args.model}"
    wanted = [f"{args.model}-encoder.int8.onnx", f"{args.model}-decoder.int8.onnx", f"{args.model}-tokens.txt"]
    if all((out_dir / name).is_file() for name in wanted):
        print(f"Speech model already installed in {out_dir}")
        return

    cache = ROOT / "backend" / "ml_models" / ".cache"
    cache.mkdir(parents=True, exist_ok=True)
    archive = cache / archive_name
    if not archive.is_file():
        print(f"Downloading {RELEASE}/{archive_name}")
        download(f"{RELEASE}/{archive_name}", archive)
    print("Verifying checksum...")
    if sha256(archive) != expected:
        archive.unlink()
        raise SystemExit("Checksum mismatch - archive deleted, please re-run.")

    out_dir.mkdir(parents=True, exist_ok=True)
    print(f"Extracting {', '.join(wanted)} -> {out_dir}")
    with tarfile.open(archive, "r:bz2") as tar:
        for member in tar.getmembers():
            name = Path(member.name).name
            if name in wanted and member.isfile():
                src = tar.extractfile(member)
                with open(out_dir / name, "wb") as dst:
                    shutil.copyfileobj(src, dst)
    missing = [n for n in wanted if not (out_dir / n).is_file()]
    if missing:
        raise SystemExit(f"Archive did not contain: {missing}")
    archive.unlink()
    print("Done. Restart the backend to load the speech model.")


if __name__ == "__main__":
    main()
