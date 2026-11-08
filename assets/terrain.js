/* Ridgeline terrain: WebGL background for dcor.dev, with its tuning panel. */
(() => {
'use strict';
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false });
if (!gl) { document.getElementById('noGl').hidden = false; document.getElementById('tuneBtn').hidden = true; return; }  /* no landscape, so nothing to tune */

const LITE = matchMedia('(max-width: 700px), (pointer: coarse)').matches;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLS = LITE ? 240 : 560;  /* one fixed world grid across the widest row (see the vertex shader) */
const OCT = LITE ? 3 : 4;  /* fewer octaves: cleaner ridges, less fine-detail shimmer */
const PARTICLES = LITE ? 80 : 220;
const Z_MAX = 55, EYE_Z = -2, FOV = 40 * Math.PI / 180;
const IDX32 = !!gl.getExtension('OES_element_index_uint');
const MAX_ROWS = IDX32 ? 260 : Math.floor(65535 / COLS / 2);  /* line ribbons use 2 vertices per column */
const IdxArr = IDX32 ? Uint32Array : Uint16Array, IDX_TYPE = IDX32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;

const DEFAULTS = {
  playing: !REDUCED, ripple: false, speed: 0.08, motion: 'crosswind', gust: 0, glide: 0.25,
  height: 0.86, density: 226, tilt: 7.3,
  intensity: 1.4, accent: 0.38,
  grain: false, scan: false, glitch: false, fog: true, hand: false
};
const KEY = 'dcor-terrain-v10';
let S = { ...DEFAULTS };
try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && !REDUCED) S = { ...DEFAULTS, ...saved }; } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

/* ---------- shaders ---------- */
const NOISE = `
vec3 permute(vec3 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}`;

const TERRAIN_VS = `
precision highp float;
attribute vec4 a_pos; // x in [-1,1], world z, row index, ribbon side (lines only)
uniform mat4 u_vp;
uniform vec2 u_off;
uniform float u_warp, u_morph, u_rows, u_resX, u_resY, u_lw;
uniform float u_clock, u_height, u_xs, u_eyeZ, u_eyeH, u_oct, u_hand, u_glitch, u_gseed, u_ripOn, u_pass, u_accent, u_fog;
uniform vec4 u_rip[4];
uniform float u_calm;  /* 0..1: how far the whole landscape is calmed (pressed flat) */
varying float v_lum, v_acc, v_alpha, v_fogm, v_row, v_side;
${NOISE}
float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= u_oct) break;
    float n = 1.0 - abs(snoise(p));
    s += a * n * n;
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}
float terrain(vec2 p, out float voidM){
  vec2 q = (p + u_off) * 0.075;
  q += u_warp * 0.35 * vec2(snoise(q * 0.6 + vec2(u_morph, 0.0)), snoise(q * 0.6 + vec2(4.7, -u_morph)));
  float m = snoise(q * 0.7 + vec2(3.1, 1.7)) * 0.5 + 0.5;
  float h = pow(fbm(q), 2.0) * (0.2 + 1.7 * smoothstep(0.3, 0.85, m));
  float v = snoise(q * 0.45 + vec2(-7.3, 2.2));
  voidM = smoothstep(0.42, 0.62, v);
  h = mix(h, -0.12, voidM);
  return h * u_height * 1.9;
}
float ripple(vec2 p, out float acc){
  float r = 0.0; acc = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 R = u_rip[i];
    float age = u_clock - R.z;
    if (R.w <= 0.0 || age < 0.0 || age > 4.5) continue;
    float d = distance(p, R.xy);
    float front = age * 3.2;
    float env = (1.0 - smoothstep(front - 2.5, front + 0.5, d)) * exp(-age * 1.1) * exp(-d * 0.12);
    float w = sin(d * 2.6 - age * 8.0) * env * R.w;
    r += w; acc += abs(w);
  }
  acc *= u_ripOn;
  return r * 0.35 * u_ripOn;
}
void main(){
  float sp = 55.0 / max(u_rows - 1.0, 1.0);
  float z = a_pos.y - mod(u_off.y, sp);  /* each row stays on the same world contour as the land moves */
  float row = a_pos.z;
  /* Every vertex stays on one fixed point of the land, in x as well as z. When vertices slid along
     a row they cut across sharp peaks at different places each frame, so the tips licked up and
     down: that was the flaming. Now the drawn shape can only move, never change. */
  float halfW = (55.0 - u_eyeZ + 2.0 + u_eyeH * 0.6) * u_xs;
  float dxW = 2.0 * halfW / ${(COLS - 1).toFixed(1)};
  float wx = a_pos.x * halfW - mod(u_off.x, dxW);
  v_lum = 0.0; v_acc = 0.0; v_alpha = 0.0; v_fogm = 0.0; v_row = row; v_side = 0.0;
  /* outside this row's view: skip the terrain maths */
  if (abs(wx) > (z - u_eyeZ + 2.0 + u_eyeH * 0.6) * u_xs * 1.05 + dxW * 2.0) { gl_Position = u_vp * vec4(wx, 0.0, z, 1.0); return; }
  vec2 p = vec2(wx, z);
  float vm, racc;
  float hb = terrain(p, vm) + ripple(p, racc);
  float h = hb + u_hand * 0.06 * snoise(vec2(row * 1.7, wx * 0.9 + row * 0.37));
  /* Press-and-hold calms the whole landscape; it rises back slowly on release. */
  h *= 1.0 - 0.75 * u_calm;
  float gx = 0.0;
  if (u_glitch > 0.0) {
    float band = floor(row / 5.0);
    float g1 = fract(sin(band * 91.7 + u_gseed) * 43758.5453);
    if (g1 > 0.72) gx = (fract(g1 * 17.3) - 0.5) * 3.0 * u_glitch;
  }
  gl_Position = u_vp * vec4(wx + gx, h, z, 1.0);
  if (u_pass > 0.5 && u_pass < 1.5) {
    float lum = 0.55 * (1.0 - 0.9 * vm);  /* one even brightness: shading per vertex flickered along the peaks */
    v_lum = lum;
    float acc = racc * 2.2 * u_accent;  /* cyan only from the optional cursor ripple, never on crests */
    if (gx != 0.0) acc += 0.7 * u_glitch;
    v_acc = acc;
    float fogStart = u_fog > 0.5 ? 18.0 : 32.0;
    float a = (1.0 - smoothstep(fogStart, 52.0, z)) * smoothstep(0.0, 3.0, z);
    float brk = smoothstep(-0.6, -0.3, snoise(vec2(wx * 0.35 + row * 7.13, row * 0.51)));
    a *= mix(1.0, brk, u_hand);
    a *= 0.75 + 0.25 * clamp(lum * 1.5, 0.0, 1.0);
    /* Screen positions of the next row and the next column, for the two fixes below. */
    float vmn;
    float zn = z + sp;
    float hn2 = terrain(vec2(wx, zn), vmn) * (1.0 - 0.75 * u_calm);
    vec4 cNext = u_vp * vec4(wx, hn2, zn, 1.0);
    float hr = terrain(vec2(wx + dxW, z), vmn) * (1.0 - 0.75 * u_calm);
    vec4 cRight = u_vp * vec4(wx + dxW, hr, z, 1.0);
    vec3 ndc = gl_Position.xyz / gl_Position.w;
    /* Anti-moire: rows closer than a few device pixels fade out instead of beating against each other. */
    float gapPx = abs(ndc.y - cNext.y / cNext.w) * 0.5 * u_resY;
    a *= smoothstep(1.5, 4.5, gapPx);
    /* Lines are drawn as thin ribbons with a soft edge (see the fragment shader), not 1px GL lines,
       whose stair-steps form moire across near-parallel rows at any density. */
    float sdx = (cRight.x / cRight.w - ndc.x) * 0.5 * u_resX;
    float sdy = (cRight.y / cRight.w - ndc.y) * 0.5 * u_resY;
    float stretch = min(sqrt(sdx * sdx + sdy * sdy) / max(abs(sdx), 0.001), 4.0);  /* steep segments stay as thick as flat ones */
    float halfPx = (u_lw * 0.5 + 1.0) * stretch;
    /* Keep the part of the ribbon that overlaps nearer ground in front of it. */
    float depthPerPx = abs(ndc.z - cNext.z / cNext.w) / max(gapPx, 0.5);
    gl_Position.y += a_pos.w * halfPx * 2.0 / u_resY * gl_Position.w;
    gl_Position.z -= min(halfPx * depthPerPx * 1.5, 0.002) * gl_Position.w;
    v_side = a_pos.w;
    v_alpha = a;
    v_fogm = u_fog * smoothstep(6.0, 46.0, z);  /* atmospheric depth: far lines fade into a cool haze */
  }
}`;

const TERRAIN_FS = `
precision highp float;
varying float v_lum, v_acc, v_alpha, v_fogm, v_row, v_side;
uniform float u_pass, u_int, u_lw;
uniform vec3 u_bg, u_line, u_hi, u_accC, u_haze;
void main(){
  if (u_pass > 1.5) { gl_FragColor = vec4((floor(v_row + 0.5) + 1.0) / 255.0, 0.0, 0.0, 1.0); return; }
  if (u_pass < 0.5) { gl_FragColor = vec4(u_bg, 1.0); return; }
  vec3 col = u_line * v_lum;
  col = mix(col, u_accC * (0.7 + 0.6 * v_lum), clamp(v_acc, 0.0, 1.0));
  col = mix(col, u_haze, v_fogm * 0.75);
  col *= max(1.0, u_int / 1.2);  /* opacity is already full by 120%; above that the lines themselves get brighter */
  float cover = clamp(u_lw * 0.5 + 0.5 - abs(v_side) * (u_lw * 0.5 + 1.0), 0.0, 1.0);
  gl_FragColor = vec4(col, clamp(v_alpha * u_int, 0.0, 1.0) * cover);
}`;

const DUST_VS = `
precision highp float;
attribute vec3 a_seed;
uniform mat4 u_vp;
uniform float u_scrollZ, u_clock, u_xs, u_eyeZ, u_eyeH, u_dpr;
varying float v_a;
void main(){
  float z = mod(a_seed.z * 55.0 - u_scrollZ, 55.0);
  float s = a_seed.x * 2.0 - 1.0;
  float x = s * (z - u_eyeZ + 2.0 + u_eyeH * 0.6) * u_xs + sin(u_clock * 0.2 + a_seed.y * 20.0) * 0.6;
  float y = 0.6 + a_seed.y * 3.5 + sin(u_clock * 0.35 + a_seed.x * 30.0) * 0.25;
  vec4 cp = u_vp * vec4(x, y, z, 1.0);
  gl_Position = cp;
  gl_PointSize = (1.2 + 2.4 * fract(a_seed.x * 7.3)) * u_dpr * clamp(10.0 / cp.w, 0.4, 2.5);
  v_a = (1.0 - smoothstep(25.0, 55.0, z)) * smoothstep(0.0, 4.0, z) * (0.08 + 0.17 * fract(a_seed.y * 13.1));
}`;
const DUST_FS = `
precision highp float;
varying float v_a;
uniform vec3 u_accC;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = (1.0 - smoothstep(0.0, 0.5, d)) * v_a;
  gl_FragColor = vec4(mix(vec3(0.85, 0.9, 0.95), u_accC, 0.45) * a, a);
}`;

const POST_VS = `
attribute vec2 a_xy;
void main(){ gl_Position = vec4(a_xy, 0.0, 1.0); }`;
const POST_FS = `
precision highp float;
uniform vec2 u_res;
uniform float u_clock, u_grain, u_scan, u_fog, u_glitch, u_gseed, u_dpr;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float d = length((uv - 0.5) * vec2(1.1, 1.0)) * 1.25;
  float vig = smoothstep(0.45, 1.05, d) * 0.7;
  float sl = u_scan * (0.5 + 0.5 * sin(gl_FragCoord.y / u_dpr * 3.14159 * 0.5)) * 0.16;
  float g = hash(floor(gl_FragCoord.xy / max(u_dpr * 0.75, 1.0)) + fract(u_clock * 7.0) * vec2(91.0, 37.0)) - 0.5;
  float haze = u_fog * smoothstep(0.4, 1.0, uv.y) * 0.07 * (0.75 + 0.25 * sin(uv.x * 3.0 + u_clock * 0.08));
  float tear = 0.0;
  if (u_glitch > 0.0) {
    float band = floor(uv.y * 70.0);
    tear = step(0.94, hash(vec2(band, u_gseed))) * u_glitch;
  }
  vec3 light = vec3(0.72, 0.78, 0.82) * haze + vec3(0.25, 0.88, 1.0) * tear * 0.18 + vec3(max(g, 0.0)) * u_grain * 0.16;
  float darkA = clamp(vig + sl + max(-g, 0.0) * u_grain * 0.3, 0.0, 1.0);
  gl_FragColor = vec4(light, darkA);
}`;

function compile(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); u[name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}
const T = program(TERRAIN_VS, TERRAIN_FS);
const D = program(DUST_VS, DUST_FS);
const P = program(POST_VS, POST_FS);

/* ---------- geometry ---------- */
const posBuf = gl.createBuffer(), triBuf = gl.createBuffer(), lineBuf = gl.createBuffer(), ribbonBuf = gl.createBuffer();
let triCount = 0, lineCount = 0, builtRows = 0;
function buildMesh(rows) {
  rows = Math.min(rows, MAX_ROWS);
  const pos = new Float32Array(rows * COLS * 3);
  let k = 0;
  for (let r = 0; r < rows; r++) {
    const z = Z_MAX * r / (rows - 1);
    for (let c = 0; c < COLS; c++) { pos[k++] = c / (COLS - 1) * 2 - 1; pos[k++] = z; pos[k++] = r; }
  }
  const tri = new IdxArr((rows - 1) * (COLS - 1) * 6);
  k = 0;
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < COLS - 1; c++) {
    const a = r * COLS + c, b = a + 1, d = a + COLS, e = d + 1;
    tri[k++] = a; tri[k++] = d; tri[k++] = b; tri[k++] = b; tri[k++] = d; tri[k++] = e;
  }
  /* each row is a ribbon: two vertices per column, one either side of the line */
  const ribbon = new Float32Array(rows * COLS * 8);
  k = 0;
  for (let r = 0; r < rows; r++) {
    const z = Z_MAX * r / (rows - 1);
    for (let c = 0; c < COLS; c++) for (const side of [-1, 1]) { ribbon[k++] = c / (COLS - 1) * 2 - 1; ribbon[k++] = z; ribbon[k++] = r; ribbon[k++] = side; }
  }
  const lines = new IdxArr(rows * (COLS - 1) * 6);
  k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < COLS - 1; c++) {
    const a = (r * COLS + c) * 2, b = a + 1, d = a + 2, e = a + 3;
    lines[k++] = a; lines[k++] = d; lines[k++] = b; lines[k++] = b; lines[k++] = d; lines[k++] = e;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, ribbonBuf); gl.bufferData(gl.ARRAY_BUFFER, ribbon, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, tri, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, lines, gl.STATIC_DRAW);
  triCount = tri.length; lineCount = lines.length; builtRows = rows;
}
const dustBuf = gl.createBuffer();
{ const a = new Float32Array(PARTICLES * 3); for (let i = 0; i < a.length; i++) a[i] = Math.random();
  gl.bindBuffer(gl.ARRAY_BUFFER, dustBuf); gl.bufferData(gl.ARRAY_BUFFER, a, gl.STATIC_DRAW); }
const quadBuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

/* ---------- matrices ---------- */
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
function lookAt(e, c, up) {
  let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s;
  }
  return o;
}
function invert(m) {
  const [a00,a01,a02,a03,a10,a11,a12,a13,a20,a21,a22,a23,a30,a31,a32,a33] = m;
  const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,
        b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,
        b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
  let det = b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06; if (!det) return null; det = 1/det;
  return [(a11*b11-a12*b10+a13*b09)*det,(a02*b10-a01*b11-a03*b09)*det,(a31*b05-a32*b04+a33*b03)*det,(a22*b04-a21*b05-a23*b03)*det,
    (a12*b08-a10*b11-a13*b07)*det,(a00*b11-a02*b08+a03*b07)*det,(a32*b02-a30*b05-a33*b01)*det,(a20*b05-a22*b02+a23*b01)*det,
    (a10*b10-a11*b08+a13*b06)*det,(a01*b08-a00*b10-a03*b06)*det,(a30*b04-a31*b02+a33*b00)*det,(a21*b02-a20*b04-a23*b00)*det,
    (a11*b07-a10*b09-a12*b06)*det,(a00*b09-a01*b07+a02*b06)*det,(a31*b01-a30*b03-a32*b00)*det,(a20*b03-a21*b01+a22*b00)*det];
}
const xform = (m, v) => [0, 1, 2, 3].map(r => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * v[3]);

/* ---------- state ---------- */
let dpr = 1, W = 1, H = 1, aspect = 1, VP = null, invVP = null, xs = 1;
/* Starting point in the landscape: where the camera begins before drifting. */
const START = { x: -493, z: -230 };
let off = { x: START.x, z: START.z }, morph = 0, boost = 0, lastClick = -100, clock = 0, last = performance.now();
let glitchUntil = -1, nextGlitch = 4 + Math.random() * 6, gseed = 0;
const rips = new Float32Array(16); let ripIdx = 0;
/* Calm: pressing eases the landscape flat (~0.8 s), releasing lets it rise back (6 s). One value, no per-point state. */
let pressed = false, calmLin = 0;
let needsRender = true;
/* Slow forward drift on every page: a steady glide toward the horizon, independent of scrolling. */
let drift = 1, driftNow = 0;
/* setDrift(0) eases the glide off, setDrift(1) brings it back; speed is the panel's Glide slider. */
/* setActive(false) stops all drawing while a page without the landscape is open. */
let active = true;
window.ridgeline = { setDrift(v) { drift = v; }, setActive(v) { active = v; if (v) needsRender = true; } };

function resize() {
  dpr = LITE ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  W = canvas.clientWidth; H = canvas.clientHeight; aspect = W / Math.max(H, 1);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  updateCamera(); needsRender = true;
}
function updateCamera() {
  const glide = S.motion === 'glide';
  const sx = glide ? Math.sin(clock * 0.05) : 0;
  const bob = glide ? Math.sin(clock * 0.11) * 0.35 : 0;
  const proj = perspective(FOV, aspect, 0.1, 120);
  const view = lookAt([sx * 1.2, S.tilt + bob, EYE_Z], [sx * 2.5, 0, 15], [0, 1, 0]);
  VP = mul(proj, view); invVP = invert(VP);
  xs = Math.tan(FOV / 2) * aspect * 1.2;
}
function cursorToWorld(cx, cy) {
  if (!invVP) return null;
  const x = cx / W * 2 - 1, y = 1 - cy / H * 2;
  const a = xform(invVP, [x, y, -1, 1]), b = xform(invVP, [x, y, 1, 1]);
  const p0 = a.slice(0, 3).map(v => v / a[3]), p1 = b.slice(0, 3).map(v => v / b[3]);
  const planeY = 0.4 * S.height;
  const t = (planeY - p0[1]) / (p1[1] - p0[1]);
  if (!(t > 0)) return null;
  return [p0[0] + t * (p1[0] - p0[0]), p0[2] + t * (p1[2] - p0[2])];
}
let lastRip = { x: -1e9, y: -1e9, t: 0 };
window.addEventListener('pointermove', (e) => {
  if (!S.ripple || !S.playing) return;
  const dx = e.clientX - lastRip.x, dy = e.clientY - lastRip.y, dist = Math.hypot(dx, dy);
  if (dist < 60 || clock - lastRip.t < 0.25) return;
  const w = cursorToWorld(e.clientX, e.clientY); if (!w) return;
  const strength = Math.min(1, 0.45 + dist / 400);
  rips.set([w[0], w[1], clock, strength], ripIdx * 4); ripIdx = (ripIdx + 1) % 4;
  lastRip = { x: e.clientX, y: e.clientY, t: clock };
}, { passive: true });

/* ---------- render ---------- */
const BG = [0.043, 0.05, 0.057], LINE = [0.6, 0.63, 0.66], HI = [0.93, 0.95, 0.97], ACC = [0.247, 0.878, 1.0], HAZE = [0.15, 0.21, 0.24];
function bindAttrib(prog, name, buf, size) {
  const loc = gl.getAttribLocation(prog, name);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  return loc;
}
function render() {
  if (builtRows !== Math.min(S.density, MAX_ROWS)) buildMesh(S.density);
  updateCamera();
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(BG[0], BG[1], BG[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const glitchAmt = (S.glitch && clock < glitchUntil) ? (Math.sin(clock * 90) > 0 ? 1 : 0.55) : 0;

  // terrain
  gl.useProgram(T.p);
  const loc = bindAttrib(T.p, 'a_pos', posBuf, 3);
  const u = T.u;
  gl.uniformMatrix4fv(u.u_vp, false, VP);
  gl.uniform2f(u.u_off, off.x, off.z);
  gl.uniform1f(u.u_warp, S.motion === 'breathe' ? 1 : 0); gl.uniform1f(u.u_morph, morph);
  gl.uniform1f(u.u_rows, builtRows); gl.uniform1f(u.u_resX, canvas.width); gl.uniform1f(u.u_resY, canvas.height); gl.uniform1f(u.u_lw, dpr > 1 ? 1.25 : 1); gl.uniform1f(u.u_clock, clock);
  gl.uniform1f(u.u_height, S.height * (S.motion === 'breathe' ? 1 + 0.12 * Math.sin(clock * 0.35) : 1)); gl.uniform1f(u.u_xs, xs);
  gl.uniform1f(u.u_eyeZ, EYE_Z); gl.uniform1f(u.u_eyeH, S.tilt);
  gl.uniform1f(u.u_oct, OCT); gl.uniform1f(u.u_hand, S.hand ? 0.65 : 0);
  gl.uniform1f(u.u_glitch, glitchAmt); gl.uniform1f(u.u_gseed, gseed);
  gl.uniform1f(u.u_ripOn, S.ripple ? 1 : 0); gl.uniform4fv(u.u_rip, rips); gl.uniform1f(u.u_calm, calmLin * calmLin * (3 - 2 * calmLin));
  gl.uniform1f(u.u_accent, S.accent); gl.uniform1f(u.u_fog, S.fog ? 1 : 0);
  gl.uniform1f(u.u_int, S.intensity);
  gl.uniform3fv(u.u_bg, BG); gl.uniform3fv(u.u_line, LINE); gl.uniform3fv(u.u_hi, HI);
  gl.uniform3fv(u.u_accC, ACC); gl.uniform3fv(u.u_haze, HAZE);

  gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.BLEND); gl.depthMask(true);
  gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 1);
  gl.uniform1f(u.u_pass, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triBuf); gl.drawElements(gl.TRIANGLES, triCount, IDX_TYPE, 0);
  gl.disable(gl.POLYGON_OFFSET_FILL);

  gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform1f(u.u_pass, 1);
  bindAttrib(T.p, 'a_pos', ribbonBuf, 4);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lineBuf); gl.drawElements(gl.TRIANGLES, lineCount, IDX_TYPE, 0);
  gl.disableVertexAttribArray(loc);

  // dust
  if (false) {  /* dust particles retired: they read as sparks */
    gl.useProgram(D.p);
    const dl = bindAttrib(D.p, 'a_seed', dustBuf, 3);
    gl.uniformMatrix4fv(D.u.u_vp, false, VP);
    gl.uniform1f(D.u.u_scrollZ, off.z); gl.uniform1f(D.u.u_clock, clock);
    gl.uniform1f(D.u.u_xs, xs); gl.uniform1f(D.u.u_eyeZ, EYE_Z); gl.uniform1f(D.u.u_eyeH, S.tilt);
    gl.uniform1f(D.u.u_dpr, dpr); gl.uniform3fv(D.u.u_accC, ACC);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, PARTICLES);
    gl.disableVertexAttribArray(dl);
  }

  // post: grain, scanlines, vignette, haze, tears (premultiplied over)
  gl.disable(gl.DEPTH_TEST);
  gl.useProgram(P.p);
  const pl = bindAttrib(P.p, 'a_xy', quadBuf, 2);
  gl.uniform2f(P.u.u_res, canvas.width, canvas.height);
  gl.uniform1f(P.u.u_clock, clock); gl.uniform1f(P.u.u_grain, S.grain ? 1 : 0);
  gl.uniform1f(P.u.u_scan, S.scan ? 1 : 0); gl.uniform1f(P.u.u_fog, S.fog ? 1 : 0);
  gl.uniform1f(P.u.u_glitch, glitchAmt); gl.uniform1f(P.u.u_gseed, gseed); gl.uniform1f(P.u.u_dpr, dpr);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.disableVertexAttribArray(pl);
  gl.depthMask(true);
}
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  pressed = true;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  needsRender = true;
});
const endDrag = () => { pressed = false; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now;
  if (!active) { requestAnimationFrame(frame); return; }
  if (S.playing) {
    clock += dt;
    boost *= Math.exp(-dt * 1.1);
    const gustF = 1 + S.gust * (0.9 * Math.sin(clock * 0.23) * Math.sin(clock * 0.071 + 1.3) + 0.35 * Math.sin(clock * 0.53 + 0.7));
    const v = dt * S.speed * Math.max(0.15, gustF) * (1 + boost) * 0.22;
    if (S.motion === 'toward') off.z += v;
    else if (S.motion === 'crosswind') { off.x += v; off.z += v * 0.12; }
    else if (S.motion === 'glide') { off.x += v * 0.55; off.z += v * 0.85; }
    else morph += v * 2.0;
    if (S.glitch && clock > nextGlitch) { glitchUntil = clock + 0.16 + Math.random() * 0.12; gseed = Math.random() * 100; nextGlitch = clock + 6 + Math.random() * 9; }
    needsRender = true;
  } else if (clock - lastClick < 8.5) { clock += dt; needsRender = true; }
  const calmPrev = calmLin;
  calmLin = pressed ? Math.min(1, calmLin + dt / 0.8) : Math.max(0, calmLin - dt / 6);
  if (calmLin !== calmPrev) needsRender = true;
  driftNow += (drift * S.glide - driftNow) * Math.min(1, dt * 0.8);
  if (S.playing && driftNow > 0.0001) { off.z += driftNow * dt; needsRender = true; }
  if (needsRender) { render(); needsRender = false; }
  requestAnimationFrame(frame);
}

/* ---------- controls ---------- */
const FMT = { speed: v => v.toFixed(2), glide: v => v.toFixed(2), gust: v => Math.round(v * 100) + '%', height: v => v.toFixed(2), density: v => String(v), tilt: v => v.toFixed(1), intensity: v => Math.round(v * 100) + '%', accent: v => Math.round(v * 100) + '%' };
const RANGES = Object.keys(FMT), CHECKS = ['playing', 'ripple', 'grain', 'scan', 'glitch', 'fog', 'hand'];
function syncUI() {
  RANGES.forEach(k => { const el = document.getElementById(k); el.value = S[k]; document.getElementById(k + 'Out').textContent = FMT[k](S[k]); });
  CHECKS.forEach(k => { document.getElementById(k).checked = !!S[k]; });
  const m = document.getElementById('m_' + S.motion); if (m) m.checked = true;
}
document.querySelectorAll('input[name=motion]').forEach(el => el.addEventListener('change', e => { S.motion = e.target.value; needsRender = true; save(); }));
RANGES.forEach(k => document.getElementById(k).addEventListener('input', e => {
  S[k] = k === 'density' ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
  document.getElementById(k + 'Out').textContent = FMT[k](S[k]);
  if (k === 'tilt') updateCamera();
  needsRender = true; save();
}));
CHECKS.forEach(k => document.getElementById(k).addEventListener('change', e => {
  S[k] = e.target.checked;
  needsRender = true; save();
}));
document.getElementById('resetBtn').addEventListener('click', () => { S = { ...DEFAULTS }; save(); syncUI(); updateCamera(); needsRender = true; });

/* Landscape position: readout, jump to a random spot, copy everything (for pasting back to the author). */
const posOut = document.getElementById('posOut');
const showPos = () => { posOut.textContent = `x ${Math.round(off.x)} · z ${Math.round(off.z)}`; };
setInterval(() => { if (!panel.hidden) showPos(); }, 500);
document.getElementById('spotBtn').addEventListener('click', () => {
  off.x = Math.round(Math.random() * 1600 - 800); off.z = Math.round(Math.random() * 1600 - 800);
  rips.fill(0); showPos(); needsRender = true;
});
document.getElementById('copyBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget, out = document.getElementById('copyOut');
  const json = JSON.stringify({ start: { x: Math.round(off.x), z: Math.round(off.z) }, ...S }, null, 2);
  try { await navigator.clipboard.writeText(json); btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy settings'), 1600); }
  catch (err) { out.hidden = false; out.value = json; out.focus(); out.select(); }
});
const panel = document.getElementById('panel'), tuneBtn = document.getElementById('tuneBtn');
const setPanel = (open) => { panel.hidden = !open; tuneBtn.setAttribute('aria-expanded', String(open)); };
setPanel(false);
tuneBtn.addEventListener('click', () => { setPanel(panel.hidden); showPos(); if (!panel.hidden) panel.querySelector('input, button').focus(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { setPanel(false); tuneBtn.focus(); } });
document.addEventListener('pointerdown', (e) => { if (!panel.hidden && !panel.contains(e.target) && !tuneBtn.contains(e.target)) setPanel(false); });
document.getElementById('rmNote').hidden = !REDUCED;

syncUI();
new ResizeObserver(resize).observe(canvas);
resize();
requestAnimationFrame(frame);
})();
