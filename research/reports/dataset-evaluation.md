# ISL Dataset Evaluation

Owner: Agent 07. Pages read on 2026-11-21. No dataset files were downloaded; this evaluation is based on source pages and papers only. Machine-readable version: `research/data/datasets.json`.

RTSLR currently uses none of these datasets.

## Summary

- **No verified, freely downloadable, multi-signer dataset of static ISL letters and digits was found.** The closest verified match (IEEE DataPort) has 3 signers and needs a subscription. Several Mendeley Data records look relevant but could not be opened from this environment, so their contents and licences are unconfirmed.
- For **dynamic word-level** ISL, INCLUDE is the strongest candidate: verified, CC BY 4.0, official splits.
- The first static experiment will therefore most likely need RTSLR's own consent-based landmark collection, with public data used as a supplement or external test set once licences are confirmed.

Licence wording below is quoted as stated on the page that was opened. "Licence not stated on source page" means the page was opened and had no licence. "Licence not confirmed" means the page could not be opened.

## Verified datasets (source page opened)

| Dataset | Content | Size | Signers | Type | Licence as stated | Access |
|---|---|---|---|---|---|---|
| INCLUDE / INCLUDE-50 | 263 word signs, 15 categories (subset: 50 signs) | 4,292 videos, ~0.27M frames, 56.8 GB | Not on Zenodo page; 7 per two papers' tables | Dynamic | Creative Commons Attribution 4.0 International | https://zenodo.org/records/4010759 |
| CISLR | ~4,700 words | 7,050 videos (per iSign paper), 1.59 GB | 71 (per iSign paper) | Dynamic | afl-3.0 | https://huggingface.co/datasets/IIT-K/CISLR (gated) |
| iSign | ISL-English sentence pairs | 118,228 pairs, 252 h, 228 GB | Not stated | Dynamic | cc-by-nc-sa-4.0; "free for research use but not for commercial purposes" | https://huggingface.co/datasets/Exploration-Lab/iSign (gated) |
| FDMSE-ISL | 2,002 words | 40,033 videos, ~36.2 h | 20 (10 M, 10 F) | Dynamic | Licence not stated on source page | Paper: https://arxiv.org/abs/2407.14224 (download page not opened) |
| ISL-FS | Continuous fingerspelling clips with text | 1,308 segments, 70.85 min, 14,814 characters | 3 | Dynamic | CC BY-NC 4.0, research purposes only | https://kirandevraj.github.io/ISL-Fingerspelling/ |
| ISL Fingerspelling Image Dataset (IEEE DataPort) | A-Z and digits 1-9, 35 classes | ~400 images per class, >14,000 images, 286.63 MB | 3 | Static | Creative Commons Attribution (version not stated) | https://ieee-dataport.org/documents/isl-fingerspelling-dataset (subscription required) |

### INCLUDE / INCLUDE-50

- **Contains:** word-level ISL videos recorded with deaf students of St. Louis School for the Deaf, Chennai. Official `train.csv` (3,475) and `test.csv` (817); INCLUDE-50 has 766 / 192.
- **Suitability:** best starting point for dynamic-sign work. Licence allows reuse with attribution, including commercial use. INCLUDE-50 is small enough for quick landmark-sequence experiments. The authors' code extracts MediaPipe Hands and BlazePose keypoints, the same family of landmarks RTSLR uses.
- **Limitations:** no letters or digits, so it does not serve the first experiment. One site and one regional variety. Signer count is not on the dataset page. Whether the official split separates signers is not stated on the pages read. The Hugging Face metadata mirror showed some label/path mismatches. Full download is 56.8 GB.

### CISLR

- **Contains:** word-level videos gathered from the web, large vocabulary, about one video per sign.
- **Suitability:** useful as a one-shot test bed or as a reference gallery for prototype matching, and for its signer variety (71).
- **Limitations:** cannot train a normal classifier with one sample per class. Gated access with conditions to accept. Academic Free License 3.0 terms should be read in full before redistribution of anything derived from it.

### iSign

- **Contains:** continuous signing paired with English text, plus pose files, from YouTube ISL channels.
- **Suitability:** long-term resource for translation and for pose pretraining.
- **Limitations:** non-commercial licence, which blocks commercial use of models trained on it unless separate permission is obtained. Gated, 228 GB. Not relevant to the static experiment.

### FDMSE-ISL

- **Contains:** the largest isolated-word ISL set found, with 20 signers and a published signer-independent split.
- **Suitability:** the best-designed evaluation protocol among ISL datasets found; a model for how RTSLR should split by signer.
- **Limitations:** the paper says the data "will be available" at a university page that was not opened; availability and licence are unconfirmed. Extra multi-view and depth data is described as research-only with permission.

### ISL-FS

- **Contains:** real fingerspelling as used in ISH News broadcasts, aligned to on-screen text.
- **Suitability:** the only ISL fingerspelling data found that reflects natural, continuous use. Good as a later reality check for whether a static-letter model survives real signing speed.
- **Limitations:** non-commercial licence. Continuous, with transitions between letters, so it cannot directly train a static classifier. 3 signers. The published baseline's 82.91% character error rate shows how hard the task is.

### ISL Fingerspelling Image Dataset (IEEE DataPort)

- **Contains:** static images for 26 letters and digits 1-9, two backgrounds, varied lighting.
- **Suitability:** the only verified dataset matching the first experiment's class set. With 3 signers, leave-one-signer-out is possible in principle.
- **Limitations:** download requires an IEEE DataPort subscription. Three signers give a very weak estimate of signer independence. No digit 0. Whether signer labels are present in the files is unknown without access.

## Unverified datasets (source page could not be opened)

Reason for all Mendeley entries: `data.mendeley.com` failed with a TLS certificate error from this environment on every attempt. Descriptions come from search-result extracts and must be treated as leads, not facts.

| Dataset | Reported content (unverified) | Licence | URL |
|---|---|---|---|
| ISL-CSLTR | 700 videos, 100 sentences, 7 signers | Licence not confirmed | https://data.mendeley.com/datasets/kcmpdxky7p/1 |
| Static gestures of ISL for English Alphabet, Hindi Vowels and Numerals | A-Z, 8 Hindi vowels, 10 numerals; reported research-only terms | Licence not confirmed | https://data.mendeley.com/datasets/7tsw22y96w |
| Multimodal ISL (English, Marathi, digits) | 79 static classes, about 20 images per class per modality | Licence not confirmed | https://data.mendeley.com/datasets/2tj6c7pzfk |
| ISLAN | About 700 images and 24 videos; single- and double-handed folders | Licence not confirmed | https://data.mendeley.com/datasets/rc349j45m5 |
| Img-ISL-PICT | About 53,000 images, 106 signs | Licence not confirmed | https://data.mendeley.com/datasets/tz3cjs5brd/1 |
| Kaggle "Indian Sign Language Translation Letters n Digits" | 10 digits and 23 letters (from a GitHub README) | Licence not stated on the page read; Kaggle page not readable | https://www.kaggle.com/kartik2112/indian-sign-language-translation-letters-n-digits |
| ISLRTC ISL Dictionary | Official dictionary videos; about 10,000 terms per news reports | Licence not stated on the ISLRTC home page; dictionary site and data.gov.in catalogue could not be opened | https://islrtc.nic.in/ |

Notes:

- **ISL-CSLTR** is corroborated by the iSign paper's comparison table (186 words, 700 videos, 7 signers), but its own page and licence were not seen.
- **Static gestures of ISL (7tsw22y96w)** is the most promising lead for the first experiment and should be re-checked first.
- **ISLRTC dictionary** is a reference for correct sign form, not training data: one demonstration per term. Any reuse beyond linking needs permission from ISLRTC.
- The dataset behind the 98.12% ISL result in the legacy prototype (31,200 images, Kulkarni et al. 2026) is private and not published.

## Fit against RTSLR's first experiment

Requirement: static ISL letters and digits, both hands visible, several signers with signer IDs, a licence that permits the intended use.

| Dataset | Classes fit | Multi-signer with IDs | Licence clear | Freely accessible | Verdict |
|---|---|---|---|---|---|
| IEEE DataPort ISL Fingerspelling | Yes (no digit 0) | 3 signers; IDs unknown | Yes (CC Attribution) | No (subscription) | Candidate supplement / external test set |
| Mendeley static sets | Reported yes | Unknown | Not confirmed | Unknown | Re-check |
| Kaggle letters and digits | Partial (23 letters) | Unknown | Not stated | Unknown | Re-check; low priority |
| INCLUDE | No | Partly | Yes (CC BY 4.0) | Yes | Phase 3 |
| ISL-FS | Letters, continuous | 3 signers | Yes, non-commercial | Yes | Later reality check |
| CISLR, iSign, FDMSE-ISL | No | Varies | Varies | Gated or unconfirmed | Phase 3 and later |

## Recommendation

1. **INCLUDE (CC BY 4.0)** for the dynamic-sign phase: verified, permissive, official splits, landmark-friendly tooling.
2. **IEEE DataPort ISL Fingerspelling Image Dataset (Creative Commons Attribution; subscription required)** as the only verified static letter-and-digit set, to be used as a supplement or external test set if access is obtained.
3. **ISL-FS (CC BY-NC 4.0, research only)** as a later test of real continuous fingerspelling.

For the first experiment itself, plan on **RTSLR's own landmark collection** with signer IDs and consent, because no verified public set meets the multi-signer requirement. Before any public dataset is used: re-read its licence on the source page, record the exact text and date, and get a decision on whether RTSLR's intended use (research demo or commercial product) fits non-commercial terms.
