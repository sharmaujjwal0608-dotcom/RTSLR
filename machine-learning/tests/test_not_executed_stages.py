"""The two stages that cannot run here (landmark extraction, sequence training)
must import cleanly, say plainly that they have not been executed, and fail
with a clear message instead of a stack trace.

These tests do NOT exercise MediaPipe, OpenCV or PyTorch.
"""

from __future__ import annotations

import importlib.util

import pytest

from preprocessing import extract_landmarks
from training import train_sequence


def installed(module: str) -> bool:
    return importlib.util.find_spec(module) is not None


def test_status_strings_say_not_executed():
    assert "not executed" in extract_landmarks.STATUS
    assert "not executed" in train_sequence.STATUS
    assert "NOT EXECUTED" in extract_landmarks.__doc__
    assert "NOT EXECUTED" in train_sequence.__doc__


@pytest.mark.skipif(installed("cv2") and installed("mediapipe"), reason="extraction dependencies are installed here")
def test_extraction_explains_missing_dependencies(capsys):
    with pytest.raises(extract_landmarks.MissingDependencyError, match="requirements-extract.txt"):
        extract_landmarks.require_extraction_dependencies()
    assert extract_landmarks.main([]) == 3
    message = capsys.readouterr().err
    assert "not executed" in message and "mediapipe" in message and "opencv-python" in message


@pytest.mark.skipif(installed("torch"), reason="PyTorch is installed here")
def test_sequence_training_explains_missing_pytorch(capsys):
    with pytest.raises(train_sequence.MissingDependencyError, match="requirements-sequence.txt"):
        train_sequence.require_torch()
    with pytest.raises(train_sequence.MissingDependencyError):
        train_sequence.build_model("gru", 160, 5)
    assert train_sequence.main([]) == 3
    captured = capsys.readouterr()
    assert "specified, not executed" in captured.out
    assert "PyTorch is not installed" in captured.err


def test_sequence_feature_width():
    assert train_sequence.sequence_feature_width(1) == 63 + 1 + 3
    assert train_sequence.sequence_feature_width(2) == 156 + 1 + 6
    with pytest.raises(ValueError):
        train_sequence.sequence_feature_width(3)


def test_index_csv_validation(tmp_path):
    good = tmp_path / "index.csv"
    good.write_text("path,label,signer_id,session_id\nclips/a.mp4,A,s01,t1\nimg/b.JPG,B,s02,t2\n", encoding="utf-8")
    rows = extract_landmarks.read_index(good)
    assert rows == [
        {"path": "clips/a.mp4", "label": "A", "signer_id": "s01", "session_id": "t1"},
        {"path": "img/b.JPG", "label": "B", "signer_id": "s02", "session_id": "t2"},
    ]
    cases = {
        "missing-column.csv": "path,label,signer_id\na.mp4,A,s01\n",
        "empty-signer.csv": "path,label,signer_id,session_id\na.mp4,A,,t1\n",
        "bad-type.csv": "path,label,signer_id,session_id\na.exe,A,s01,t1\n",
        "escape.csv": "path,label,signer_id,session_id\n../outside/a.mp4,A,s01,t1\n",
        "no-rows.csv": "path,label,signer_id,session_id\n",
    }
    for name, text in cases.items():
        path = tmp_path / name
        path.write_text(text, encoding="utf-8")
        with pytest.raises(ValueError):
            extract_landmarks.read_index(path)
