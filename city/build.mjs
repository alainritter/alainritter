import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchRepos } from "./fetch.mjs";
import { leakCount } from "./gate.mjs";
import { sanitize } from "./sanitize.mjs";
import { renderSvg } from "./svg.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.OUT_DIR ?? "dist";
const token = process.env.GH_TOKEN;
if (!token) {
  console.error("GH_TOKEN is required");
  process.exit(1);
}

const raw = await fetchRepos(token);
const data = { generated: new Date().toISOString().slice(0, 10), repos: sanitize(raw) };

mkdirSync(out, { recursive: true });
writeFileSync(join(out, "city.json"), JSON.stringify(data));
writeFileSync(join(out, "city-dark.svg"), renderSvg(data, "dark"));
writeFileSync(join(out, "city-light.svg"), renderSvg(data, "light"));
for (const f of readdirSync(join(here, "site"))) copyFileSync(join(here, "site", f), join(out, f));
copyFileSync(join(here, "layout.mjs"), join(out, "layout.mjs"));

// privacy gate: no private repo name may appear in any output file
if (leakCount(raw, out) > 0) {
  rmSync(out, { recursive: true, force: true });
  console.error("Privacy gate failed: a private repo name appears in the output. Nothing published.");
  process.exit(1);
}

const pub = data.repos.filter((r) => !r.private).length;
console.log(`city built: ${pub} public, ${data.repos.length - pub} private`);
