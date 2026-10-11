import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Studio} from '../dist/studio.js';
import {bodies} from '../dist/astro.js';
import {readFileSync} from 'node:fs';

// Exercise actual scene geometry without requiring a GPU. Only text and image loading are stubbed.
function studio(aspect = 1.5) {
  const s = Object.create(Studio.prototype);
  Object.assign(s, {scene: new THREE.Scene(), root: new THREE.Group(), camera: new THREE.PerspectiveCamera(40, aspect, .01, 4000), host: {clientWidth: 600 * aspect, clientHeight: 600}, cache: {}, reducedMotion: false});
  s.scene.add(s.root);
  s.controls = {target: new THREE.Vector3(), update: () => { s.camera.lookAt(s.controls.target); s.camera.updateMatrixWorld(); }};
  for (const name of ['sunLight', 'key', 'ambient']) s[name] = new THREE.PointLight();
  s.texture = name => s.cache[name] ||= new THREE.Texture();
  s.glowTexture = () => s.texture('glow');
  s.starfield = () => {};
  s.label = (parent, text, pos) => { const o = new THREE.Object3D(); o.name = text; o.position.copy(pos); parent.add(o); return o; };
  s.phaseInset = () => { const o = new THREE.Object3D(); o.userData.draw = (angle, red) => { s.inset = [angle, red]; }; return o; };
  s.renderer = {getPixelRatio: () => 1};
  return s;
}
const s = studio(), update = s.process('seasons');
const earth = s.root.getObjectByName('season-earth'), axis = s.root.getObjectByName('season-axis');
for (const [p, expected] of [[0, 0], [.25, 1], [.5, 0], [.75, -1]]) {
  update(p); s.root.updateMatrixWorld(true);
  const north = new THREE.Vector3(0, 1, 0).transformDirection(axis.matrixWorld);
  const sunlight = earth.position.clone().negate().normalize();
  const dot = north.dot(sunlight);
  if (expected === 0) assert.ok(Math.abs(dot) < 1e-12, `Equinox at ${p}`);
  else assert.ok(dot * expected > .39, `North-pole illumination at ${p}`);
}
update(.25); const rotation = axis.children[0].rotation.y; update(.25); assert.equal(axis.children[0].rotation.y, rotation, 'Scrubbing must be deterministic');

const eclipse = s.process('eclipse'); eclipse(.875); s.root.updateMatrixWorld(true);
for (const name of ['earth-shadow', 'moon-shadow']) {
  const cone = s.root.getObjectByName(name), height = cone.geometry.parameters.height;
  const tip = new THREE.Vector3(0, height / 2, 0).applyMatrix4(cone.matrixWorld);
  const base = new THREE.Vector3(0, -height / 2, 0).applyMatrix4(cone.matrixWorld);
  assert.ok(tip.x > base.x, `${name}: umbra must narrow away from the Sun`);
}
const phases = s.process('phases');
for (let i = 0; i < 4; i++) { phases(i / 4); assert.ok(Math.abs(s.inset[0] - i * Math.PI / 2) < 1e-12); }

for (const aspect of [1.5, .6]) for (const real of [false, true]) {
  const scene = studio(aspect); scene.system(2461300.5, real);
  for (const [id, p] of Object.entries(scene.planets)) {
    const v = p.g.position.clone().project(scene.camera);
    assert.ok(Math.abs(v.x) < .94 && Math.abs(v.y) < .94 && v.z < 1, `${id} outside initial ${real ? 'real' : 'compact'} viewport at aspect ${aspect}`);
  }
}
const stars = JSON.parse(readFileSync(new URL('../dist/data/stars.json', import.meta.url))), cons = JSON.parse(readFileSync(new URL('../dist/data/constellations.json', import.meta.url)));
s.sky(stars, cons, 2461300.5, 51.514, 7.466); s.lookAt(40, 90); s.camera.fov = 35;
s.sky(stars, cons, 2461300.6, 51.514, 7.466);
assert.equal(s.camera.fov, 35); assert.ok(Math.abs(s.skyLook[0] - 40) < .001 && Math.abs(s.skyLook[1] - 90) < .001);
for (const b of s.visible.filter(b => b.alt <= 0)) assert.equal(s.root.getObjectByName(b.name), undefined, `${b.name}: label leaks through ground`);
s.controls.autoRotate = true; s.body(bodies.find(b => b.id === 'earth'), {rotation: 24, obliquity: 23.4}); assert.equal(s.controls.autoRotate, false);
s.reducedMotion = true; s.body(bodies.find(b => b.id === 'earth'), {rotation: 24, obliquity: 23.4}); assert.equal(s.spinning, false);
for (const id of ['venus', 'uranus']) {
  s.reducedMotion = false; s.body(bodies.find(b => b.id === id), {rotation: -24, obliquity: id === 'venus' ? 177.4 : 97.8});
  s.tick(1, 1); const spin = s.root.getObjectByName('body-spin'); s.root.updateMatrixWorld(true);
  const momentum = new THREE.Vector3(0, Math.sign(spin.rotation.y), 0).transformDirection(spin.matrixWorld);
  assert.ok(momentum.y < 0, `${id}: retrograde rotation must not be reversed twice`);
}
console.log('PASS scenes: seasons, umbra direction, moon phases, camera framing, sky view/zoom, horizon labels, reduced motion, retrograde rotation');
