"""Dynamic-sign (sequence) model: design and training script.

STATUS: SPECIFIED, NOT EXECUTED.
    * PyTorch is not installed in machine-learning/.venv (see requirements-sequence.txt).
    * No sequence data exists. No dynamic-sign model has been trained or evaluated.
    * The browser has no adapter for a sequence model: ``FeatureWindow`` is reserved
      in the contract and "No v1 model consumes it" (docs/MODEL_CONTRACTS.md section 4).
Nothing in this file has been run beyond importing it and printing this status.

Design
------
Input
    A window of per-frame feature vectors (the browser's ``FeatureWindow``):
    ``T`` frames x ``D`` features, oldest first, resampled to a fixed rate
    (default 15 fps) and a fixed length (default T = 32, about 2 s).
    ``D`` = 63 for one-hand signs or 156 for the coordinated two-hand vector.
    Frames where tracking dropped are filled with zeros and flagged in a
    presence channel, so the input is ``D + 1`` wide.
    To let the model see movement directly, the per-frame wrist displacement
    since the previous frame (in palm lengths) is appended: 3 values for one
    hand, 6 for two. Final width: D + 1 + (3 or 6).

Dataset file (``.npz``, ``allow_pickle=False``)
    windows      (N, T, F) float32
    lengths      (N,) int16        number of real frames before padding
    labels       (N,) unicode
    signer_ids   (N,) unicode
    session_ids  (N,) unicode
    plus the same manifest as the static pipeline (licence and consent gate).

Models (both small enough for a browser)
    ``gru``   2-layer bidirectional GRU (hidden 96) -> masked mean over time
              -> dropout -> linear.
    ``tcn``   4 residual 1-D convolution blocks (kernel 5, dilations 1, 2, 4, 8,
              96 channels) -> masked global average -> linear.
    A "no sign / transition" class is required in the label set: a live stream
    is mostly not-a-sign, and a model without that class will always name one.

Training
    AdamW, cosine schedule, label smoothing 0.1, early stopping on validation
    macro-F1. Augmentation on the training signers only and after splitting:
    time stretch 0.8-1.25x, random crop of the start/end, small Gaussian jitter.
    Horizontal mirroring is NOT applied blindly: it needs the A/B hand order of
    the 156-D layout to be swapped consistently and a signer to confirm that
    the mirrored form is the same sign.

Evaluation
    Identical protocol rules to the static pipeline: split by signer first
    (rtslr_ml.splits), select on validation signers, report accuracy, macro-F1,
    per-class and per-signer figures on unseen signers
    (evaluation.evaluate.evaluate_predictions). In addition, for live use:
    false activations per minute on continuous non-sign footage, and the
    latency from the end of a sign to its detection.

Export
    Not defined yet. ``rtslr-model-1`` has no recurrent or convolutional layer
    type; a new format version and a browser adapter must be specified with the
    orchestrator before any sequence model can ship.
"""

from __future__ import annotations

import argparse
import sys
from typing import Any, Sequence

STATUS = "specified, not executed: PyTorch is not installed and no sequence data exists"

DEFAULT_CONFIG: dict[str, Any] = {
    "window_frames": 32,
    "fps": 15,
    "architecture": "gru",
    "hidden_size": 96,
    "num_layers": 2,
    "dropout": 0.3,
    "tcn_channels": 96,
    "tcn_kernel": 5,
    "tcn_dilations": [1, 2, 4, 8],
    "learning_rate": 1e-3,
    "weight_decay": 1e-2,
    "label_smoothing": 0.1,
    "batch_size": 64,
    "max_epochs": 120,
    "patience": 15,
    "seed": 0,
}


class MissingDependencyError(RuntimeError):
    """PyTorch is required for the sequence model and is not installed."""


def require_torch():
    """Import PyTorch or explain exactly what is missing."""
    try:
        import torch  # noqa: PLC0415
    except ImportError as error:
        raise MissingDependencyError(
            "PyTorch is not installed in this environment. The sequence model is specified but has never been run. "
            "To work on it: pip install -r requirements-sequence.txt (in a separate environment), "
            "and obtain an authorised dataset of sign sequences first."
        ) from error
    return torch


def sequence_feature_width(hands: int) -> int:
    """Per-frame width: features + presence flag + wrist displacement."""
    if hands not in (1, 2):
        raise ValueError("hands must be 1 or 2")
    return (63 if hands == 1 else 156) + 1 + 3 * hands


def build_model(architecture: str, input_width: int, n_classes: int, config: dict[str, Any] | None = None):
    """Construct the GRU or temporal-CNN classifier. Requires PyTorch."""
    torch = require_torch()
    nn = torch.nn
    cfg = {**DEFAULT_CONFIG, **(config or {})}

    def masked_mean(sequence, lengths):
        # sequence: (B, T, C); lengths: (B,)
        steps = torch.arange(sequence.shape[1], device=sequence.device)[None, :]
        mask = (steps < lengths[:, None]).to(sequence.dtype)[:, :, None]
        return (sequence * mask).sum(dim=1) / mask.sum(dim=1).clamp(min=1.0)

    class GruClassifier(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            self.gru = nn.GRU(
                input_width,
                cfg["hidden_size"],
                num_layers=cfg["num_layers"],
                batch_first=True,
                bidirectional=True,
                dropout=cfg["dropout"] if cfg["num_layers"] > 1 else 0.0,
            )
            self.dropout = nn.Dropout(cfg["dropout"])
            self.head = nn.Linear(2 * cfg["hidden_size"], n_classes)

        def forward(self, windows, lengths):
            output, _ = self.gru(windows)
            return self.head(self.dropout(masked_mean(output, lengths)))

    class ResidualBlock(nn.Module):
        def __init__(self, channels: int, kernel: int, dilation: int) -> None:
            super().__init__()
            padding = (kernel - 1) // 2 * dilation
            self.body = nn.Sequential(
                nn.Conv1d(channels, channels, kernel, padding=padding, dilation=dilation),
                nn.BatchNorm1d(channels),
                nn.ReLU(),
                nn.Dropout(cfg["dropout"]),
                nn.Conv1d(channels, channels, kernel, padding=padding, dilation=dilation),
                nn.BatchNorm1d(channels),
            )
            self.activation = nn.ReLU()

        def forward(self, x):
            return self.activation(x + self.body(x))

    class TemporalCnnClassifier(nn.Module):
        def __init__(self) -> None:
            super().__init__()
            channels = cfg["tcn_channels"]
            self.stem = nn.Conv1d(input_width, channels, 1)
            self.blocks = nn.Sequential(*[ResidualBlock(channels, cfg["tcn_kernel"], d) for d in cfg["tcn_dilations"]])
            self.head = nn.Linear(channels, n_classes)

        def forward(self, windows, lengths):
            features = self.blocks(self.stem(windows.transpose(1, 2))).transpose(1, 2)
            return self.head(masked_mean(features, lengths))

    if architecture == "gru":
        return GruClassifier()
    if architecture == "tcn":
        return TemporalCnnClassifier()
    raise ValueError('architecture must be "gru" or "tcn"')


def train(dataset_path: str, manifest_path: str, hands: int, out_dir: str, config: dict[str, Any] | None = None) -> dict[str, Any]:
    """Signer-aware training loop for the sequence model. NOT EXECUTED (see module docstring)."""
    torch = require_torch()
    import numpy as np  # noqa: PLC0415

    from evaluation.evaluate import evaluate_predictions, write_report  # noqa: PLC0415
    from rtslr_ml.dataset import load_manifest, require_training_ready  # noqa: PLC0415
    from rtslr_ml.guards import assert_output_allowed  # noqa: PLC0415
    from rtslr_ml.splits import signer_holdout_split  # noqa: PLC0415

    cfg = {**DEFAULT_CONFIG, **(config or {})}
    manifest = load_manifest(manifest_path)
    require_training_ready(manifest)
    synthetic = manifest["synthetic"] is True
    out = assert_output_allowed(out_dir, synthetic)

    with np.load(dataset_path, allow_pickle=False) as data:
        windows = data["windows"].astype("float32")
        lengths = data["lengths"].astype("int64")
        labels = data["labels"].astype(str)
        signers = data["signer_ids"].astype(str)
    expected_width = sequence_feature_width(hands)
    if windows.ndim != 3 or windows.shape[2] != expected_width:
        raise ValueError(f"windows must have shape (N, T, {expected_width}), got {windows.shape}")

    split = signer_holdout_split(signers, labels, seed=cfg["seed"])
    classes = sorted(set(labels[split.train].tolist()))
    class_index = {label: i for i, label in enumerate(classes)}
    targets = np.asarray([class_index.get(label, -1) for label in labels])

    torch.manual_seed(cfg["seed"])
    model = build_model(cfg["architecture"], expected_width, len(classes), cfg)
    optimiser = torch.optim.AdamW(model.parameters(), lr=cfg["learning_rate"], weight_decay=cfg["weight_decay"])
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, T_max=cfg["max_epochs"])
    loss_fn = torch.nn.CrossEntropyLoss(label_smoothing=cfg["label_smoothing"])

    def tensors(index):
        return (
            torch.from_numpy(windows[index]),
            torch.from_numpy(lengths[index]),
            torch.from_numpy(targets[index]),
        )

    def predict(index):
        model.eval()
        with torch.no_grad():
            x, n, _ = tensors(index)
            return model(x, n).argmax(dim=1).numpy()

    generator = torch.Generator().manual_seed(cfg["seed"])
    best_state, best_score, stale = None, -1.0, 0
    for _epoch in range(cfg["max_epochs"]):
        model.train()
        order = torch.randperm(len(split.train), generator=generator).numpy()
        for start in range(0, len(order), cfg["batch_size"]):
            batch = split.train[order[start : start + cfg["batch_size"]]]
            x, n, t = tensors(batch)
            optimiser.zero_grad()
            loss_fn(model(x, n), t).backward()
            optimiser.step()
        scheduler.step()
        val_metrics = evaluate_predictions(labels[split.val], np.asarray(classes)[predict(split.val)], classes)
        if val_metrics["macro_f1"] > best_score:
            best_score, stale = val_metrics["macro_f1"], 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            stale += 1
            if stale >= cfg["patience"]:
                break
    model.load_state_dict(best_state)

    test_metrics = evaluate_predictions(
        labels[split.test], np.asarray(classes)[predict(split.test)], classes, signers[split.test]
    )
    protocol = split.protocol.to_dict()
    protocol["description"] = split.protocol.describe()
    report = {
        "format": "rtslr-training-report-1",
        "synthetic": synthetic,
        "run_name": out.name,
        "dataset_id": manifest["dataset_id"],
        "sign_language": manifest["sign_language"],
        "feature_schema": "rtslr-features-1",
        "hands": hands,
        "input_dim": expected_width,
        "seed": cfg["seed"],
        "classes": classes,
        "protocol": protocol,
        "selected": {"kind": cfg["architecture"], "params": cfg, "val_macro_f1": best_score, "val_accuracy": None, "test": test_metrics},
    }
    out.mkdir(parents=True, exist_ok=True)
    torch.save(model.state_dict(), out / "sequence-model.pt")
    write_report(report, out)
    return report


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=f"Sequence model for dynamic signs ({STATUS}).")
    parser.add_argument("--dataset")
    parser.add_argument("--manifest")
    parser.add_argument("--hands", type=int, choices=(1, 2), default=2)
    parser.add_argument("--out")
    parser.add_argument("--architecture", choices=("gru", "tcn"), default="gru")
    args = parser.parse_args(argv)

    print(f"train_sequence: {STATUS}.")
    try:
        require_torch()
    except MissingDependencyError as error:
        print(str(error), file=sys.stderr)
        return 3
    if not (args.dataset and args.manifest and args.out):
        print("--dataset, --manifest and --out are required to train.", file=sys.stderr)
        return 2
    train(args.dataset, args.manifest, args.hands, args.out, {"architecture": args.architecture})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
