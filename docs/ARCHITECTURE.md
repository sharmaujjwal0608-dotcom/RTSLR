# RTSLR architecture

Owner: Agent 00 (orchestrator).

## Shape of the system

```
Browser (everything camera-related stays here)
  camera ──► features/tracking ──► FrameFeatures ──► features/recognition ──► CommitEvent ──► features/language
             MediaPipe landmarker     63-D / 156-D      SignModel + stabiliser                  transcript, speech, export
             smoothing, hand slots    (MODEL_CONTRACTS)  (honest model kinds)

Next.js app (frontend/)            FastAPI (backend/)                 Python pipeline (machine-learning/)
  marketing, studio, learn, R&D      metadata, vocabulary, learning,    dataset → landmarks → features → signer-aware
  static content + local storage     research records, consented        split → train → evaluate → export rtslr-model-1
                                     feedback. Never receives frames.   JSON that the browser adapter can load
```

- **Inference is in the browser.** There is no recognition endpoint, by design: frames and landmarks never leave the device.
- **The backend is optional at runtime.** The site works without it except for sending feedback. It exists so a mobile client or future accounts share one data source.
- **Model honesty is structural.** Every model carries a `kind` (`legacy_asl_prototype`, `experimental_isl_user_trained`, `validated_isl`, `simulator`) and the UI labels come from it. No `validated_isl` model exists yet.

## Repository layout and ownership

| Path | Owner |
|---|---|
| `frontend/src/types/recognition.ts`, `frontend/src/i18n/`, `frontend/next.config.ts`, `docs/*CONTRACTS.md` | Agent 00 |
| `frontend/src/app/globals.css`, `layout.tsx`, `src/components/ui/`, `docs/DESIGN_SYSTEM.md` | Agent 02 |
| `frontend/src/components/layout/`, `components/home/`, pages `/`, `/product`, `/use-cases`, `/about`, `/studio` | Agent 01 |
| `frontend/src/components/hero3d/` | Agent 03 |
| `frontend/src/features/tracking/` | Agent 05 |
| `frontend/src/features/recognition/`, `machine-learning/` | Agent 06 |
| `frontend/src/features/language/` | Agent 10 |
| `frontend/src/app/learn/`, `components/learning/`, `features/learning/` | Agent 09 |
| `frontend/src/app/research/`, `components/research/`, `research/`, `docs/RESEARCH_NOTES.md` | Agent 07 |
| `backend/app/api`, `schemas`, `services`, `core`, `main.py` | Agent 04 |
| `backend/app/db`, `backend/migrations` | Agent 08 |
| `docs/SECURITY_PRIVACY.md` | Agent 12 |
| tests (`frontend/e2e`, cross-feature) | Agent 13 |
| `.github/`, deployment files, `README.md` | Agent 14 |
| Accessibility audit and fixes | Agent 11 |
| Cross-feature acceptance | Agent 15 |

## Routes

`/` Home · `/product` · `/use-cases` · `/learn` (+ `/learn/alphabet`, `/learn/everyday`, `/learn/practice`, `/learn/progress`) · `/research` · `/about` · `/studio` (Get Started) · `/design-system` (internal reference).

## Key decisions

See `DECISIONS.md`.
