"""Feature engineering, schema ``rtslr-features-1``.

NumPy implementation of docs/MODEL_CONTRACTS.md sections 1-3. It must stay
numerically identical to ``frontend/src/features/tracking/features.ts``;
``tests/test_features.py`` checks this against the shared parity fixture.

Conventions
-----------
* A hand is an array of shape (21, 3): MediaPipe ``x``, ``y`` normalised to the
  image (origin top-left, UNMIRRORED camera frame) and relative depth ``z``.
* Before any geometry: ``x' = x * (W / H)``, ``y' = y``, ``z' = z * (W / H)``.
* No handedness mirroring is applied in v1.
"""

from __future__ import annotations

import numpy as np

FEATURE_SCHEMA_VERSION = "rtslr-features-1"
LANDMARKS_PER_HAND = 21
SINGLE_FEATURE_DIM = 63
DUAL_FEATURE_DIM = 156
FINGERTIP_INDICES = (4, 8, 12, 16, 20)
MIN_PALM_LENGTH = 1e-4
_MIN_NORMAL_LENGTH = 1e-12


def _as_hand(landmarks) -> np.ndarray:
    hand = np.asarray(landmarks, dtype=np.float64)
    if hand.shape != (LANDMARKS_PER_HAND, 3):
        raise ValueError(f"a hand must have shape (21, 3), got {hand.shape}")
    if not np.all(np.isfinite(hand)):
        raise ValueError("hand landmarks contain NaN or infinite values")
    return hand


def aspect_correct(landmarks, image_width: float, image_height: float) -> np.ndarray:
    """Undo image anisotropy (contract section 1). Returns a float64 (21, 3) copy."""
    hand = _as_hand(landmarks)
    if not (image_width > 0 and image_height > 0):
        raise ValueError("image_width and image_height must be positive")
    aspect = float(image_width) / float(image_height)
    out = hand.copy()
    out[:, 0] *= aspect
    out[:, 2] *= aspect
    return out


def palm_length(corrected: np.ndarray) -> float:
    """``max(|p9 - p0|, 1e-4)`` for aspect-corrected points."""
    return max(float(np.linalg.norm(corrected[9] - corrected[0])), MIN_PALM_LENGTH)


def palm_normal(corrected: np.ndarray) -> np.ndarray:
    """``normalize(cross(p5 - p0, p17 - p0))``; the zero vector when degenerate."""
    normal = np.cross(corrected[5] - corrected[0], corrected[17] - corrected[0])
    length = float(np.linalg.norm(normal))
    if not length > _MIN_NORMAL_LENGTH:
        return np.zeros(3)
    return normal / length


def _single_from_corrected(corrected: np.ndarray) -> tuple[np.ndarray, float]:
    palm = palm_length(corrected)
    return ((corrected - corrected[0]) / palm).reshape(-1), palm


def single_hand_vector(landmarks, image_width: float, image_height: float) -> np.ndarray:
    """63-D vector: ``v[3i:3i+3] = (p_i - p_0) / palm`` (contract section 2)."""
    vector, _ = _single_from_corrected(aspect_correct(landmarks, image_width, image_height))
    return vector.astype(np.float32)


def order_hands_ab(first, second) -> tuple[np.ndarray, np.ndarray]:
    """Hand A has the smaller unmirrored wrist x. On an exact tie the first argument is A."""
    first = _as_hand(first)
    second = _as_hand(second)
    if second[0, 0] < first[0, 0]:
        return second, first
    return first, second


def dual_hand_vector(first, second, image_width: float, image_height: float) -> np.ndarray:
    """156-D coordinated two-hand vector (contract section 3). Hands may be given in any order."""
    hand_a, hand_b = order_hands_ab(first, second)
    pa = aspect_correct(hand_a, image_width, image_height)
    pb = aspect_correct(hand_b, image_width, image_height)

    out = np.zeros(DUAL_FEATURE_DIM, dtype=np.float64)
    out[0:63], palm_a = _single_from_corrected(pa)
    out[63:126], palm_b = _single_from_corrected(pb)
    scale = (palm_a + palm_b) / 2.0

    wrist_offset = pb[0] - pa[0]
    out[126:129] = wrist_offset / scale
    out[129] = np.linalg.norm(wrist_offset) / scale

    tips_a = pa[list(FINGERTIP_INDICES)]
    tips_b = pb[list(FINGERTIP_INDICES)]
    distances = np.linalg.norm(tips_a[:, None, :] - tips_b[None, :, :], axis=2) / scale
    out[130:155] = distances.reshape(-1)  # row-major, i over hand A

    out[155] = float(np.dot(palm_normal(pa), palm_normal(pb)))
    return out.astype(np.float32)


def batch_single_vectors(landmarks: np.ndarray, image_sizes: np.ndarray) -> np.ndarray:
    """Vectorised 63-D features. ``landmarks``: (N, 21, 3); ``image_sizes``: (N, 2) as (width, height)."""
    landmarks = np.asarray(landmarks, dtype=np.float64)
    image_sizes = np.asarray(image_sizes, dtype=np.float64)
    if landmarks.ndim != 3 or landmarks.shape[1:] != (LANDMARKS_PER_HAND, 3):
        raise ValueError(f"expected (N, 21, 3), got {landmarks.shape}")
    out = np.empty((landmarks.shape[0], SINGLE_FEATURE_DIM), dtype=np.float32)
    for i in range(landmarks.shape[0]):
        out[i] = single_hand_vector(landmarks[i], image_sizes[i, 0], image_sizes[i, 1])
    return out


def batch_dual_vectors(landmarks: np.ndarray, image_sizes: np.ndarray) -> np.ndarray:
    """Vectorised 156-D features. ``landmarks``: (N, 2, 21, 3) in any hand order."""
    landmarks = np.asarray(landmarks, dtype=np.float64)
    image_sizes = np.asarray(image_sizes, dtype=np.float64)
    if landmarks.ndim != 4 or landmarks.shape[1:] != (2, LANDMARKS_PER_HAND, 3):
        raise ValueError(f"expected (N, 2, 21, 3), got {landmarks.shape}")
    out = np.empty((landmarks.shape[0], DUAL_FEATURE_DIM), dtype=np.float32)
    for i in range(landmarks.shape[0]):
        out[i] = dual_hand_vector(landmarks[i, 0], landmarks[i, 1], image_sizes[i, 0], image_sizes[i, 1])
    return out
