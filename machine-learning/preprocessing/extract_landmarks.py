"""Image / video -> hand landmarks, using MediaPipe (Python) and OpenCV.

STATUS: WRITTEN, NOT EXECUTED.
    ``mediapipe`` and ``opencv-python`` are not installed in machine-learning/.venv
    (see requirements-extract.txt), and there is no dataset to run it on. Importing
    this module works without them; running it prints what is missing.

Input: an index CSV, one row per media file, that YOU write from the dataset's
own documentation (the script does not guess labels from folder names)::

    path,label,signer_id,session_id
    clips/s01/A_01.mp4,A,s01,s01-take1
    images/s02/B_003.jpg,B,s02,s02-take1

``path`` is relative to ``--media-root``. ``signer_id`` must be an anonymous id.
Media must be in the camera's own (unmirrored) orientation: do not use selfie
footage that was saved mirrored, or flip it back first with ``--unmirror``.

Output: a landmark dataset ``.npz`` in the format of rtslr_ml/dataset.py (raw
landmarks + image sizes; no pixels are kept) and an extraction report with the
hand-detection rate per class. Detection failure is a result in its own right:
published work on two-handed ISL letters reports large per-letter detection
losses when hands overlap (docs/RESEARCH_NOTES.md section 1), so this rate must
be reported next to any accuracy figure.

Example::

    python -m preprocessing.extract_landmarks --index data/index.csv --media-root D:/isl-raw \
        --manifest data/isl.manifest.json --hand-model models/hand_landmarker.task \
        --out data/isl.npz --every-nth-frame 5
"""

from __future__ import annotations

import argparse
import csv
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterator, Sequence

import numpy as np

STATUS = "written, not executed: mediapipe and opencv-python are not installed and no dataset is present"
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
VIDEO_SUFFIXES = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


class MissingDependencyError(RuntimeError):
    """mediapipe / opencv-python are required for extraction and are not installed."""


def require_extraction_dependencies():
    """Import OpenCV and MediaPipe or explain exactly what is missing."""
    missing = []
    try:
        import cv2  # noqa: PLC0415
    except ImportError:
        cv2 = None
        missing.append("opencv-python")
    try:
        import mediapipe as mp  # noqa: PLC0415
    except ImportError:
        mp = None
        missing.append("mediapipe")
    if missing:
        raise MissingDependencyError(
            f"Landmark extraction needs {', '.join(missing)}, which {'is' if len(missing) == 1 else 'are'} not installed. "
            "Install them in a separate environment with: pip install -r requirements-extract.txt. "
            "This script has not been run in this project."
        )
    return cv2, mp


def read_index(index_path: str | Path) -> list[dict[str, str]]:
    """Read and validate the index CSV. Pure Python: usable without the heavy dependencies."""
    required = ("path", "label", "signer_id", "session_id")
    rows: list[dict[str, str]] = []
    with Path(index_path).open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing = [c for c in required if c not in (reader.fieldnames or [])]
        if missing:
            raise ValueError(f"{index_path}: missing columns {missing}")
        for line_number, record in enumerate(reader, start=2):
            row = {key: (record.get(key) or "").strip() for key in required}
            empty = [key for key, value in row.items() if not value]
            if empty:
                raise ValueError(f"{index_path}, line {line_number}: empty {empty}")
            suffix = Path(row["path"]).suffix.lower()
            if suffix not in IMAGE_SUFFIXES | VIDEO_SUFFIXES:
                raise ValueError(f"{index_path}, line {line_number}: unsupported media type {suffix!r}")
            if Path(row["path"]).is_absolute() or ".." in Path(row["path"]).parts:
                raise ValueError(f"{index_path}, line {line_number}: path must be relative to the media root")
            rows.append(row)
    if not rows:
        raise ValueError(f"{index_path}: no rows")
    return rows


def _frames(cv2, media_path: Path, every_nth_frame: int) -> Iterator[tuple[int, Any]]:
    """Yield (frame_number, BGR image). An image yields one frame."""
    if media_path.suffix.lower() in IMAGE_SUFFIXES:
        image = cv2.imread(str(media_path))
        if image is not None:
            yield 0, image
        return
    capture = cv2.VideoCapture(str(media_path))
    try:
        number = 0
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if number % every_nth_frame == 0:
                yield number, frame
            number += 1
    finally:
        capture.release()


def extract(
    index_path: str | Path,
    media_root: str | Path,
    manifest_path: str | Path,
    hand_model_path: str | Path,
    out_path: str | Path,
    *,
    every_nth_frame: int = 5,
    unmirror: bool = False,
    min_detection_confidence: float = 0.5,
) -> dict[str, Any]:
    """Run MediaPipe Hand Landmarker over every indexed file. NOT EXECUTED in this project."""
    cv2, mp = require_extraction_dependencies()

    from rtslr_ml.dataset import LandmarkDataset, class_inventory, load_manifest, require_training_ready, save_npz
    from rtslr_ml.guards import assert_output_allowed, write_json

    manifest = load_manifest(manifest_path)
    require_training_ready(manifest)  # licence and consent come before touching the media
    synthetic = manifest["synthetic"] is True
    out_path = assert_output_allowed(out_path, synthetic)
    inventory = class_inventory(manifest)
    rows = read_index(index_path)
    media_root = Path(media_root)

    options = mp.tasks.vision.HandLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(hand_model_path)),
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        num_hands=2,
        min_hand_detection_confidence=min_detection_confidence,
    )

    labels, signers, sessions, counts, sources, sizes, landmarks = [], [], [], [], [], [], []
    frames_seen: Counter = Counter()
    frames_kept: Counter = Counter()
    failures: dict[str, Counter] = defaultdict(Counter)

    with mp.tasks.vision.HandLandmarker.create_from_options(options) as landmarker:
        for row in rows:
            label = row["label"]
            if label not in inventory:
                failures[label]["label_not_in_manifest"] += 1
                continue
            expected_hands = inventory[label]["hands"]
            media_path = media_root / row["path"]
            if not media_path.is_file():
                failures[label]["file_missing"] += 1
                continue
            for frame_number, bgr in _frames(cv2, media_path, every_nth_frame):
                frames_seen[label] += 1
                if unmirror:
                    bgr = cv2.flip(bgr, 1)
                height, width = bgr.shape[:2]
                rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                result = landmarker.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb))
                detected = len(result.hand_landmarks)
                if detected == 0:
                    failures[label]["no_hand_detected"] += 1
                    continue
                if detected != expected_hands:
                    failures[label][f"detected_{detected}_expected_{expected_hands}"] += 1
                    continue
                hands = np.full((2, 21, 3), np.nan, dtype=np.float32)
                for h, hand in enumerate(result.hand_landmarks):
                    hands[h] = [(point.x, point.y, point.z) for point in hand]
                labels.append(label)
                signers.append(row["signer_id"])
                sessions.append(row["session_id"])
                counts.append(detected)
                sources.append(f"{row['path']}#{frame_number}")
                sizes.append((width, height))
                landmarks.append(hands)
                frames_kept[label] += 1

    if not labels:
        raise RuntimeError("no frame produced usable landmarks; nothing was written")
    dataset = LandmarkDataset(
        labels=np.asarray(labels, dtype=str),
        signer_ids=np.asarray(signers, dtype=str),
        session_ids=np.asarray(sessions, dtype=str),
        hand_count=np.asarray(counts, dtype=np.int8),
        sources=np.asarray(sources, dtype=str),
        landmarks=np.stack(landmarks),
        image_sizes=np.asarray(sizes, dtype=np.float32),
    )
    save_npz(dataset, out_path)

    report = {
        "format": "rtslr-extraction-report-1",
        "synthetic": synthetic,
        "dataset_id": manifest["dataset_id"],
        "every_nth_frame": every_nth_frame,
        "unmirrored_by_script": unmirror,
        "frames_seen": int(sum(frames_seen.values())),
        "frames_kept": int(sum(frames_kept.values())),
        "detection_rate_per_class": {
            label: (frames_kept[label] / frames_seen[label] if frames_seen[label] else None) for label in sorted(inventory)
        },
        "failures_per_class": {label: dict(counter) for label, counter in sorted(failures.items())},
    }
    write_json(Path(out_path).with_suffix(".extraction-report.json"), report, synthetic=synthetic)
    return report


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=f"Extract hand landmarks from images and videos ({STATUS}).")
    parser.add_argument("--index", help="CSV with path,label,signer_id,session_id")
    parser.add_argument("--media-root", help="folder the index paths are relative to")
    parser.add_argument("--manifest", help="dataset manifest (licence and consent must be filled in)")
    parser.add_argument("--hand-model", help="MediaPipe hand_landmarker.task file (use the same version as the browser)")
    parser.add_argument("--out", help="output .npz path")
    parser.add_argument("--every-nth-frame", type=int, default=5)
    parser.add_argument("--unmirror", action="store_true", help="flip frames horizontally (for footage saved mirrored)")
    args = parser.parse_args(argv)

    try:
        require_extraction_dependencies()
    except MissingDependencyError as error:
        print(f"extract_landmarks: {STATUS}.", file=sys.stderr)
        print(str(error), file=sys.stderr)
        return 3
    needed = ("index", "media_root", "manifest", "hand_model", "out")
    if any(getattr(args, name) is None for name in needed):
        parser.error("--index, --media-root, --manifest, --hand-model and --out are all required")
    report = extract(
        args.index,
        args.media_root,
        args.manifest,
        args.hand_model,
        args.out,
        every_nth_frame=max(1, args.every_nth_frame),
        unmirror=args.unmirror,
    )
    print(f"kept {report['frames_kept']} of {report['frames_seen']} frames; wrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
