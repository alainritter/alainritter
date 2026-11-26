import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Returns the number of output files containing a private repo name (names are never reported).
export function leakCount(raw, dir) {
  const pub = new Set(raw.filter((r) => !r.isPrivate).map((r) => r.name.toLowerCase()));
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = raw
    .filter((r) => r.isPrivate && r.name.length >= 4 && !pub.has(r.name.toLowerCase()))
    .map((r) => new RegExp(`(^|[^\\w])${esc(r.name)}($|[^\\w])`, "i"));
  let leaks = 0;
  for (const f of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!f.isFile()) continue;
    const text = readFileSync(join(f.parentPath, f.name), "utf8");
    if (patterns.some((re) => re.test(text))) leaks++;
  }
  return leaks;
}
