import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { layout } from "./layout.mjs";

const data = await (await fetch("city.json")).json();
const { tiles, width, height } = layout(data.repos);
const pub = data.repos.filter((r) => !r.private).length;
document.getElementById("stats").textContent = `${data.repos.length} repos · ${pub} public · ${data.generated}`;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a14);
scene.fog = new THREE.FogExp2(0x070a14, 0.018);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 400);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const cx = width / 2, cz = height / 2;
const span = Math.max(width, height);
camera.position.set(cx + span * 0.7, span * 0.6, cz + span * 0.7);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(cx, 0, cz);
controls.enableDamping = true;
controls.autoRotate = !matchMedia("(prefers-reduced-motion: reduce)").matches;
controls.autoRotateSpeed = 0.5;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.5, 0.55));
composer.addPass(new OutputPass());

scene.add(new THREE.AmbientLight(0x6070aa, 0.8));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(10, 20, 5);
scene.add(sun);
const grid = new THREE.GridHelper(Math.max(width, height) + 2, Math.max(width, height) + 2, 0x7c5cff, 0x2a2060);
grid.position.set(cx, 0, cz);
scene.add(grid);

const buildings = tiles.map(({ repo, x, y }) => {
  const color = repo.archived ? 0x6b7280 : new THREE.Color(repo.color);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.1, roughness: 0.5, metalness: 0.4 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.78, 1, 0.78), mat);
  mesh.position.x = x + 0.5;
  mesh.position.z = y + 0.5;
  mesh.userData = { repo };
  scene.add(mesh);
  return mesh;
});

const baseHeight = (r) => 0.25 + r.size * 0.25;
function showWeek(w) {
  for (const m of buildings) {
    const r = m.userData.repo;
    const cumulative = r.weeks.slice(0, w + 1).reduce((a, b) => a + b, 0);
    const h = baseHeight(r) + Math.min(cumulative, 60) * 0.05;
    m.scale.y = h;
    m.position.y = h / 2;
    m.material.emissiveIntensity = r.weeks[w] > 0 ? 0.45 + Math.min(r.weeks[w], 10) * 0.04 : 0.08;
  }
  document.getElementById("weekLabel").textContent = w === 11 ? "now" : `${11 - w} weeks ago`;
}

const slider = document.getElementById("week");
let timer = null;
const play = document.getElementById("play");
slider.addEventListener("input", () => {
  clearInterval(timer);
  timer = null;
  play.textContent = "Play";
  showWeek(Number(slider.value));
});
play.addEventListener("click", () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    play.textContent = "Play";
    return;
  }
  slider.value = 0;
  showWeek(0);
  play.textContent = "Pause";
  timer = setInterval(() => {
    const next = Number(slider.value) + 1;
    if (next > 11) {
      clearInterval(timer);
      timer = null;
      play.textContent = "Play";
      return;
    }
    slider.value = next;
    showWeek(next);
  }, 700);
});
showWeek(11);

const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tip = document.getElementById("tip");
renderer.domElement.addEventListener("pointermove", (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(buildings)[0];
  if (!hit) {
    tip.style.display = "none";
    return;
  }
  const r = hit.object.userData.repo;
  tip.textContent = r.private ? "private repo" : r.name;
  if (!r.private) {
    tip.textContent = "";
    const a = document.createElement("a");
    a.href = r.url;
    a.textContent = r.name;
    tip.append(a);
  }
  tip.style.display = "block";
  tip.style.left = `${e.clientX + 14}px`;
  tip.style.top = `${e.clientY + 14}px`;
});
let down = null;
renderer.domElement.addEventListener("pointerdown", (e) => {
  down = [e.clientX, e.clientY];
});
renderer.domElement.addEventListener("click", (e) => {
  // a drag (orbit) also ends in a click: ignore it
  if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  const hit = ray.intersectObjects(buildings)[0];
  const r = hit?.object.userData.repo;
  if (r && !r.private) window.open(r.url, "_blank", "noopener");
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  composer.render();
});
