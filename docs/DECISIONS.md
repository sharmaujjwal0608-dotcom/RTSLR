# Decisions

| # | Decision | Why |
|---|---|---|
| 1 | One working tree with strict per-agent file ownership instead of one git worktree per agent. | Each worktree would need its own `node_modules` (about 500 MB and several minutes on this machine), and fifteen merges add risk without benefit when ownership is disjoint. Agents may not edit outside their paths. |
| 2 | All recognition runs in the browser; no server inference endpoint. | Privacy (frames never leave the device) and latency. |
| 3 | The reference screenshot was not available to the build. | It did not arrive in the session. The design follows the written description of it; the hero should be tuned against the image once supplied. |
| 4 | No validated ISL model ships. The ISL path is a user-trained k-NN over coordinated two-hand features, labelled experimental. | No ISL dataset or trained model exists locally, and research found no verified, freely downloadable, multi-signer static ISL alphabet dataset. Inventing a model or an accuracy number is not acceptable. |
| 5 | The legacy ASL rule classifier is kept, ported and labelled "Legacy ASL prototype". | It is the existing working functionality; it is not ISL and is never presented as such. |
| 6 | Learning content has no sign demonstrations yet; items link to the ISLRTC dictionary and are marked "media pending". | No verified ISL media is licensed to the project. Describing sign formation from memory risks teaching wrong signs. |
| 7 | MediaPipe wasm is self-hosted; the hand model is fetched from Google's MediaPipe bucket unless `NEXT_PUBLIC_HAND_MODEL_URL` points elsewhere. | Removes the CDN script dependency of the prototype. Self-hosting the 7.8 MB model file is a deployment choice. |
| 8 | SQLite by default, PostgreSQL through `DATABASE_URL`. | Zero-setup local run; nothing in v1 needs more. |
| 9 | Interface localisation is client-side (`useMessages`) with co-located English/Hindi strings. | Keeps fifteen agents out of one shared dictionary file. |
| 10 | Unsourced numbers from the prototype's benchmark chart are dropped; published results are shown as a table with protocol and caveat, never a ranked chart. | Research verification: two bars had no source, and the chart mixed accuracy and mAP across datasets. |
| 11 | PyTorch, OpenCV and MediaPipe-Python are not installed; sequence training and image-to-landmark extraction are written but not executed. | No dataset to run them on; avoids multi-gigabyte installs with nothing to verify. |
