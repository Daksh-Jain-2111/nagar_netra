# Model artifacts (not tracked by git)

`clip-vit-b16-laion400m/` contains the following files:

* `manifest.json` lists the labels, preprocessing settings and SHA-256 checksums.
* `class_embeddings.npy` holds the issue text embeddings.
* `vision_encoder.int8.onnx` is the image encoder. It may also arrive as numbered `.part-NNN` files,
  which the API joins back together and verifies on first load.

To recreate the artifacts, run `python -m backend.ml.build_clip_model`. Details are in `backend/ml/README.md`.
