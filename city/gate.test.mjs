import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { leakCount } from "./gate.mjs";
import { sanitize } from "./sanitize.mjs";
import { renderSvg } from "./svg.mjs";

const mk = (name, isPrivate) => ({ name, isPrivate, isArchived: false, diskUsage: 900, stargazerCount: 0, createdAt: `2025-0${name.length % 9 + 1}-01T00:00:00Z`, pushedAt: "2026-11-25T00:00:00Z", primaryLanguage: { name: "TypeScript", color: "#3178c6" }, url: `https://github.com/x/${name}`, commitDates: ["2026-11-24T00:00:00Z"] });
const raw = [mk("Hidden-Vault", true), mk("public-one", false), mk("abc", true)];

test("gate detects an injected private name", () => {
  const dir = mkdtempSync(join(tmpdir(), "gate-"));
  writeFileSync(join(dir, "a.txt"), "clean text");
  assert.equal(leakCount(raw, dir), 0);
  writeFileSync(join(dir, "b.txt"), "oops hidden-vault leaked");
  assert.equal(leakCount(raw, dir), 1);
});

test("rendered SVG has no private name and is valid XML", () => {
  const data = { generated: "2026-11-26", repos: sanitize(raw) };
  for (const theme of ["dark", "light"]) {
    const svg = renderSvg(data, theme);
    assert.ok(!/hidden-vault/i.test(svg));
    assert.ok(svg.includes("<title>public-one</title>"));
    const dir = mkdtempSync(join(tmpdir(), "svg-"));
    const f = join(dir, "c.svg");
    writeFileSync(f, svg);
    try {
      execFileSync("xmllint", ["--noout", f]);
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
});
