// Copies the research records from ../research/data into the frontend so the
// R&D page can import them at build time (no runtime request, no backend).
//
//   node scripts/sync-research-data.mjs           copy
//   node scripts/sync-research-data.mjs --check   exit 1 if a copy is missing or stale
//
// Source of truth: RTSLR/research/data/*.json (owner: Agent 07).
// Copies:          frontend/src/content/research/data/*.json (generated; do not edit).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILES = [
  "datasets.json",
  "published-benchmarks.json",
  "references.json",
  "roadmap.json",
  "rtslr-experiments.json",
];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "..", "research", "data");
const to = join(root, "src", "content", "research", "data");
const check = process.argv.includes("--check");

/** Line endings are normalised so a checkout with CRLF does not look stale. */
function read(path) {
  return readFileSync(path, "utf8").replace(/\r\n/g, "\n");
}

if (!existsSync(from)) {
  // A frontend-only checkout (for example a container image) keeps the
  // committed copies.
  console.log(`research data: ${from} not found, keeping the existing copies`);
  process.exit(0);
}

let stale = 0;
if (!check) mkdirSync(to, { recursive: true });

for (const file of FILES) {
  const source = read(join(from, file));
  const parsed = JSON.parse(source); // fail loudly on malformed JSON
  if (!Array.isArray(parsed)) throw new Error(`${file}: expected a JSON array`);

  const target = join(to, file);
  const current = existsSync(target) ? read(target) : null;
  if (current === source) continue;

  if (check) {
    stale += 1;
    console.error(`research data: ${file} is ${current === null ? "missing" : "out of date"}`);
  } else {
    writeFileSync(target, source);
    console.log(`research data: copied ${file} (${parsed.length} records)`);
  }
}

if (check && stale > 0) {
  console.error("Run `node scripts/sync-research-data.mjs` in frontend/.");
  process.exit(1);
}
console.log(check ? "research data: copies are up to date" : "research data: done");
