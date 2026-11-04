// Desert for the Solar Atlas reveal, drawn on the graphics card.
// A ground plane in perspective: dune swells and wind ripples that shrink toward the horizon,
// low sun on the ripple crests, a few glinting grains up close, haze that melts the far sand
// into the sky, and a mirage: the pale sky reflected on the ground, broken up by heat shimmer.
// atlas-reveal.js clips the canvas to the sand shape every frame. Falls back to SVG if WebGL is missing.
(function () {
  'use strict';
  var VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  var FRAG = [
    'precision highp float;',
    'uniform vec2 uRes; uniform float uHorizon; uniform float uTime; uniform vec3 uGlow;',
    'float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }',
    'float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }',
    // sand height: broad dune swells plus asymmetric wind ripples, ripples fade with distance
    'float dunes(vec2 p){ return fbm(p * vec2(0.035, 0.06)); }',
    'float height(vec2 p, float lod){',
    '  float d = dunes(p) * 2.2;',
    '  float warp = fbm(p * vec2(0.22, 0.35)) * 2.6;',
    '  float r = sin(p.y * 7.5 + p.x * 1.1 + warp * 2.4);',
    '  r = pow(0.5 + 0.5 * r, 2.2);',
    '  return d + r * 0.13 * lod;',
    '}',
    'void main(){',
    '  float yTop = uRes.y - gl_FragCoord.y;',
    '  float dy = yTop - uHorizon;',
    '  float v = max(dy / uRes.y, 0.0006);',
    '  float z = 0.85 / v;',                                   // distance into the scene
    '  float x = (gl_FragCoord.x - uRes.x * 0.5) / uRes.y;',
    '  vec2 p = vec2(x * z * 1.15, z) + vec2(uTime * 0.015, 0.0);',
    '  float lod = exp(-z * 0.045);',
    '  float e = 0.012 + z * 0.01;',
    '  float h = height(p, lod);',
    '  float hx = height(p + vec2(e, 0.0), lod) - h;',
    '  float hz = height(p + vec2(0.0, e), lod) - h;',
    '  vec3 n = normalize(vec3(-hx / e, 1.0, -hz / e));',
    '  vec3 L = normalize(vec3(-0.85, 0.32, 0.35));',           // low sun from the left
    '  float diff = clamp(dot(n, L), 0.0, 1.0);',
    '  float dn = dunes(p);',
    '  vec3 sandLit = mix(vec3(0.98, 0.88, 0.70), vec3(0.95, 0.78, 0.55), dn);',
    '  vec3 sandShade = vec3(0.80, 0.68, 0.62);',
    '  vec3 col = mix(sandShade * sandLit, sandLit, smoothstep(0.02, 0.6, diff));',
    '  col += vec3(1.0, 0.9, 0.72) * pow(diff, 8.0) * 0.18 * lod;',  // crest highlights
    // glinting grains, only near the viewer
    '  vec2 cell = floor(gl_FragCoord.xy * 0.5);',
    '  float tw = hash(cell + floor(uTime * 1.5 + hash(cell) * 6.0));',
    '  col += vec3(1.0, 0.98, 0.92) * step(0.9994, tw) * smoothstep(5.0, 2.0, z) * diff * 0.55;',
    // fine grain
    '  col *= 0.97 + 0.06 * hash(gl_FragCoord.xy + fract(uTime) * 0.0);',
    // atmospheric haze toward the horizon
    '  vec3 sky = vec3(0.95, 0.93, 0.88);',
    '  float fog = 1.0 - exp(-z * 0.016);',
    '  col = mix(col, sky, fog * 0.82);',
    // mirage: sky reflected on the ground, strongest at the horizon, torn into streaks by heat shimmer
    '  float m = smoothstep(0.06, 0.005, v);',
    '  float sh = noise(vec2(gl_FragCoord.x * 0.012 + uTime * 0.35, dy * 0.42 - uTime * 2.2));',
    '  float sh2 = noise(vec2(gl_FragCoord.x * 0.05 - uTime * 0.6, dy * 1.1 - uTime * 3.4));',
    '  float streak = smoothstep(0.3, 0.8, sh * 0.7 + sh2 * 0.3);',
    '  vec3 refl = mix(vec3(0.86, 0.92, 0.95), vec3(1.0, 1.0, 0.98), streak);',
    '  col = mix(col, refl, m * (0.45 + 0.5 * streak));',
    '  col = mix(col, col * vec3(0.86, 0.82, 0.8), smoothstep(0.012, 0.02, v) * smoothstep(0.03, 0.02, v) * 0.12);', // distant dune line under the mirage
    // warm light spilling from the opened seam
    '  float gd = distance(vec2(gl_FragCoord.x, yTop), uGlow.xy) / uRes.y;',
    '  col += vec3(1.0, 0.8, 0.5) * uGlow.z * exp(-gd * 6.0) * 0.55;',
    // gentle darkening toward the bottom of the frame
    '  col *= mix(1.0, 0.93, smoothstep(0.1, 0.5, v));',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  window.CombineDesert = function (stage, before) {
    var canvas = document.createElement('canvas');
    canvas.className = 'rv-desert';
    canvas.setAttribute('aria-hidden', 'true');
    var gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return null;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; } return s; }
    var vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uRes = gl.getUniformLocation(prog, 'uRes'), uH = gl.getUniformLocation(prog, 'uHorizon'), uT = gl.getUniformLocation(prog, 'uTime'), uG = gl.getUniformLocation(prog, 'uGlow');
    stage.insertBefore(canvas, before);
    var dpr = 1, t0 = performance.now();
    return {
      canvas: canvas,
      resize: function (W, H) {
        dpr = Math.min(1.5, window.devicePixelRatio || 1);
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
      },
      // horizon, glowX, glowY in CSS px; glow 0..1; clip = the sand outline as an SVG path in CSS px
      draw: function (s) {
        canvas.style.clipPath = "path('" + s.clip + "')";
        canvas.style.opacity = String(s.opacity);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uH, s.horizon * dpr);
        gl.uniform1f(uT, s.still ? 0 : (performance.now() - t0) / 1000);
        gl.uniform3f(uG, s.glowX * dpr, s.glowY * dpr, s.glow);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    };
  };
})();
