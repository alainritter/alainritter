// Reduces raw GitHub data to the fields allowed in public output.
// Private repos keep only: id, private, archived, language, color, size, weeks, lastPush.
const DAY = 86400000;
export const WEEKS = 12;

export function sizeClass(diskUsageKb) {
  return Math.min(5, Math.max(1, Math.floor(Math.log10((diskUsageKb || 0) + 1))));
}

export function bucketWeeks(dates, now) {
  const weeks = new Array(WEEKS).fill(0);
  for (const d of dates) {
    const days = Math.floor((now - new Date(d).getTime()) / DAY);
    const w = WEEKS - 1 - Math.floor(days / 7);
    if (days >= 0 && w >= 0) weeks[w]++;
  }
  return weeks;
}

export function sanitize(raw, now = Date.now()) {
  return [...raw]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((r, id) => {
      const out = {
        id,
        private: r.isPrivate,
        archived: r.isArchived,
        language: r.primaryLanguage?.name ?? null,
        color: r.primaryLanguage?.color ?? "#8b949e",
        size: sizeClass(r.diskUsage),
        weeks: bucketWeeks(r.commitDates ?? [], now),
        lastPush: r.pushedAt ? r.pushedAt.slice(0, 10) : null,
      };
      if (!r.isPrivate) Object.assign(out, { name: r.name, url: r.url, stars: r.stargazerCount });
      return out;
    });
}
