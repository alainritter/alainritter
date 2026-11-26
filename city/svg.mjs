import { layout } from "./layout.mjs";

const TW = 40; // tile width in px
const TH = 20; // tile height in px
const PAD = 80;
const FOOT = 0.78; // building footprint relative to tile

const THEMES = {
  dark: { bg1: "#080b16", bg2: "#1b1038", grid: "#7c5cff", face: 0.55, side: 0.35, roofMix: 1.15, window: "#ffe9a8", trail: "#00f0ff", text: "#9aa4c7" },
  light: { bg1: "#f1f4ff", bg2: "#d9e2ff", grid: "#5b6bd6", face: 0.85, side: 0.65, roofMix: 1.0, window: "#ffffff", trail: "#0077cc", text: "#44507a" },
};

function shade(hex, f) {
  const n = parseInt(hex.replace("#", ""), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
const f1 = (n) => Math.round(n * 10) / 10;

export function buildingHeight(r) {
  const commits = r.weeks.reduce((a, b) => a + b, 0);
  return 8 + r.size * 5 + Math.min(commits, 40) * 0.55;
}

export function renderSvg(data, themeName = "dark") {
  const t = THEMES[themeName];
  const { tiles, width, height } = layout(data.repos);
  const ox = PAD + (height * TW) / 2;
  const proj = (x, y) => [ox + (x - y) * (TW / 2), PAD + 70 + (x + y) * (TH / 2)];
  const W = Math.ceil(ox + (width * TW) / 2 + PAD);
  const H = Math.ceil(PAD + 70 + ((width + height) * TH) / 2 + PAD / 2);

  const active = tiles.filter((p) => p.repo.weeks[11] > 0).sort((a, b) => b.repo.lastPush.localeCompare(a.repo.lastPush));

  // light trails along the street grid between recently active buildings
  const trails = [];
  for (let i = 0; i < Math.min(active.length - 1, 14); i++) {
    const a = active[i], b = active[i + 1];
    const [ax, ay] = proj(a.x + 0.5, a.y + 0.5);
    const [cx, cy] = proj(b.x + 0.5, a.y + 0.5);
    const [bx, by] = proj(b.x + 0.5, b.y + 0.5);
    trails.push(`<path class="trail" style="animation-delay:${f1(i * 0.7)}s" d="M${f1(ax)} ${f1(ay)}L${f1(cx)} ${f1(cy)}L${f1(bx)} ${f1(by)}"/>`);
  }

  const order = [...tiles].sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
  const rank = new Map(active.map((p, i) => [p.repo.id, i]));
  const hw = (TW / 2) * FOOT, hh = (TH / 2) * FOOT;

  const buildings = order.map(({ repo: r, x, y }) => {
    const [cx, cy] = proj(x + 0.5, y + 0.5);
    const h = buildingHeight(r);
    const top = cy - h;
    const base = r.archived ? "#6b7280" : r.color;
    const edge = themeName === "dark" ? shade(base, 1.4) : shade(base, 0.8);
    const L = `${f1(cx - hw)} ${f1(cy)}`, B = `${f1(cx)} ${f1(cy + hh)}`, R = `${f1(cx + hw)} ${f1(cy)}`;
    const Lt = `${f1(cx - hw)} ${f1(top)}`, Bt = `${f1(cx)} ${f1(top + hh)}`, Rt = `${f1(cx + hw)} ${f1(top)}`, Tt = `${f1(cx)} ${f1(top - hh)}`;
    const isActive = rank.has(r.id);
    const delay = f1((rank.get(r.id) ?? 0) * 0.35);
    let g = `<polygon points="${Lt} ${Bt} ${B} ${L}" fill="${shade(base, t.face)}" stroke="${edge}" stroke-width=".6"/>`;
    g += `<polygon points="${Bt} ${Rt} ${R} ${B}" fill="${shade(base, t.side)}" stroke="${edge}" stroke-width=".6"/>`;
    g += `<polygon points="${Tt} ${Rt} ${Bt} ${Lt}" fill="${shade(base, t.roofMix)}" stroke="${edge}" stroke-width=".8"/>`;
    // windows: dashed lines running down both faces
    const rows = Math.min(5, Math.floor(h / 9));
    let win = "";
    for (let k = 1; k <= rows; k++) {
      const dy = k * (h / (rows + 1));
      win += `M${f1(cx - hw + 2)} ${f1(top + dy + 1)}L${f1(cx - 1.5)} ${f1(top + dy + hh)}`;
      win += `M${f1(cx + 2)} ${f1(top + dy + hh)}L${f1(cx + hw - 2)} ${f1(top + dy + 1)}`;
    }
    if (win) g += `<path class="win${isActive ? " live" : ""}" style="animation-delay:${delay}s" d="${win}" stroke="${t.window}"/>`;
    if (isActive) {
      g += `<line class="beam" style="animation-delay:${delay}s" x1="${f1(cx)}" y1="${f1(top - hh)}" x2="${f1(cx)}" y2="${f1(top - hh - 34)}" stroke="${edge}"/>`;
    }
    return r.private ? `<g>${g}</g>` : `<g><title>${esc(r.name)}</title>${g}</g>`;
  });

  // faint street grid under the city
  let grid = "";
  for (let i = 0; i <= width; i += 1) {
    const [x1, y1] = proj(i, 0), [x2, y2] = proj(i, height);
    grid += `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`;
  }
  for (let j = 0; j <= height; j += 1) {
    const [x1, y1] = proj(0, j), [x2, y2] = proj(width, j);
    grid += `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`;
  }

  const pub = data.repos.filter((r) => !r.private).length;
  const label = `${data.repos.length} repositories · ${pub} public · ${active.length} active this week`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="My repositories as a city, lit by recent commits">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<style>
.grid{fill:none;stroke:${t.grid};stroke-width:.5;opacity:.28}
.trail{fill:none;stroke:${t.trail};stroke-width:2;stroke-linecap:round;stroke-dasharray:3 120;filter:url(#glow);animation:run 5s linear infinite}
.win{fill:none;stroke-width:1.6;stroke-dasharray:2 3;opacity:.55}
.win.live{animation:flicker 3s ease-in-out infinite}
.beam{stroke-width:2;stroke-linecap:round;filter:url(#glow);animation:beam 2.4s ease-in-out infinite}
.label{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;fill:${t.text};letter-spacing:.08em}
@keyframes run{from{stroke-dashoffset:123}to{stroke-dashoffset:0}}
@keyframes flicker{0%,100%{opacity:.35}30%{opacity:1}55%{opacity:.5}80%{opacity:.9}}
@keyframes beam{0%,100%{opacity:.25}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.trail,.win.live,.beam{animation:none}.beam{opacity:.8}}
</style>
<rect width="${W}" height="${H}" fill="url(#bg)"/>
<path class="grid" d="${grid}"/>
${trails.join("\n")}
${buildings.join("\n")}
<text class="label" x="${PAD / 2}" y="${H - 18}">${esc(label)}</text>
</svg>
`;
}
