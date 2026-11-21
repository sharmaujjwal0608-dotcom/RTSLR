// Copies the MediaPipe wasm runtime out of node_modules so it is served
// same-origin from /mediapipe/wasm (no third-party CDN at runtime).
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = join(root, "public", "mediapipe", "wasm");
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log("MediaPipe wasm copied to public/mediapipe/wasm");
