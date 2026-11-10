# NagarNetra Vision AI – civic issue image classifier

```
photo(s) ──► ML model (backend/app/ml)          ──► P(issue code) per photo
         ──► aggregation (mean probability)      ──► Top-3 issue codes + confidence
         ──► rules (backend/app/rules)           ──► issue → category  (civic_issue_taxonomy.json)
         ──► category master (DB)                ──► department + SLA (categories / departments tables)
```

The model never predicts departments or SLAs. Changing a department, an SLA or the issue→category
mapping does not require touching the model.

## Current model (baseline): zero-shot CLIP

| | |
|---|---|
| Provider | `clip_zero_shot` (`backend/app/ml/providers/clip_zero_shot.py`) |
| Weights | OpenCLIP **ViT-B/16, LAION-400M (epoch 32)** – official open_clip GitHub release |
| Runtime | ONNX Runtime (CPU), int8 dynamic quantization of MatMul layers, ~86 MB, ~80–90 ms / photo on 2 CPU cores |
| Labels | the 21 codes in `backend/app/rules/civic_issue_taxonomy.json` (20 issues + `NO_CIVIC_ISSUE`) |
| How | photo embedding vs. text-prompt embeddings per issue (`clip_prompts.json`), softmax over issues |

This is real visual inference, but the model has **not been trained on civic complaint photos**.
Sanity checks run while building it:

* 40 close-up concrete/asphalt crack photos → 39 `ROAD_SURFACE_DAMAGE`, 1 `DAMAGED_FOOTPATH`
* 128 generic COCO photos (people, pets, food, vehicles, rooms) → 117 correctly `NO_CIVIC_ISSUE`

That is not an accuracy figure. No labelled civic test set exists yet, so nobody knows the real
accuracy. Confidence values are uncalibrated softmax probabilities.

### Rebuild the artifact

```bash
pip install -r backend/ml/requirements-build.txt     # torch + open_clip (build time only)
python -m backend.ml.build_clip_model                # writes backend/ml_models/clip-vit-b16-laion400m/
```

Run it again after editing `clip_prompts.json` or adding a taxonomy code. The script checks that
the ONNX output matches PyTorch (cosine similarity ≥ 0.98) and records SHA-256 checksums in
`manifest.json`, which the API verifies at load time.

## Replacing it with a trained model (recommended before production)

1. **Dataset**: at least 300–500 photos per issue code from SMKMC complaints (phone photos, all
   seasons, day and night), plus a `NO_CIVIC_ISSUE` set (selfies, indoor scenes, clean roads). Label
   with the taxonomy codes, never with departments. Split train/val/test by **location and date** so
   one pothole does not appear in both train and test. Useful public data to start with: RDD2022 (road
   damage), TACO (litter), pothole datasets on Kaggle/Roboflow. Check each licence first.
2. **Train**: fine-tune a small backbone such as EfficientNet-B0, ConvNeXt-Tiny or the CLIP ViT-B/16
   image tower with a linear head. Use class-balanced sampling and augmentation (rain, blur, low light).
3. **Calibrate**: fit a temperature on the validation set so that "80% confidence" means about 80%
   precision. Then set `classifier.temperature` in the manifest. Re-tune `AI_CONFIDENCE_*` if needed.
4. **Evaluate**: report per-class precision and recall and a confusion matrix on the held-out test
   set. That is where the *accuracy* number comes from. Confidence is not accuracy.
5. **Export** to ONNX (input NCHW float32, output logits in `labels` order) and write `manifest.json`
   for provider `onnx_classifier` (format documented in `backend/app/ml/providers/onnx_classifier.py`).
6. **Switch**: `AI_CLASSIFIER_PROVIDER=onnx_classifier`, `AI_MODEL_DIR=<dir>`. The API and frontend do
   not change.

## Multimodal (future)

`POST /ai/classify-image` already accepts `description`, `voice_transcript`, `latitude` and
`longitude`. Its response reports `modalities_used` and `context_received`. A text model can be fused
later by adding a provider that consumes `ComplaintContext`
(`services/issue_classification_service.py`).
