// Raw WebGL1 renderer: column-major math, one lit shader program, one sky
// program, an append-only mesh builder, and draw calls. No libraries.
export function matPerspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f;
  m[10] = (far + near) / (near - far); m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}
export function matLookAt(e, t, up) {
  let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2];
  let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  // right = normalize(cross(up, z)); up2 = cross(z, right). This ordering
  // keeps the image upright: right must be up x z, never z x up.
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * e[0] + xy * e[1] + xz * e[2]),
    -(yx * e[0] + yy * e[1] + yz * e[2]),
    -(zx * e[0] + zy * e[1] + zz * e[2]), 1,
  ]);
}
export function matMul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return o;
}
// Model matrix: translate (x,y,z), rotate about Y by heading, uniform scale s.
export function matModel(x, y, z, heading, s) {
  const c = Math.cos(heading) * s, si = Math.sin(heading) * s;
  return new Float32Array([c, 0, -si, 0, 0, s, 0, 0, si, 0, c, 0, x, y, z, 1]);
}
export function matModelTilt(x, y, z, heading, s, tiltX, tiltZ) {
  // Model with small pitch/roll: R = Ry(heading) * Rx(tiltX) * Rz(tiltZ).
  const ch = Math.cos(heading), sh = Math.sin(heading);
  const cx = Math.cos(tiltX), sx = Math.sin(tiltX);
  const cz = Math.cos(tiltZ), sz = Math.sin(tiltZ);
  // Ry*Rx*Rz columns, scaled.
  const m00 = ch * cz + sh * sx * sz, m01 = -ch * sz + sh * sx * cz, m02 = sh * cx;
  const m10 = cx * sz, m11 = cx * cz, m12 = -sx;
  const m20 = -sh * cz + ch * sx * sz, m21 = sh * sz + ch * sx * cz, m22 = ch * cx;
  return new Float32Array([
    m00 * s, m10 * s, m20 * s, 0, m01 * s, m11 * s, m21 * s, 0,
    m02 * s, m12 * s, m22 * s, 0, x, y, z, 1,
  ]);
}

// Append-only mesh builder. Positions, flat normals, colors, glow factor.
export class Mesh {
  constructor() { this.p = []; this.n = []; this.c = []; this.g = []; }
  tri(a, b, c, col, glow) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (const v of [a, b, c]) {
      this.p.push(v[0], v[1], v[2]); this.n.push(nx, ny, nz);
      this.c.push(col[0], col[1], col[2]); this.g.push(glow);
    }
  }
  // Quad from center + right + up vectors; cross(r,u) must equal the outward normal.
  quad(c, r, u, col, glow) {
    const a = [c[0] - r[0] - u[0], c[1] - r[1] - u[1], c[2] - r[2] - u[2]];
    const b = [c[0] + r[0] - u[0], c[1] + r[1] - u[1], c[2] + r[2] - u[2]];
    const d = [c[0] + r[0] + u[0], c[1] + r[1] + u[1], c[2] + r[2] + u[2]];
    const e = [c[0] - r[0] + u[0], c[1] - r[1] + u[1], c[2] - r[2] + u[2]];
    this.tri(a, b, d, col, glow); this.tri(a, d, e, col, glow);
  }
  box(cx, cy, cz, sx, sy, sz, col, glow, topCol) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const tc = topCol || col;
    this.quad([cx, cy + hy, cz], [hx, 0, 0], [0, 0, -hz], tc, glow); // top
    this.quad([cx, cy - hy, cz], [hx, 0, 0], [0, 0, hz], col, glow); // bottom
    this.quad([cx + hx, cy, cz], [0, 0, -hz], [0, hy, 0], col, glow); // +x
    this.quad([cx - hx, cy, cz], [0, 0, hz], [0, hy, 0], col, glow); // -x
    this.quad([cx, cy, cz + hz], [hx, 0, 0], [0, hy, 0], col, glow); // +z
    this.quad([cx, cy, cz - hz], [-hx, 0, 0], [0, hy, 0], col, glow); // -z
  }
  // Vertical prism (sides >= 5). Flat-shaded sides + top cap.
  prism(cx, cy, cz, r, h, sides, col, glow) {
    const ring = (y, rr) => {
      const pts = [];
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        pts.push([cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr]);
      }
      return pts;
    };
    const b = ring(cy, r), t = ring(cy + h, r);
    for (let k = 0; k < sides; k++) {
      const k2 = (k + 1) % sides;
      this.tri(b[k], t[k2], b[k2], col, glow);
      this.tri(b[k], t[k], t[k2], col, glow);
    }
    const top = [cx, cy + h, cz];
    for (let k = 0; k < sides; k++) this.tri(top, t[(k + 1) % sides], t[k], col, glow);
  }
  cone(cx, cy, cz, r, h, sides, col, glow) {
    const apex = [cx, cy + h, cz];
    const ring = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      ring.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]);
    }
    for (let k = 0; k < sides; k++) this.tri(apex, ring[(k + 1) % sides], ring[k], col, glow);
  }
  // Flat disc facing +y.
  disc(cx, cy, cz, r, sides, col, glow) {
    const c = [cx, cy, cz];
    const ring = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      ring.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]);
    }
    for (let k = 0; k < sides; k++) this.tri(c, ring[(k + 1) % sides], ring[k], col, glow);
  }
  // Tapered palm frond: a bent quad strip from base toward dir.
  frond(bx, by, bz, dirX, dirZ, len, wid, col, glow) {
    const dx = dirX * len, dz = dirZ * len;
    const px = -dirZ * wid, pz = dirX * wid;
    const p0 = [bx - px, by, bz - pz], p1 = [bx + px, by, bz + pz];
    const m0 = [bx + dx * 0.55 - px * 0.6, by + len * 0.18, bz + dz * 0.55 - pz * 0.6];
    const m1 = [bx + dx * 0.55 + px * 0.6, by + len * 0.18, bz + dz * 0.55 + pz * 0.6];
    const tip = [bx + dx, by - len * 0.28, bz + dz];
    this.tri(p0, p1, m1, col, glow); this.tri(p0, m1, m0, col, glow);
    this.tri(m0, m1, tip, col, glow);
  }
  get count() { return this.p.length / 3; }
  arrays() {
    return {
      pos: new Float32Array(this.p), nrm: new Float32Array(this.n),
      col: new Float32Array(this.c), glow: new Float32Array(this.g),
      count: this.count,
    };
  }
}

const SCENE_VS = `
attribute vec3 aPos; attribute vec3 aNrm; attribute vec3 aCol; attribute float aGlow;
uniform mat4 uVP; uniform mat4 uModel; uniform vec3 uSunDir; uniform vec3 uCam;
varying vec3 vCol; varying float vGlow; varying float vLight; varying float vDist;
void main(){
  vec4 w = uModel * vec4(aPos, 1.0);
  gl_Position = uVP * w;
  vec3 n = normalize(mat3(uModel) * aNrm);
  vLight = max(dot(n, normalize(uSunDir)), 0.0);
  vCol = aCol; vGlow = aGlow;
  vDist = distance(w.xyz, uCam);
}`;
const SCENE_FS = `
precision mediump float;
uniform vec3 uSunCol; uniform float uAmb; uniform vec3 uFogCol;
uniform float uFogNear; uniform float uFogFar; uniform float uAlpha; uniform vec3 uTint; uniform float uGlow;
varying vec3 vCol; varying float vGlow; varying float vLight; varying float vDist;
void main(){
  vec3 base = vCol * uTint;
  vec3 lit = base * (uAmb + uSunCol * vLight);
  vec3 glowCol = base * 1.45 + vec3(0.12);
  vec3 col = mix(lit, glowCol, clamp(vGlow * uGlow, 0.0, 1.0));
  float f = clamp((vDist - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
  col = mix(col, uFogCol, f);
  gl_FragColor = vec4(col, uAlpha);
}`;
const SKY_VS = `
attribute vec2 aXY; varying vec2 vXY;
void main(){ vXY = aXY; gl_Position = vec4(aXY, 0.999, 1.0); }`;
const SKY_FS = `
precision mediump float;
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot;
uniform vec2 uSunPos; uniform vec3 uSunCol;
varying vec2 vXY;
void main(){
  float y = vXY.y * 0.5 + 0.5;
  vec3 col = y > 0.55 ? mix(uMid, uTop, (y - 0.55) / 0.45) : mix(uBot, uMid, y / 0.55);
  float d = distance(vXY, uSunPos);
  float disc = smoothstep(0.075, 0.055, d);
  float halo = smoothstep(0.42, 0.0, d) * 0.55;
  col += uSunCol * (disc * 0.9 + halo);
  gl_FragColor = vec4(col, 1.0);
}`;

export class Renderer {
  constructor(canvas) {
    this.gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: true });
    const gl = this.gl;
    if (!gl) throw new Error('WebGL unavailable');
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.scene = this.program(SCENE_VS, SCENE_FS, ['aPos', 'aNrm', 'aCol', 'aGlow']);
    this.sky = this.program(SKY_VS, SKY_FS, ['aXY']);
    this.skyBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.buffers = new Map();
  }
  program(vsSrc, fsSrc, attrs) {
    const gl = this.gl;
    const comp = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, comp(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, comp(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {};
    for (const a of attrs) loc[a] = gl.getAttribLocation(p, a);
    return { prog: p, loc };
  }
  uniform(prog, name) {
    return this.gl.getUniformLocation(prog.prog, name);
  }
  upload(mesh) {
    const gl = this.gl;
    const a = mesh.arrays();
    const mk = (data, size) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return b;
    };
    const buf = { pos: mk(a.pos, 3), nrm: mk(a.nrm, 3), col: mk(a.col, 3), glow: mk(a.glow, 1), count: a.count };
    return buf;
  }
  bind(buf) {
    const gl = this.gl;
    const L = this.scene.loc;
    const set = (b, loc, size) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    set(buf.pos, L.aPos, 3); set(buf.nrm, L.aNrm, 3); set(buf.col, L.aCol, 3); set(buf.glow, L.aGlow, 1);
  }
  begin(vp, cam, pal) {
    const gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Sky first, depth test off.
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.useProgram(this.sky.prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuf);
    gl.enableVertexAttribArray(this.sky.loc.aXY);
    gl.vertexAttribPointer(this.sky.loc.aXY, 2, gl.FLOAT, false, 0, 0);
    gl.uniform3fv(this.uniform(this.sky, 'uTop'), pal.skyTop);
    gl.uniform3fv(this.uniform(this.sky, 'uMid'), pal.skyMid);
    gl.uniform3fv(this.uniform(this.sky, 'uBot'), pal.skyBot);
    gl.uniform2fv(this.uniform(this.sky, 'uSunPos'), [(pal.sunPos[0] - 0.5) * 2, (pal.sunPos[1] - 0.5) * 2]);
    gl.uniform3fv(this.uniform(this.sky, 'uSunCol'), pal.sunCol2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    // Scene program state shared by all draws this frame.
    gl.useProgram(this.scene.prog);
    gl.uniformMatrix4fv(this.uniform(this.scene, 'uVP'), false, vp);
    gl.uniform3fv(this.uniform(this.scene, 'uSunDir'), pal.sunDir);
    gl.uniform3fv(this.uniform(this.scene, 'uCam'), cam);
    gl.uniform3fv(this.uniform(this.scene, 'uSunCol'), pal.sunCol);
    gl.uniform1f(this.uniform(this.scene, 'uAmb'), pal.amb);
    gl.uniform3fv(this.uniform(this.scene, 'uFogCol'), pal.fogCol);
    gl.uniform1f(this.uniform(this.scene, 'uFogNear'), pal.fogNear);
    gl.uniform1f(this.uniform(this.scene, 'uFogFar'), pal.fogFar);
    gl.uniform1f(this.uniform(this.scene, 'uGlow'), pal.glow === undefined ? 1 : pal.glow);
  }
  draw(buf, model, alpha, tint) {
    const gl = this.gl;
    this.bind(buf);
    gl.uniformMatrix4fv(this.uniform(this.scene, 'uModel'), false, model);
    gl.uniform1f(this.uniform(this.scene, 'uAlpha'), alpha === undefined ? 1 : alpha);
    gl.uniform3fv(this.uniform(this.scene, 'uTint'), tint || [1, 1, 1]);
    gl.drawArrays(gl.TRIANGLES, 0, buf.count);
  }
  drawTranslucent(buf, model, alpha, tint) {
    const gl = this.gl;
    gl.depthMask(false);
    this.draw(buf, model, alpha, tint);
    gl.depthMask(true);
  }
}
