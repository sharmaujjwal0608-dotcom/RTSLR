"""Feature layout tests, including parity with the TypeScript implementation."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest

from rtslr_ml.features import (
    DUAL_FEATURE_DIM,
    SINGLE_FEATURE_DIM,
    aspect_correct,
    batch_dual_vectors,
    batch_single_vectors,
    dual_hand_vector,
    order_hands_ab,
    palm_normal,
    single_hand_vector,
)

PARITY_FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "frontend"
    / "src"
    / "features"
    / "tracking"
    / "__fixtures__"
    / "feature-parity.json"
)


def minimal_hand(dx: float = 0.0) -> np.ndarray:
    """Wrist at (0.25, 0.5, 0); every other point at the wrist except three chosen ones."""
    hand = np.tile(np.array([0.25 + dx, 0.5, 0.0]), (21, 1))
    hand[9] = [0.25 + dx, 0.25, 0.0]  # middle MCP straight above the wrist
    hand[5] = [0.20 + dx, 0.30, 0.0]
    hand[17] = [0.30 + dx, 0.30, 0.0]
    hand[8] = [0.20 + dx, 0.10, 0.05]
    return hand


def random_hand(seed: int, x: float) -> np.ndarray:
    rng = np.random.default_rng(seed)
    hand = rng.uniform(-0.1, 0.1, size=(21, 3))
    hand[:, 0] += x
    hand[:, 1] += 0.5
    return hand


def test_single_vector_matches_hand_calculation():
    # 200x100 image: aspect 2, so x and z double. palm = |p9 - p0| = 0.25 (y only).
    v = single_hand_vector(minimal_hand(), 200, 100)
    assert v.shape == (SINGLE_FEATURE_DIM,)
    assert v.dtype == np.float32
    np.testing.assert_allclose(v[0:3], [0, 0, 0], atol=1e-7)
    np.testing.assert_allclose(v[27:30], [0, -1, 0], atol=1e-6)  # landmark 9
    np.testing.assert_allclose(v[15:18], [-0.1 / 0.25, -0.2 / 0.25, 0], atol=1e-6)  # landmark 5: dx -0.05 * 2
    np.testing.assert_allclose(v[24:27], [-0.4, -1.6, 0.4], atol=1e-6)  # landmark 8: z 0.05 * 2 / 0.25
    untouched = np.delete(v.reshape(21, 3), [5, 8, 9, 17], axis=0)
    assert np.all(untouched == 0)


def test_single_vector_is_translation_and_scale_invariant():
    hand = random_hand(3, 0.4)
    base = single_hand_vector(hand, 480, 480)
    moved = single_hand_vector(hand + [0.1, -0.05, 0.02], 480, 480)
    scaled = single_hand_vector((hand - hand[0]) * 1.7 + hand[0], 480, 480)
    np.testing.assert_allclose(moved, base, atol=1e-5)
    np.testing.assert_allclose(scaled, base, atol=1e-5)


def test_aspect_correction_changes_x_and_z_only():
    hand = random_hand(4, 0.4)
    corrected = aspect_correct(hand, 1280, 720)
    np.testing.assert_allclose(corrected[:, 0], hand[:, 0] * 1280 / 720)
    np.testing.assert_allclose(corrected[:, 1], hand[:, 1])
    np.testing.assert_allclose(corrected[:, 2], hand[:, 2] * 1280 / 720)
    assert not np.allclose(single_hand_vector(hand, 1280, 720), single_hand_vector(hand, 720, 1280))


def test_degenerate_hand_clamps_palm_length():
    v = single_hand_vector(np.full((21, 3), 0.5), 640, 480)
    assert np.all(v == 0)
    assert np.all(np.isfinite(v))


def test_dual_vector_layout_matches_hand_calculation():
    a, b = minimal_hand(), minimal_hand(0.5)
    v = dual_hand_vector(a, b, 200, 100)
    assert v.shape == (DUAL_FEATURE_DIM,)
    single = single_hand_vector(a, 200, 100)
    np.testing.assert_allclose(v[0:63], single, atol=1e-6)
    np.testing.assert_allclose(v[63:126], single, atol=1e-6)  # B is a shifted copy of A
    # s = 0.25; wrists are 0.5 * 2 = 1.0 apart in x after the aspect correction.
    np.testing.assert_allclose(v[126:129], [4, 0, 0], atol=1e-5)
    assert v[129] == pytest.approx(4.0, abs=1e-5)
    # Fingertips 4, 12, 16, 20 sit on the wrist; fingertip 8 is displaced by (-0.1, -0.4, 0.1).
    tips = v[130:155].reshape(5, 5)
    assert tips[0, 0] == pytest.approx(4.0, abs=1e-5)  # thumb tip A to thumb tip B
    assert tips[1, 1] == pytest.approx(4.0, abs=1e-5)  # index tip A to index tip B: same displacement
    assert tips[0, 1] == pytest.approx(np.linalg.norm([1.0 - 0.1, -0.4, 0.1]) / 0.25, abs=1e-4)
    assert tips[1, 0] == pytest.approx(np.linalg.norm([1.0 + 0.1, 0.4, -0.1]) / 0.25, abs=1e-4)
    assert v[155] == pytest.approx(1.0, abs=1e-6)  # identical palm orientation


def test_dual_vector_does_not_depend_on_argument_order():
    left, right = random_hand(11, 0.3), random_hand(29, 0.7)
    np.testing.assert_array_equal(dual_hand_vector(left, right, 640, 480), dual_hand_vector(right, left, 640, 480))
    a, b = order_hands_ab(right, left)
    assert a[0, 0] < b[0, 0]


def test_dual_vector_tie_keeps_first_argument_as_a():
    first, second = random_hand(1, 0.5), random_hand(2, 0.5)
    second[0, 0] = first[0, 0]
    a, _ = order_hands_ab(first, second)
    assert a is not second
    np.testing.assert_array_equal(a, first)


def test_palm_normal_cosine_is_minus_one_for_a_flipped_palm():
    hand = minimal_hand()
    flipped = hand.copy()
    flipped[[5, 17]] = hand[[17, 5]]  # swap index and little-finger knuckles
    v = dual_hand_vector(hand, flipped + [0.5, 0, 0], 100, 100)
    assert v[155] == pytest.approx(-1.0, abs=1e-6)
    assert np.all(palm_normal(aspect_correct(np.full((21, 3), 0.5), 1, 1)) == 0)


def test_bad_input_is_rejected():
    with pytest.raises(ValueError):
        single_hand_vector(np.zeros((20, 3)), 640, 480)
    bad = random_hand(1, 0.5)
    bad[3, 1] = np.nan
    with pytest.raises(ValueError):
        single_hand_vector(bad, 640, 480)
    with pytest.raises(ValueError):
        single_hand_vector(random_hand(1, 0.5), 0, 480)


def test_batch_functions_match_the_single_versions():
    hands = np.stack([random_hand(i, 0.3) for i in range(4)])
    others = np.stack([random_hand(100 + i, 0.7) for i in range(4)])
    sizes = np.array([[640, 480], [1280, 720], [720, 1280], [480, 480]], dtype=float)
    singles = batch_single_vectors(hands, sizes)
    duals = batch_dual_vectors(np.stack([hands, others], axis=1), sizes)
    for i in range(4):
        np.testing.assert_array_equal(singles[i], single_hand_vector(hands[i], *sizes[i]))
        np.testing.assert_array_equal(duals[i], dual_hand_vector(hands[i], others[i], *sizes[i]))


def test_parity_with_the_typescript_implementation():
    """Reads the fixture generated by frontend/src/features/tracking (Agent 05)."""
    if not PARITY_FIXTURE.is_file():
        pytest.skip(
            f"feature-parity fixture not found at {PARITY_FIXTURE}. It is generated by the tracking "
            "feature's test suite; cross-language parity is NOT verified until it exists."
        )
    fixture = json.loads(PARITY_FIXTURE.read_text(encoding="utf-8"))
    assert fixture["schema"] == "rtslr-features-1"
    tolerance = 1e-5
    checked_single = checked_dual = 0
    for case in fixture["cases"]:
        width, height = case["imageWidth"], case["imageHeight"]
        hands = {hand["slot"]: np.asarray(hand["landmarks"], dtype=np.float64) for hand in case["hands"]}
        expected = case["expected"]
        assert expected["handCount"] == len(hands), case["name"]
        for entry in expected["perHand"]:
            ours = single_hand_vector(hands[entry["slot"]], width, height)
            np.testing.assert_allclose(ours, np.asarray(entry["vector"]), atol=tolerance, rtol=0, err_msg=case["name"])
            checked_single += 1
        if expected["dual"] is None:
            assert len(hands) != 2, case["name"]
            continue
        ordered = [hands[slot] for slot in sorted(hands)]
        ours = dual_hand_vector(ordered[0], ordered[1], width, height)
        np.testing.assert_allclose(ours, np.asarray(expected["dual"]), atol=tolerance, rtol=0, err_msg=case["name"])
        if expected.get("dualOrder"):
            a, _ = order_hands_ab(ordered[0], ordered[1])
            np.testing.assert_array_equal(a, hands[expected["dualOrder"]["a"]], err_msg=case["name"])
        checked_dual += 1
    assert checked_single > 0 and checked_dual > 0, "the fixture must contain single and dual cases"
