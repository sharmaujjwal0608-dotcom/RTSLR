# AGENT 09 report

AGENT: 09 — ISL Learning Platform Engineer

ASSIGNED TASK: Build the Learn ISL area (`/learn`, `/learn/alphabet`, `/learn/everyday`, `/learn/practice`, `/learn/progress`, `/learn/sign/[id]`) around the fact that RTSLR has no verified ISL demonstration media and no validated ISL model: typed content, search, lessons, checkable practice, progress with local persistence, English and Hindi interface, and a media slot that accepts verified media later without rework.

OWNED FILES:
- `frontend/src/app/learn/**`
- `frontend/src/components/learning/**`
- `frontend/src/features/learning/**`
- `docs/agent-reports/AGENT_09.md`

DEPENDENCIES:
- `@/components/ui` primitives and design tokens (Agent 02). No new colours, sizes, radii, shadows or keyframes were added.
- `@/i18n` (`defineMessages`, `useMessages`, `useI18n`).
- `@/features/language/vocabulary` (Agent 10): type import only in shipped code (`VocabularyKind`); `BUILTIN_ENTRIES` is imported at runtime only inside `content.test.ts`.
- `research/data/datasets.json` `ds-islrtc-dictionary` (`verified: false`, URL `https://islrtc.nic.in/`) and `references.json` `ref-islrtc-home` (Agent 07).
- `backend/app/db/seed_data/curriculum.json` and `sign_id_for` in `backend/app/db/seed.py` for ids.
- `/studio` (another agent): linked from the Practice page; the route did not exist in `src/app` when this was written.
- No packages added.

IMPLEMENTED FEATURES:

Routes
- `/learn`: header, sub-navigation, honesty notice, "continue where you left off", search (English and Hindi), category filter rail (radio group, sticky from `lg`; a `Select` below `lg`), progress summary, underline tabs Signs / Lessons / Favourites, practice entry.
- `/learn/alphabet`: Alphabet and Numbers. Notice that ISL fingerspelling is largely two-handed, similar to BSL and unlike ASL, that the per-letter inventory is unconfirmed, and that demonstrations are pending. Lessons plus a tile grid of A–Z and 0–9.
- `/learn/everyday`: Greetings, Everyday, Family, Questions, Time and days, Places, each with lessons and an item list.
- `/learn/practice`: tabs Meaning quiz / Self-check / Camera.
- `/learn/progress`: summary, 14-day activity strip, lessons, quiz history table, favourites, export and reset.
- `/learn/sign/[id]`: statically generated for all 104 ids with `generateStaticParams`; `params` is awaited (Next 16); unknown ids call `notFound()`. `dynamicParams` is not exported because it is unsupported with `cacheComponents`. Params are typed by hand rather than with the generated `PageProps<'/learn/sign/[id]'>` because `.next/types` had not been regenerated for this route.

Content (`features/learning/content.ts`)
- 8 categories, 104 sign items, 16 lessons. Item shape `{ id, category, en, hi, kind, media: null, source, recognition: "none", classId, hiReviewed }`.
- Every shipped item has `media: null` and `recognition: "none"` (asserted by a test).
- Ids equal the backend seed ids (`isl-<category>-<slug>`); lesson ids and contents equal the seed (asserted by a test that reads the seed file).

Components (`components/learning`)
- `SignMedia`: pending state and verified image/video state (replay, playback speed 0.5×/0.75×/1×, captions on/off, caption language).
- `LearnOverview`, `CategoryStudy`, `LessonPlayer`, `PracticeHub`, `MeaningQuiz`, `SelfPractice`, `ProgressDashboard`, `SignDetail`, `SignCard`, and `shared.tsx` (`LearnNav`, `StorageNotice`, `FavouriteButton`, `SourceBadge`).

Lessons
- Open a lesson inline, step through items, mark complete, restart. The position is stored, so reopening resumes at the same item. `/learn/...#lesson-<id>` opens that lesson (used by "Resume lesson" and the lesson links).

Practice
1. Meaning quiz, English→Hindi or Hindi→English, 5/10/15 questions, by category. Native radio group in a `fieldset`, feedback in a persistent `aria-live` region, correct and chosen options marked with icon and words. Letters are excluded because their Hindi form is the same Latin letter.
2. Self-check: shows the word and the dictionary link; the learner rates "Got it" / "Need practice". Leitner boxes 1–5 with intervals 0, 1, 3, 7, 14 days. States plainly that RTSLR cannot assess signing.
3. Camera: explanation and link to `/studio`. States that a match means "the same as my own recording", not "correct ISL". No camera code.

Progress store (`features/learning/progressStore.ts`)
- Storage keys: `rtslr.learning.progress` (the record) and `rtslr.learning.probe` (written and removed at once to test writability). Exported as `LEARNING_STORAGE_KEYS`, with `LEARNING_STORAGE_PREFIX = "rtslr.learning."`.
- Schema number `1` in the record; full validation on read; a `migrate()` hook for later schemas.
- An unreadable or newer record is left untouched and reported (`storage: "invalid"`); the pages keep working in memory and show a notice; Reset removes it.
- Missing storage, throwing storage or refused writes: in-memory fallback (`storage: "memory"`) with a visible notice on every learning page.
- Export downloads `rtslr-learning-progress-<date>.json`. Reset has a confirmation step.

Honesty and privacy
- No sign is drawn or described anywhere. No automated right/wrong feedback on signing.
- No `innerHTML`, `eval`, camera or recording APIs. The only external URL is the ISLRTC link, opened by the user in a new tab. Storage keys start with `rtslr`.

FILES CREATED OR MODIFIED:

Created (none modified outside the owned paths):
- `frontend/src/app/learn/page.tsx`, `alphabet/page.tsx`, `everyday/page.tsx`, `practice/page.tsx`, `progress/page.tsx`, `sign/[id]/page.tsx`
- `frontend/src/components/learning/`: `CategoryStudy.tsx`, `LearnOverview.tsx`, `LessonPlayer.tsx`, `MeaningQuiz.tsx`, `PracticeHub.tsx`, `ProgressDashboard.tsx`, `SelfPractice.tsx`, `SignCard.tsx`, `SignDetail.tsx`, `SignMedia.tsx`, `shared.tsx`, `MeaningQuiz.test.tsx`, `SignMedia.test.tsx`
- `frontend/src/features/learning/`: `content.ts`, `search.ts`, `quiz.ts`, `srs.ts`, `lessons.ts`, `progressStore.ts`, `useProgress.ts`, `index.ts`, `content.test.ts`, `search.test.ts`, `quiz.test.ts`, `srs.test.ts`, `progressStore.test.ts`
- `docs/agent-reports/AGENT_09.md`

TESTS RUN (from `frontend/`, 2026-11-21):
1. `npx tsc --noEmit -p .`
2. `npx eslint src/app/learn src/components/learning src/features/learning`
3. `npx vitest run src/features/learning src/components/learning`

Not run: `next build`, `next dev`, Playwright, any browser. The pages have never been rendered in a browser.

TEST RESULTS:
1. `tsc`: 0 errors in the whole project at the time of the run.
2. `eslint`: exit 0, no errors or warnings.
3. Vitest: `Test Files 7 passed (7)`, `Tests 121 passed (121)`, duration 6.97s.

| File | Tests |
| --- | --- |
| `features/learning/progressStore.test.ts` | 45 |
| `components/learning/SignMedia.test.tsx` | 19 |
| `features/learning/srs.test.ts` | 17 |
| `features/learning/content.test.ts` | 11 |
| `features/learning/quiz.test.ts` | 11 |
| `features/learning/search.test.ts` | 11 |
| `components/learning/MeaningQuiz.test.tsx` | 7 |

Two failures were found and fixed before the final run: an ESLint `react-hooks/immutability` error in the caption-track effect (replaced by a ref callback on the `<track>`), and a store that reported `local` after a reset when reads throw (the probe now reads the value back).

KNOWN LIMITATIONS:
- **Not seen in a browser.** Layout, responsive behaviour at 320px, Hindi wrapping, focus order and the static build of `/learn/sign/[id]` are unverified. The component tests cover structure and behaviour in jsdom only.
- **No demonstration media.** Every item shows the pending state. The verified image/video path is tested with invented mock entries in `SignMedia.test.tsx` only; real video playback, caption rendering and `textTracks` behaviour were not exercised (jsdom does not play media).
- **Dictionary link.** It points to `https://islrtc.nic.in/` (ISLRTC home page, opened by Agent 07), not to a per-word dictionary page, because the dictionary site could not be opened from this network. The link is labelled "official dictionary (link not verified from our network)" while `DICTIONARY_SOURCE.verified` is `false`.
- **Hindi is pending native review.** All interface Hindi in these files and all 78 Hindi glosses (`hiReviewed: false`) were written by a non-native author. Letters keep their Latin form and are not glosses.
- **Fingerspelling statement.** "Largely two-handed, similar to BSL" follows `ref-nios-isl-history`; which letters are one-handed, two-handed or need movement is unconfirmed (assumptions A1, A2 in `RESEARCH_NOTES.md`) and the page says so.
- Progress is per browser. There is no import of an exported file and no sync with the backend API.
- The streak and "due today" use the device's local calendar day.
- Lessons open inline on the category pages; there is no separate lesson URL beyond the `#lesson-<id>` fragment.
- Quiz feedback moves focus to the "Next question" button after checking; the announcement relies on the `aria-live` region. Not tested with a screen reader.

INTEGRATION NOTES:
- **Site header / footer:** add a "Learn ISL" link to `/learn`. The learning pages render their own sub-navigation (`LearnNav`).
- **Global "delete my local data" control:** `import { LEARNING_STORAGE_KEYS, progressStore } from "@/features/learning"`, then either `progressStore.reset()` or remove every key in `LEARNING_STORAGE_KEYS` and call `progressStore.reload()`.
- **Studio:** `/learn/practice` links to `/studio` and describes it as: record your own samples, an experimental recogniser says whether a later attempt matches your own recording, frames stay on the device. If the Studio does not do exactly this, the copy in `PracticeHub.tsx` must change.
- **Backend seed difference (one item):** "Welcome" is `स्वागत है` here (Agent 10's vocabulary gloss) and `स्वागत` in `curriculum.json`. A test pins this as the only Hindi difference. Digits use the seed's number words (`शून्य` … `नौ`) rather than Agent 10's Latin-stays-Latin display rule, because here they are meanings, not transcript output.
- **Design system requests:** (1) an icon-only button variant and a pressed/toggle state on `Button` (favourite and save toggles currently use a ghost button whose label changes); (2) a radio/choice-row primitive (the quiz options and the category rail style native radios with tokens); (3) `Badge` cannot wrap, so long status text was kept out of badges.
- **Generated route types:** after the next `next dev`/`next typegen`, `sign/[id]/page.tsx` can switch its hand-written `Props` to `PageProps<'/learn/sign/[id]'>`.

### Adding verified media later

Set `media` on the item in `frontend/src/features/learning/content.ts` (today every item gets `media: null` in the `SIGNS` builder; add a lookup by sign id there). The exact shape, exported as `SignMedia` from that file:

```ts
type SignMedia = {
  type: "image" | "video";
  src: string;                 // same-origin path, e.g. "/learning/media/isl-greetings-hello.mp4"
  alt: { en: string; hi: string };   // text alternative, taken from or checked against the source
  poster?: string;             // video only, same-origin still image
  captions: {                  // video only; [] when there is nothing to caption
    src: string;               // same-origin WebVTT file
    srcLang: "en" | "hi";
    label: string;             // shown in the language picker, e.g. "English"
  }[];
  credit: string;              // who made the demonstration
  licence: { name: string; url?: string };
  sourceUrl: string;           // page the media was taken from
  verifiedOn: string;          // ISO date a named reviewer checked it against the source
};
```

Requirements: files must be served from the same origin (the CSP allows `img-src` and `media-src` from `'self'` only); the licence must permit display by RTSLR (Agent 07 notes that written permission from ISLRTC should be sought); `alt` must not be an invented description of the sign. When an entry is present, `SignMedia`, the lesson player, self-check practice and the sign page show it with no other change, and the badge changes from "Pending verified source" to "Verified source". When the dictionary pages have been opened and confirmed, set `DICTIONARY_SOURCE.verified` to `true` (and ideally the URL to the dictionary itself) to drop the "not verified" wording.

STATUS: TESTED (unit and component tests, type check and lint executed and passing; not built and not checked in a browser)
