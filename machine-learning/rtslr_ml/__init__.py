"""RTSLR machine-learning pipeline (static ISL signs from hand landmarks).

No ISL dataset and no trained model ship with this package. See README.md.
"""

from .features import (  # noqa: F401
    DUAL_FEATURE_DIM,
    FEATURE_SCHEMA_VERSION,
    SINGLE_FEATURE_DIM,
    dual_hand_vector,
    single_hand_vector,
)

__version__ = "0.1.0"
