import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketWeeks, sanitize } from "./sanitize.mjs";

const NOW = Date.parse("2026-11-26T12:00:00Z");
const base = { isArchived: false, diskUsage: 500, stargazerCount: 3, createdAt: "2024-01-01T00:00:00Z", pushedAt: "2026-11-25T08:30:00Z", primaryLanguage: { name: "Go", color: "#00add8" }, url: "https://github.com/x/y", commitDates: [] };

test("private repo keeps only allowed keys", () => {
  const [r] = sanitize([{ ...base, name: "secret-project", isPrivate: true, description: "x" }], NOW);
  assert.deepEqual(Object.keys(r).sort(), ["archived", "color", "id", "language", "lastPush", "private", "size", "weeks"]);
  assert.equal(r.lastPush, "2026-11-25");
});

test("public repo carries name and url", () => {
  const [r] = sanitize([{ ...base, name: "open", isPrivate: false }], NOW);
  assert.equal(r.name, "open");
  assert.equal(r.url, base.url);
});

test("week bucketing", () => {
  const day = (n) => new Date(NOW - n * 86400000).toISOString();
  const weeks = bucketWeeks([day(0), day(6), day(7), day(83), day(84), day(-1)], NOW);
  assert.equal(weeks[11], 2);
  assert.equal(weeks[10], 1);
  assert.equal(weeks[0], 1);
  assert.equal(weeks.reduce((a, b) => a + b, 0), 4);
});
