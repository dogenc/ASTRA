import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {helio, orbitPoints, altAz, geocentric, moonPhase, PLANETS, layers} from './astro.js';
const D2R = Math.PI / 180;
// Ekliptik (x, y, z) → Szene (x, z, −y): Ekliptik liegt waagerecht.
const ecl = ([x, y, z], s = 1) => new THREE.Vector3(x * s, z * s, -y * s);

export class Studio {
  constructor(host, onPick) {
    this.host = host; this.onPick = onPick; this.scene = new THREE.Scene(); this.tex = new THREE.TextureLoader(); this.cache = {};
    this.renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setClearColor(0, 0); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.15; host.append(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(40, 1, .01, 4000); this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; this.controls.autoRotateSpeed = .6; this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; this.controls.enableDamping = !this.reducedMotion;
    this.ambient = new THREE.AmbientLight(0xbfcaff, .35); this.scene.add(this.ambient);
    this.sunLight = new THREE.PointLight(0xfff3dd, 3.2, 0, 0); this.scene.add(this.sunLight);
    this.key = new THREE.DirectionalLight(0xfff6e8, 3); this.key.position.set(-8, 3, 6); this.scene.add(this.key);
    this.root = new THREE.Group(); this.scene.add(this.root); this.tick = () => {}; this.time = 0; this.active = true; this.bounds = 8; this.pickables = [];
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(host);
    const ray = new THREE.Raycaster(); let down = null;
    host.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
    host.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const r = host.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.camera);
      const hit = ray.intersectObjects(this.pickables, true).find(h => h.object.userData.pick);
      onPick(hit?.object.userData.pick || null);
    });
    this.renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); this.active = false; onPick({label: 'Grafikkontext verloren. Bitte die Seite neu laden.'}); });
    this.renderer.domElement.addEventListener('wheel', e => { if (!this.skyMode) return; e.preventDefault(); this.camera.fov = THREE.MathUtils.clamp(this.camera.fov * (e.deltaY > 0 ? 1.08 : .92), 15, 100); this.camera.updateProjectionMatrix(); }, {passive: false});
    let previous = performance.now();
    this.renderer.setAnimationLoop(now => { const dt = Math.min((now - previous) / 1000, .05); previous = now; if (document.hidden || !this.active) return; this.time += dt; this.tick(this.time, dt); this.controls.update(); if (this.backgroundSphere) this.backgroundSphere.position.copy(this.camera.position); this.renderer.render(this.scene, this.camera); });
    this.controls.addEventListener('change', () => {
      if (!this.skyMode) return;
      const dir = this.camera.getWorldDirection(new THREE.Vector3());
      this.skyLook = [Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)) / D2R, ((Math.atan2(dir.x, -dir.z) / D2R) + 360) % 360];
    });
    this.resize();
  }
  resize() { const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return; const aspect = w / h; if (this.homeView && !this.skyMode) { const factor = Math.min(1, this.camera.aspect) / Math.min(1, aspect); this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target); } this.camera.aspect = aspect; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); }
  texture(name) {
    if (!this.cache[name]) { const t = this.tex.load(`tex/${name}`); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; this.cache[name] = t; }
    return this.cache[name];
  }
  view(dist, dir = [.25, .35, 1], target = [0, 0, 0]) {
    this.skyMode = false; this.camera.fov = 40; this.camera.near = .01; this.camera.far = Math.max(4000, dist * 8 / Math.min(1, this.host.clientWidth / Math.max(this.host.clientHeight, 1)) + 2000); this.camera.updateProjectionMatrix();
    this.controls.enableDamping = !this.reducedMotion; this.controls.enableZoom = true; this.controls.enablePan = false; this.controls.rotateSpeed = 1; this.controls.minDistance = dist * .25; this.controls.maxDistance = dist * 6;
    const aspect = this.host.clientWidth / Math.max(this.host.clientHeight, 1), d = dist / Math.min(1, aspect), v = new THREE.Vector3(...dir).normalize().multiplyScalar(d);
    this.controls.target.set(...target); this.camera.position.set(target[0] + v.x, target[1] + v.y, target[2] + v.z); this.controls.update(); this.homeView = [dist, dir, target];
  }
  reset() { if (this.skyMode) { this.camera.fov = 70; this.camera.updateProjectionMatrix(); this.lookAt(this.skyHome[0], this.skyHome[1]); } else if (this.homeView) this.view(...this.homeView); }
  clear() {
    this.tick = () => {}; this.pickables = []; this.skyMode = false; this.controls.autoRotate = false;
    this.root.traverse(o => { o.geometry?.dispose(); if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) { if (m.map && !Object.values(this.cache).includes(m.map)) m.map.dispose(); m.dispose(); } });
    this.root.clear(); this.backgroundSphere = null; this.root.rotation.set(0, 0, 0); this.scene.background = null; this.sunLight.intensity = 3.2; this.key.intensity = 0; this.ambient.intensity = .35;
  }
  label(parent, text, pos, {color = '#e9ecff', size = 1, bg = '#0e1430cc', screen = false} = {}) {
    const c = document.createElement('canvas'), ctx = c.getContext('2d'); ctx.font = '600 40px Inter,sans-serif'; const w = Math.ceil(ctx.measureText(text).width) + 44;
    c.width = w; c.height = 72; ctx.font = '600 40px Inter,sans-serif'; ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(4, 6, w - 8, 60, 30); ctx.fill();
    ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.fillText(text, 22, 38);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: t, depthTest: false, transparent: true, sizeAttenuation: !this.skyMode && !screen}));
    const h = screen ? .024 * size : this.skyMode ? .085 * size : .55 * size; sp.scale.set(h * w / 72, h, 1); sp.center.set(.5, -.35); sp.position.copy(pos); sp.renderOrder = 10; parent.add(sp); return sp;
  }
  line(parent, pts, color, opacity = .5) {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({color, transparent: true, opacity, depthWrite: false})); parent.add(l); return l;
  }
  sphere(r, mat, seg = 64) { return new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg / 2), mat); }
  starfield() { const bg = this.sphere(1800, new THREE.MeshBasicMaterial({map: this.texture('milkyway.jpg'), side: THREE.BackSide, color: 0x8a90a8, depthWrite: false}), 48); bg.renderOrder = -1; this.backgroundSphere = bg; bg.position.copy(this.camera.position); this.root.add(bg); }

  /* ---------- Sonnensystem ---------- */
  system(jd, real = false) {
    this.clear(); this.starfield(); this.key.intensity = 0; this.ambient.intensity = .18;
    const dist = r => real ? r * 12 : 4 + 11 * Math.log1p(r / .25), size = d => real ? 1.2 + 1.1 * Math.pow(d / 12756, .5) : .75 + .6 * Math.pow(d / 12756, .42), extent = [];
    const sun = this.sphere(real ? 6 : 2.3, new THREE.MeshBasicMaterial({map: this.texture('sun.jpg')}));
    sun.userData.pick = {id: 'sun', label: 'Sonne'}; this.root.add(sun); this.pickables.push(sun);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({map: this.glowTexture(), color: 0xffc46b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
    glow.scale.setScalar(real ? 26 : 7); this.root.add(glow);
    this.planets = {};
    const diam = {mercury: 4879, venus: 12104, earth: 12756, mars: 6792, jupiter: 142984, saturn: 120536, uranus: 51118, neptune: 49528};
    const names = {mercury: 'Merkur', venus: 'Venus', earth: 'Erde', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptun'};
    for (const id of PLANETS) {
      const pts = orbitPoints(id, jd).map(p => { const r = Math.hypot(...p); return ecl(p, dist(r) / r); });
      extent.push(...pts); this.line(this.root, pts, '#8ea2ff', .28);
      const g = new THREE.Group(), r = size(diam[id]);
      const mesh = this.sphere(r, new THREE.MeshStandardMaterial({map: this.texture(id + '.jpg'), roughness: 1, metalness: 0}), 40);
      mesh.userData.pick = {id, label: names[id]}; g.add(mesh); this.pickables.push(mesh);
      if (id === 'saturn') g.add(this.rings(r)); this.label(g, names[id], new THREE.Vector3(0, r * 1.15, 0), {size: 1.4, screen: true});
      this.root.add(g); this.planets[id] = {g, mesh};
    }
    this.place = jd2 => { for (const id of PLANETS) { const p = helio(id, jd2), r = Math.hypot(...p); this.planets[id].g.position.copy(ecl(p, dist(r) / r)); this.planets[id].mesh.rotation.y += .01; } };
    this.place(jd); this.sunLight.position.set(0, 0, 0);
    // Fit the complete orbital plane to the viewport, rather than an oversized bounding sphere.
    const aspect = this.host.clientWidth / Math.max(this.host.clientHeight, 1), direction = new THREE.Vector3(0, .9, 1).normalize(), up = new THREE.Vector3(0, direction.z, -direction.y), tan = Math.tan(20 * D2R);
    const distance = Math.max(...extent.map(v => direction.dot(v) + Math.max(Math.abs(v.x) / (tan * aspect), Math.abs(up.dot(v)) / tan) / .82));
    this.view(distance * Math.min(1, aspect), [0, .9, 1]);
  }
  glowTexture() {
    if (this.cache.glow) return this.cache.glow;
    const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d'), g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(.25, 'rgba(255,190,90,.55)'); g.addColorStop(1, 'rgba(255,150,40,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    return this.cache.glow = new THREE.CanvasTexture(c);
  }
  rings(r) {
    const geo = new THREE.RingGeometry(r * 1.24, r * 2.27, 128, 1), pos = geo.attributes.position, uv = geo.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - r * 1.24) / (r * 1.03), .5); }
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({map: this.texture('saturn-ring.png'), color: 0xf0e2c0, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1, emissive: 0x3a3226, emissiveMap: this.texture('saturn-ring.png')}));
    m.rotation.x = -Math.PI / 2; return m;
  }

  /* ---------- Einzelner Himmelskörper ---------- */
  body(meta, facts, cutaway = false) {
    this.clear(); this.starfield(); this.sunLight.intensity = 0; this.key.intensity = meta.id === 'sun' ? 0 : 3.3; this.ambient.intensity = meta.id === 'sun' ? 1 : .22;
    const R = 2, tilt = (facts?.obliquity ?? meta.tilt ?? 0) * D2R, pivot = new THREE.Group(); pivot.rotation.z = -tilt; this.root.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    const matFor = r => meta.id === 'sun' ? new THREE.MeshBasicMaterial({map: this.texture('sun.jpg'), side: THREE.DoubleSide}) : new THREE.MeshStandardMaterial({map: meta.tex ? this.texture(meta.tex + '.jpg') : null, color: meta.tex ? 0xffffff : meta.color, roughness: 1, metalness: 0, side: THREE.DoubleSide});
    const shell = cutaway ? new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48, Math.PI * .25, Math.PI * 1.5), matFor(R)) : this.sphere(R, matFor(R), 96);
    shell.userData.pick = {label: meta.name}; spin.add(shell); this.pickables.push(shell);
    if (meta.clouds && !cutaway) { const cl = this.sphere(R * 1.012, new THREE.MeshStandardMaterial({alphaMap: this.texture('earth-clouds.jpg'), transparent: true, depthWrite: false, color: 0xffffff, roughness: 1}), 96); spin.add(cl); this.clouds = cl; } else this.clouds = null;
    if (meta.ring) pivot.add(this.rings(R));
    if (meta.id === 'sun' && !cutaway) { const glow = new THREE.Sprite(new THREE.SpriteMaterial({map: this.glowTexture(), color: 0xffb84d, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); glow.scale.setScalar(R * 4.4); this.root.add(glow); }
    const axis = this.line(pivot, [new THREE.Vector3(0, -R * 1.45, 0), new THREE.Vector3(0, R * 1.45, 0)], '#ffd98a', .7);
    if (cutaway) {
      // Ein Viertel ist herausgeschnitten (Öffnung zeigt nach −x); Schichten als Kugeln, Schnittflächen als Halbscheiben.
      const ls = layers[meta.id] || [], glowing = meta.id === 'sun';
      const mat = color => new THREE.MeshStandardMaterial({color, roughness: .85, side: THREE.DoubleSide, emissive: color, emissiveIntensity: glowing ? .85 : .16});
      ls.forEach(([f, color, name], k) => {
        const inner = k ? R * ls[k - 1][0] : 0;
        if (k < ls.length - 1) { const m = new THREE.Mesh(new THREE.SphereGeometry(R * f, 64, 32, Math.PI * .25, Math.PI * 1.5), mat(color)); m.userData.pick = {label: name}; spin.add(m); this.pickables.push(m); }
        for (const phi of [Math.PI * .25, -Math.PI * .25]) {
          const disc = new THREE.Mesh(new THREE.RingGeometry(inner, R * f * .999, 64, 1, -Math.PI / 2, Math.PI), mat(color));
          disc.rotation.y = Math.PI + phi; disc.userData.pick = {label: name}; spin.add(disc); this.pickables.push(disc);
        }
      });
    }
    // A tilt beyond 90° already encodes retrograde spin; do not reverse it twice.
    const hours = Math.abs(facts?.rotation ?? meta.rotation ?? 24), dir = tilt > Math.PI / 2 ? 1 : (facts?.rotation ?? 1) < 0 ? -1 : 1;
    spin.name = 'body-spin';
    this.tick = (t, dt) => { if (!this.spinning) return; spin.rotation.y += dir * dt * Math.min(.9, 6 / Math.sqrt(hours)); if (this.clouds) this.clouds.rotation.y += dt * .01; };
    this.spinning = !cutaway && !this.reducedMotion; this.view(meta.ring ? 8.5 : 6.4, cutaway ? [-1, .35, .25] : meta.ring ? [.25, .5, 1] : [.15, .2, 1]);
  }

  /* ---------- Himmel ---------- */
  sky(stars, constellations, jd, lat, lon, showLines = true, showNames = true) {
    const savedLook = this.skyMode ? this.skyLook : null, savedFov = this.skyMode ? this.camera.fov : 70;
    this.clear(); this.skyMode = true; this.sunLight.intensity = 0; this.key.intensity = 0;
    const R = 100, toVec = (alt, az) => { const a = alt * D2R, z = az * D2R; return new THREE.Vector3(Math.cos(a) * Math.sin(z), Math.sin(a), -Math.cos(a) * Math.cos(z)).multiplyScalar(R); };
    const pos = [], col = [], size = [], color = bv => { const t = THREE.MathUtils.clamp((bv + .3) / 2.1, 0, 1); return new THREE.Color().setRGB(.7 + .3 * t, .78 + .12 * (1 - Math.abs(t - .45)), 1 - .5 * t); };
    for (const [ra, dec, mag, bv] of stars) { const [alt, az] = altAz(ra, dec, jd, lat, lon); const v = toVec(alt, az); pos.push(v.x, v.y, v.z); const c = color(bv); col.push(c.r, c.g, c.b); size.push(Math.max(1.2, 7.5 * Math.pow(10, -.17 * (mag + 1.5)))); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, uniforms: {scale: {value: this.renderer.getPixelRatio()}, visibility: {value: 1}}, vertexColors: true,
      vertexShader: 'attribute float size;varying vec3 vColor;uniform float scale;void main(){vColor=color;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=size*scale;gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'uniform float visibility;varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5);float a=1.-smoothstep(0.,.5,d);gl_FragColor=vec4(vColor*(.6+.6*a),a*visibility);}'});
    this.root.add(new THREE.Points(geo, mat));
    const linePts = [], labels = new THREE.Group(); this.root.add(labels);
    for (const c of constellations) {
      for (const seg of c.lines) for (let k = 1; k < seg.length; k++) { const a = altAz(seg[k - 1][0], seg[k - 1][1], jd, lat, lon), b = altAz(seg[k][0], seg[k][1], jd, lat, lon); linePts.push(toVec(...a).multiplyScalar(.995), toVec(...b).multiplyScalar(.995)); }
      const [alt, az] = altAz(c.center[0], c.center[1], jd, lat, lon); c.altAz = [alt, az];
      if (showNames && c.rank <= 2 && alt > 0) this.label(labels, c.de, toVec(alt, az).multiplyScalar(.98), {color: '#b9c6ff', size: .8, bg: '#00000000'});
    }
    if (showLines) this.root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(linePts), new THREE.LineBasicMaterial({color: '#7f93ff', transparent: true, opacity: .45, depthWrite: false})));
    if (showNames) for (const s of stars) if (s[4] && s[2] < 1.6) { const [alt, az] = altAz(s[0], s[1], jd, lat, lon); if (alt > 0) this.label(labels, s[4], toVec(alt, az), {color: '#fff4dc', size: .7, bg: '#00000000'}); }
    // Sonne, Mond und Planeten
    const bodies = [['sun', 'Sonne', '#ffd56b', 9], ['moon', 'Mond', '#f2f0e6', 7], ['mercury', 'Merkur', '#d8cfc6', 3.5], ['venus', 'Venus', '#fff3d0', 5], ['mars', 'Mars', '#ff8a5c', 4], ['jupiter', 'Jupiter', '#ffe9c4', 4.5], ['saturn', 'Saturn', '#f2dcaa', 4], ['uranus', 'Uranus', '#bfeef2', 3], ['neptune', 'Neptun', '#8fa8ff', 3]];
    this.visible = [];
    for (const [id, name, color, s] of bodies) {
      const [ra, dec] = geocentric(id, jd), [alt, az] = altAz(ra, dec, jd, lat, lon), v = toVec(alt, az).multiplyScalar(.97);
      const m = this.sphere(s * .12, new THREE.MeshBasicMaterial({color}), 20); m.position.copy(v); m.userData.pick = {label: `${name} · Höhe ${alt.toFixed(0)}°`}; this.root.add(m); this.pickables.push(m);
      if (id === 'sun') { const glow = new THREE.Sprite(new THREE.SpriteMaterial({map: this.glowTexture(), color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); glow.scale.setScalar(9); glow.position.copy(v); this.root.add(glow); }
      if (showNames && alt > 0) this.label(labels, name, v, {color, size: .75}); this.visible.push({id, name, alt, az});
    }
    // Horizont: Boden, Himmelsrichtungen, Dämmerung
    const sunAlt = this.visible[0].alt, dayness = THREE.MathUtils.clamp((sunAlt + 12) / 18, 0, 1);
    this.scene.background = new THREE.Color().lerpColors(new THREE.Color('#050816'), new THREE.Color('#3f6fb5'), dayness);
    mat.uniforms.visibility.value = 1 - .99 * dayness;
    const ground = new THREE.Mesh(new THREE.SphereGeometry(R * .9, 64, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({color: new THREE.Color().lerpColors(new THREE.Color('#0b1410'), new THREE.Color('#2e4a35'), dayness), side: THREE.DoubleSide}));
    ground.position.y = -.3; this.root.add(ground);
    this.line(this.root, Array.from({length: 129}, (_, k) => new THREE.Vector3(Math.sin(k / 128 * Math.PI * 2) * R * .9, 0, -Math.cos(k / 128 * Math.PI * 2) * R * .9)), '#9fb2d8', .6);
    [['N', 0], ['NO', 45], ['O', 90], ['SO', 135], ['S', 180], ['SW', 225], ['W', 270], ['NW', 315]].forEach(([t, az]) => this.label(labels, t, toVec(1.5, az).multiplyScalar(.85), {color: '#ffd98a', size: t.length > 1 ? .8 : 1.1, bg: '#0b1410cc'}));
    this.camera.near = .01; this.camera.fov = savedFov; this.camera.updateProjectionMatrix();
    this.controls.enableDamping = false; this.controls.autoRotate = false; this.controls.enableZoom = false; this.controls.enablePan = false; this.controls.rotateSpeed = -.35; this.controls.minDistance = .01; this.controls.maxDistance = .02;
    if (!this.skyHome) this.skyHome = [25, 180];
    this.lookAt(...(savedLook || this.skyHome)); this.dayness = dayness; this.sunAlt = sunAlt;
  }
  lookAt(alt, az) {
    this.skyLook = [alt, az]; const a = alt * D2R, z = az * D2R, d = new THREE.Vector3(Math.cos(a) * Math.sin(z), Math.sin(a), -Math.cos(a) * Math.cos(z));
    this.controls.target.set(0, 0, 0); this.camera.position.copy(d.multiplyScalar(-.015)); this.controls.update();
  }

  /* ---------- Phänomene ---------- */
  process(id) {
    this.clear(); this.starfield(); this.sunLight.intensity = 0; this.key.intensity = 0; this.ambient.intensity = .12;
    const sunDir = new THREE.DirectionalLight(0xfff4e0, 3.6); this.root.add(sunDir);
    const earthMat = () => new THREE.MeshStandardMaterial({map: this.texture('earth.jpg'), roughness: 1});
    const sunGlow = (pos, s) => { const sun = this.sphere(s, new THREE.MeshBasicMaterial({map: this.texture('sun.jpg')}), 48); sun.position.copy(pos); this.root.add(sun); const g = new THREE.Sprite(new THREE.SpriteMaterial({map: this.glowTexture(), color: 0xffc46b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); g.scale.setScalar(s * 4.5); g.position.copy(pos); this.root.add(g); return sun; };
    if (id === 'phases' || id === 'eclipse') {
      const sunPos = new THREE.Vector3(-26, 0, 0); sunGlow(sunPos, 3); sunDir.position.copy(sunPos);
      const earth = this.sphere(1.3, earthMat()); earth.rotation.z = -23.4 * D2R; this.root.add(earth); earth.userData.pick = {label: 'Erde'}; this.pickables.push(earth);
      const node = new THREE.Group(), tilt = new THREE.Group(); this.root.add(node); node.add(tilt);
      const incl = id === 'eclipse' ? 5.1 * D2R * 3 : 0; tilt.rotation.z = incl; // Neigung zur Verdeutlichung 3-fach überhöht
      this.line(tilt, Array.from({length: 129}, (_, k) => new THREE.Vector3(Math.cos(k / 128 * Math.PI * 2) * 6, 0, Math.sin(k / 128 * Math.PI * 2) * 6)), '#aab6ff', .45);
      const moonMat = new THREE.MeshStandardMaterial({map: this.texture('moon.jpg'), roughness: 1}), moon = this.sphere(.38, moonMat); tilt.add(moon); moon.userData.pick = {label: 'Mond'}; this.pickables.push(moon);
      const inset = this.phaseInset(); this.root.add(inset);
      let earthShadow = null, moonShadow = null;
      if (id === 'eclipse') {
        this.line(this.root, Array.from({length: 129}, (_, k) => new THREE.Vector3(Math.cos(k / 128 * Math.PI * 2) * 6, 0, Math.sin(k / 128 * Math.PI * 2) * 6)), '#ffd98a', .25);
        earthShadow = new THREE.Mesh(new THREE.ConeGeometry(1.3, 14, 48, 1, true), new THREE.MeshBasicMaterial({color: 0x8a93c8, transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide}));
        earthShadow.name = 'earth-shadow'; earthShadow.rotation.z = -Math.PI / 2; earthShadow.position.set(7, 0, 0); this.root.add(earthShadow);
        moonShadow = new THREE.Mesh(new THREE.ConeGeometry(.38, 6, 32, 1, true), new THREE.MeshBasicMaterial({color: 0x8a93c8, transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide}));
        moonShadow.name = 'moon-shadow'; moonShadow.rotation.z = -Math.PI / 2; this.root.add(moonShadow);
        for (const z of [6, -6]) { const m = this.sphere(.13, new THREE.MeshBasicMaterial({color: '#ffd98a'}), 16); m.position.set(0, 0, z); tilt.add(m); this.label(tilt, 'Knoten', new THREE.Vector3(0, .25, z), {size: 1.4}); }
      }
      this.label(this.root, 'Licht der Sonne →', new THREE.Vector3(-9.5, .4, 0), {color: '#ffd98a', size: 1.05});
      this.view(26, [.05, .75, .8]);
      const ease = f => Math.min(1, f * 2.4);
      return p => {
        let ang, beta = 0, reddish = 0;
        if (id === 'phases') ang = Math.PI + p * Math.PI * 2; // Start: Neumond (Mond zwischen Erde und Sonne)
        else {
          const k = Math.min(3, Math.floor(p * 4)), f = p * 4 - k;
          if (k === 0) { ang = Math.PI * 1.25 - Math.PI * .25 * ease(f); beta = 0; }
          else if (k === 1) { ang = Math.PI; beta = Math.PI / 2 * ease(f); }
          else if (k === 2) { ang = Math.PI; beta = Math.PI / 2; }
          else { ang = Math.PI * (1 - ease(f)); beta = Math.PI / 2; reddish = ease(f); }
          node.rotation.y = beta;
        }
        moon.position.set(Math.cos(ang - beta) * 6, 0, -Math.sin(ang - beta) * 6); moon.rotation.y = ang;
        const world = moon.getWorldPosition(new THREE.Vector3());
        if (moonShadow) { moonShadow.visible = Math.abs(world.y) < .2 && world.x < 0; moonShadow.position.set(world.x + 3, world.y, world.z); earthShadow.material.opacity = reddish ? .26 : .14; }
        moonMat.color.copy(new THREE.Color('#ffffff').lerp(new THREE.Color('#c0553a'), reddish * .8));
        inset.userData.draw((((ang - Math.PI) % (Math.PI * 2)) + Math.PI * 4) % (Math.PI * 2), reddish);
        earth.rotation.y = p * Math.PI * 4;
      };
    }
    if (id === 'seasons') {
      sunDir.intensity = 0; sunGlow(new THREE.Vector3(0, 0, 0), 1.6); this.sunLight.intensity = 4; this.sunLight.position.set(0, 0, 0); this.ambient.intensity = .1;
      this.line(this.root, Array.from({length: 129}, (_, k) => new THREE.Vector3(Math.cos(k / 128 * Math.PI * 2) * 9, 0, Math.sin(k / 128 * Math.PI * 2) * 9)), '#aab6ff', .4);
      const pivot = new THREE.Group(); this.root.add(pivot); const tiltG = new THREE.Group(); tiltG.name = 'season-axis'; pivot.name = 'season-earth'; tiltG.rotation.z = -23.4 * D2R; pivot.add(tiltG);
      const earth = this.sphere(1.1, earthMat()); tiltG.add(earth); this.line(tiltG, [new THREE.Vector3(0, -1.8, 0), new THREE.Vector3(0, 1.8, 0)], '#ffd98a', .9);
      const eq = this.line(tiltG, Array.from({length: 65}, (_, k) => new THREE.Vector3(Math.cos(k / 64 * Math.PI * 2) * 1.13, 0, Math.sin(k / 64 * Math.PI * 2) * 1.13)), '#ffffff', .5);
      ['Frühling', 'Sommer', 'Herbst', 'Winter'].forEach((t, k) => { const a = Math.PI * .5 + k * Math.PI / 2; this.label(this.root, t + ' (Nord)', new THREE.Vector3(Math.cos(a) * 12, .4, -Math.sin(a) * 12), {size: 2}); });
      this.view(40, [0, .8, .7]);
      return p => { const a = Math.PI * .5 + p * Math.PI * 2; pivot.position.set(Math.cos(a) * 9, 0, -Math.sin(a) * 9); earth.rotation.y = p * Math.PI * 16; };
    }
    // Leben eines Sterns
    this.ambient.intensity = .5; const group = new THREE.Group(); this.root.add(group);
    const nebula = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({size: .12, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
    const N = 2600, np = [], nc = []; for (let i = 0; i < N; i++) { const r = 2 + Math.random() * 5, t = Math.random() * Math.PI * 2, u = Math.acos(2 * Math.random() - 1); np.push(r * Math.sin(u) * Math.cos(t), r * Math.cos(u) * .6, r * Math.sin(u) * Math.sin(t)); const c = new THREE.Color().setHSL(.6 + Math.random() * .35, .7, .55); nc.push(c.r, c.g, c.b); }
    nebula.geometry.setAttribute('position', new THREE.Float32BufferAttribute(np, 3)); nebula.geometry.setAttribute('color', new THREE.Float32BufferAttribute(nc, 3)); group.add(nebula);
    const starMat = new THREE.MeshBasicMaterial({map: this.texture('sun.jpg'), color: 0xffffff}); const star = this.sphere(1, starMat, 64); group.add(star);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({map: this.glowTexture(), color: 0xffc46b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending})); group.add(glow);
    const shellPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({size: .1, color: 0x7fe0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
    const sp = []; for (let i = 0; i < 1800; i++) { const t = Math.random() * Math.PI * 2, u = Math.acos(2 * Math.random() - 1); sp.push(Math.sin(u) * Math.cos(t), Math.cos(u), Math.sin(u) * Math.sin(t)); }
    shellPts.geometry.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); group.add(shellPts);
    this.view(26, [.2, .3, 1]);
    const tint = (c1, c2, f) => new THREE.Color(c1).lerp(new THREE.Color(c2), f);
    return p => {
      const k = Math.min(3, Math.floor(p * 4)), f = p * 4 - k; group.rotation.y = p * Math.PI / 4;
      if (k === 0) { nebula.visible = true; nebula.scale.setScalar(1.6 - f * 1.3); nebula.material.opacity = .9; star.scale.setScalar(.05 + f * .7); starMat.color.copy(tint('#ff8f5a', '#fff2c8', f)); glow.scale.setScalar(1 + f * 3); shellPts.visible = false; }
      if (k === 1) { nebula.visible = f < .3; nebula.scale.setScalar(.3); star.scale.setScalar(.75 + Math.sin(f * 6) * .02); starMat.color.set('#fff2c8'); glow.material.color.set('#ffc46b'); glow.scale.setScalar(4); shellPts.visible = false; }
      if (k === 2) { nebula.visible = false; star.scale.setScalar(.75 + f * 3.2); starMat.color.copy(tint('#fff2c8', '#ff6a3d', f)); glow.material.color.copy(tint('#ffc46b', '#ff5a30', f)); glow.scale.setScalar(4 + f * 9); shellPts.visible = false; }
      if (k === 3) { star.scale.setScalar(Math.max(.18, 3.95 * (1 - f * 1.4))); starMat.color.copy(tint('#ff6a3d', '#dfe8ff', f)); glow.material.color.copy(tint('#ff5a30', '#9fc4ff', f)); glow.scale.setScalar(Math.max(1.2, 13 * (1 - f))); shellPts.visible = true; shellPts.scale.setScalar(3 + f * 5); shellPts.material.opacity = .8 * (1 - f * .4); }
    };
  }
  phaseInset() {
    const c = document.createElement('canvas'); c.width = c.height = 256; const ctx = c.getContext('2d'), tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, depthTest: false, transparent: true})); sp.scale.set(3.2, 3.2, 1); sp.position.set(0, 4.2, 0); sp.renderOrder = 12;
    sp.userData.draw = (elong, red = 0) => { // elong: 0 = Neumond … π = Vollmond
      ctx.clearRect(0, 0, 256, 256); ctx.fillStyle = '#0d1230ee'; ctx.beginPath(); ctx.roundRect(8, 8, 240, 240, 26); ctx.fill();
      ctx.fillStyle = '#2b2f45'; ctx.beginPath(); ctx.arc(128, 118, 78, 0, Math.PI * 2); ctx.fill();
      const k = Math.cos(elong), waxing = elong < Math.PI; ctx.fillStyle = red > .5 ? '#b5563a' : '#f1efe4'; ctx.beginPath();
      ctx.arc(128, 118, 78, -Math.PI / 2, Math.PI / 2, !waxing); ctx.ellipse(128, 118, Math.abs(k) * 78, 78, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === waxing); ctx.fill();
      ctx.fillStyle = '#c9d2ff'; ctx.font = '600 22px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Blick von der Erde', 128, 228); tex.needsUpdate = true;
    };
    return sp;
  }
  export(name) {
    if (this.backgroundSphere) this.backgroundSphere.position.copy(this.camera.position);
    this.renderer.render(this.scene, this.camera);
    this.renderer.domElement.toBlob(blob => { if (!blob) { this.onPick?.({label: 'PNG konnte nicht erzeugt werden.'}); return; } const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `astra-${name.toLocaleLowerCase('de').replace(/[^a-z0-9äöüß]+/g, '-')}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }, 'image/png');
  }
}

