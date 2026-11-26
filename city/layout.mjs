// Shared by the SVG renderer and the Three.js page: places repos on a tile grid.
// Repos are grouped by language into blocks; blocks are separated by one-tile streets.
const MAX_ROW_TILES = 22;

export function layout(repos) {
  const groups = new Map();
  for (const r of repos) {
    const key = r.language ?? "none";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  const blocks = [...groups.values()]
    .sort((a, b) => b.length - a.length)
    .map((items) => {
      const cols = Math.ceil(Math.sqrt(items.length));
      return { items, cols, rows: Math.ceil(items.length / cols) };
    });

  const tiles = [];
  let x = 0, y = 0, rowH = 0, width = 0;
  for (const b of blocks) {
    if (x > 0 && x + b.cols > MAX_ROW_TILES) {
      x = 0;
      y += rowH + 1;
      rowH = 0;
    }
    b.items.forEach((repo, i) => tiles.push({ repo, x: x + (i % b.cols), y: y + Math.floor(i / b.cols) }));
    x += b.cols + 1;
    rowH = Math.max(rowH, b.rows);
    width = Math.max(width, x - 1);
  }
  return { tiles, width, height: y + rowH };
}
