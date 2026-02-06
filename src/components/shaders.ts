/**
 * Collection of post-processing shaders for 3D ASCII effects
 */

export const shaderVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// ============================================================================
// SHARED UTILITIES
// ============================================================================

const shaderUtils = /* glsl */ `
  float calculateLuminance(vec3 color) {
    return 0.299 * color.r + 0.587 * color.g + 0.114 * color.b;
  }

  vec3 adjustSaturation(vec3 color, float saturation) {
    float luminance = calculateLuminance(color);
    return mix(vec3(luminance), color, saturation);
  }

  vec3 adjustBrightness(vec3 color, float brightness) {
    return clamp(color + brightness, 0.0, 1.0);
  }

  vec3 adjustContrast(vec3 color, float contrast) {
    return clamp((color - 0.5) * contrast + 0.5, 0.0, 1.0);
  }

  vec3 adjustExposure(vec3 color, float exposure) {
    return clamp(color * pow(2.0, exposure), 0.0, 1.0);
  }

  vec3 processImageColor(vec3 color, float saturation, float brightness, float contrast, float exposure) {
    color = adjustExposure(color, exposure);
    color = adjustBrightness(color, brightness);
    color = adjustContrast(color, contrast);
    color = adjustSaturation(color, saturation);
    return color;
  }

  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = rand(i);
    float b = rand(i + vec2(1.0, 0.0));
    float c = rand(i + vec2(0.0, 1.0));
    float d = rand(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
`;

// ============================================================================
// 1. CRT SHADER - Retro monitor effect
// ============================================================================

export const crtShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uImage;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uExposure;
  uniform float uDarkMode;
  uniform float uIntensity;
  varying vec2 vUv;

  ${shaderUtils}

  vec2 curveRemapUV(vec2 uv) {
    uv = uv * 2.0 - 1.0;
    vec2 offset = abs(uv.yx) / vec2(6.0, 4.0);
    uv = uv + uv * offset * offset;
    uv = uv * 0.5 + 0.5;
    return uv;
  }

  vec3 scanline(vec2 uv, vec3 color) {
    float scanlineIntensity = sin(uv.y * uResolution.y * 2.0) * 0.04 * uIntensity;
    return color - scanlineIntensity;
  }

  vec3 chromaticAberration(sampler2D tex, vec2 uv) {
    float amount = 0.002 * uIntensity;
    vec3 col;
    col.r = texture2D(tex, vec2(uv.x + amount, uv.y)).r;
    col.g = texture2D(tex, uv).g;
    col.b = texture2D(tex, vec2(uv.x - amount, uv.y)).b;
    return col;
  }

  void main() {
    vec2 uv = curveRemapUV(vUv);

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      return;
    }

    vec3 color = chromaticAberration(uImage, uv);
    color = processImageColor(color, uSaturation, uBrightness, uContrast, uExposure);
    color = scanline(uv, color);

    // Vignette
    float vignette = 1.0 - pow(distance(vUv, vec2(0.5)) * 1.2, 2.0);
    color *= vignette;

    // Flickering
    color *= 1.0 + sin(uTime * 30.0) * 0.01 * uIntensity;

    // Phosphor glow
    color += color * 0.1 * uIntensity;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ============================================================================
// 2. GLITCH SHADER - Digital distortion
// ============================================================================

export const glitchShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uImage;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uExposure;
  uniform float uDarkMode;
  uniform float uIntensity;
  varying vec2 vUv;

  ${shaderUtils}

  void main() {
    vec2 uv = vUv;

    // Random block glitch
    float blockNoise = floor(noise(vec2(uTime * 2.0, floor(uv.y * 20.0))) * 2.0);
    float lineNoise = noise(vec2(uTime * 50.0, uv.y * 100.0));

    // Horizontal displacement
    float glitchStrength = step(0.97 - uIntensity * 0.1, rand(vec2(uTime * 0.5, floor(uv.y * 50.0))));
    uv.x += (rand(vec2(uTime, uv.y)) - 0.5) * 0.1 * glitchStrength * uIntensity;

    // RGB split
    float rgbSplit = 0.01 * uIntensity * (1.0 + sin(uTime * 10.0) * 0.5);
    vec3 color;
    color.r = texture2D(uImage, vec2(uv.x + rgbSplit, uv.y)).r;
    color.g = texture2D(uImage, uv).g;
    color.b = texture2D(uImage, vec2(uv.x - rgbSplit, uv.y)).b;

    // Color quantization glitch
    float quantize = mix(256.0, 8.0, glitchStrength * uIntensity);
    color = floor(color * quantize) / quantize;

    // Scanline noise
    color += (rand(uv + uTime) - 0.5) * 0.05 * uIntensity;

    color = processImageColor(color, uSaturation, uBrightness, uContrast, uExposure);

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ============================================================================
// 3. PIXELATE SHADER - Chunky pixels
// ============================================================================

export const pixelateShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uImage;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uExposure;
  uniform float uDarkMode;
  uniform float uIntensity;
  uniform float uBaseTileSize;
  varying vec2 vUv;

  ${shaderUtils}

  void main() {
    float pixelSize = uBaseTileSize * (1.0 + uIntensity * 2.0);
    vec2 pixels = uResolution / pixelSize;
    vec2 uv = floor(vUv * pixels) / pixels;

    vec3 color = texture2D(uImage, uv).rgb;

    // Color reduction based on intensity
    float levels = mix(256.0, 4.0, uIntensity);
    color = floor(color * levels) / levels;

    color = processImageColor(color, uSaturation, uBrightness, uContrast, uExposure);

    // Add subtle dithering
    float dither = (rand(vUv * uResolution + uTime) - 0.5) * 0.02;
    color += dither;

    // Pixel grid lines
    vec2 gridUV = fract(vUv * pixels);
    float grid = step(0.95, max(gridUV.x, gridUV.y)) * 0.1 * uIntensity;
    color -= grid;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ============================================================================
// 4. HALFTONE SHADER - Print dots effect
// ============================================================================

export const halftoneShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uImage;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uExposure;
  uniform float uDarkMode;
  uniform float uIntensity;
  uniform float uBaseTileSize;
  varying vec2 vUv;

  ${shaderUtils}

  float halftone(vec2 uv, float angle, float scale, float lum) {
    float s = sin(angle);
    float c = cos(angle);
    vec2 rotUV = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
    vec2 grid = fract(rotUV * scale) - 0.5;
    float dist = length(grid);
    float radius = sqrt(1.0 - lum) * 0.5;
    return smoothstep(radius, radius - 0.1, dist);
  }

  void main() {
    vec3 color = texture2D(uImage, vUv).rgb;
    color = processImageColor(color, uSaturation, uBrightness, uContrast, uExposure);

    float scale = uResolution.x / (uBaseTileSize * (3.0 - uIntensity * 2.0));
    vec2 uv = vUv * uResolution / uResolution.y;

    // CMYK-style halftone with different angles
    float c = halftone(uv, 0.26, scale, color.r);
    float m = halftone(uv, 0.52, scale, color.g);
    float y = halftone(uv, 0.0, scale, color.b);
    float k = halftone(uv, 0.78, scale, calculateLuminance(color));

    vec3 halftoneColor;
    if (uDarkMode > 0.5) {
      halftoneColor = vec3(c * color.r, m * color.g, y * color.b);
    } else {
      halftoneColor = vec3(1.0) - vec3(1.0 - c, 1.0 - m, 1.0 - y) * 0.8;
      halftoneColor *= color + 0.2;
    }

    gl_FragColor = vec4(halftoneColor, 1.0);
  }
`;

// ============================================================================
// 5. MATRIX SHADER - Digital rain
// ============================================================================

export const matrixShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uImage;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uExposure;
  uniform float uDarkMode;
  uniform float uIntensity;
  uniform float uBaseTileSize;
  varying vec2 vUv;

  ${shaderUtils}

  float character(float n, vec2 p) {
    p = floor(p * vec2(4.0, 4.0) + 2.5);
    if (clamp(p.x, 0.0, 4.0) == p.x && clamp(p.y, 0.0, 4.0) == p.y) {
      float index = p.x + p.y * 4.0;
      if (int(mod(n / pow(2.0, index), 2.0)) == 1) return 1.0;
    }
    return 0.0;
  }

  void main() {
    float tileSize = uBaseTileSize * 1.5;
    vec2 uv = floor(vUv * uResolution / tileSize) * tileSize / uResolution;
    vec3 color = texture2D(uImage, uv).rgb;
    color = processImageColor(color, uSaturation, uBrightness, uContrast, uExposure);

    float lum = calculateLuminance(color);

    // Rain effect
    vec2 grid = vUv * uResolution / tileSize;
    float columnOffset = rand(vec2(floor(grid.x), 0.0)) * 100.0;
    float rainSpeed = 2.0 + rand(vec2(floor(grid.x), 1.0)) * 3.0;
    float rain = fract(grid.y * 0.1 - uTime * rainSpeed * uIntensity + columnOffset);
    float rainBrightness = pow(rain, 3.0);

    // Character grid
    vec2 charUV = fract(grid) - 0.5;
    float charIndex = floor(rand(floor(grid) + floor(uTime * 10.0 * uIntensity)) * 16.0);
    float chars = character(65536.0 * rand(vec2(charIndex, 0.0)), charUV);

    // Matrix green with luminance
    vec3 matrixColor = vec3(0.1, 1.0, 0.3) * chars * (lum * 0.5 + 0.5);
    matrixColor *= rainBrightness * uIntensity + (1.0 - uIntensity);

    // Mix with original based on intensity
    vec3 finalColor = mix(color, matrixColor, uIntensity * 0.8);

    // Add glow
    finalColor += matrixColor * 0.3;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ============================================================================
// 6. THERMAL SHADER - Heat vision
// ============================================================================

export const thermalShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uImage;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uExposure;
  uniform float uDarkMode;
  uniform float uIntensity;
  varying vec2 vUv;

  ${shaderUtils}

  vec3 thermalGradient(float t) {
    // Black -> Blue -> Purple -> Red -> Orange -> Yellow -> White
    vec3 colors[7];
    colors[0] = vec3(0.0, 0.0, 0.0);
    colors[1] = vec3(0.0, 0.0, 0.5);
    colors[2] = vec3(0.5, 0.0, 0.5);
    colors[3] = vec3(1.0, 0.0, 0.0);
    colors[4] = vec3(1.0, 0.5, 0.0);
    colors[5] = vec3(1.0, 1.0, 0.0);
    colors[6] = vec3(1.0, 1.0, 1.0);

    t = clamp(t, 0.0, 1.0) * 6.0;
    int i = int(floor(t));
    float f = fract(t);

    if (i >= 6) return colors[6];

    vec3 c1 = colors[i];
    vec3 c2 = colors[i + 1];
    return mix(c1, c2, f);
  }

  void main() {
    vec3 color = texture2D(uImage, vUv).rgb;
    color = processImageColor(color, uSaturation, uBrightness, uContrast, uExposure);

    float heat = calculateLuminance(color);

    // Add noise for thermal camera effect
    float thermalNoise = noise(vUv * 200.0 + uTime * 5.0) * 0.05 * uIntensity;
    heat += thermalNoise;

    // Pulsing effect
    heat += sin(uTime * 2.0) * 0.02 * uIntensity;

    vec3 thermalColor = thermalGradient(heat);

    // Mix with original
    vec3 finalColor = mix(color, thermalColor, uIntensity);

    // Scanline effect
    float scanline = sin(vUv.y * uResolution.y * 0.5) * 0.02 * uIntensity;
    finalColor -= scanline;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ============================================================================
// 7. NEON SHADER - Glowing edges
// ============================================================================

export const neonShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uImage;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uExposure;
  uniform float uDarkMode;
  uniform float uIntensity;
  varying vec2 vUv;

  ${shaderUtils}

  void main() {
    vec2 texel = 1.0 / uResolution;

    // Sobel edge detection
    vec3 tl = texture2D(uImage, vUv + texel * vec2(-1, 1)).rgb;
    vec3 t  = texture2D(uImage, vUv + texel * vec2(0, 1)).rgb;
    vec3 tr = texture2D(uImage, vUv + texel * vec2(1, 1)).rgb;
    vec3 l  = texture2D(uImage, vUv + texel * vec2(-1, 0)).rgb;
    vec3 c  = texture2D(uImage, vUv).rgb;
    vec3 r  = texture2D(uImage, vUv + texel * vec2(1, 0)).rgb;
    vec3 bl = texture2D(uImage, vUv + texel * vec2(-1, -1)).rgb;
    vec3 b  = texture2D(uImage, vUv + texel * vec2(0, -1)).rgb;
    vec3 br = texture2D(uImage, vUv + texel * vec2(1, -1)).rgb;

    vec3 gx = -tl - 2.0*l - bl + tr + 2.0*r + br;
    vec3 gy = -tl - 2.0*t - tr + bl + 2.0*b + br;

    float edge = length(gx) + length(gy);
    edge = smoothstep(0.0, 0.5, edge);

    c = processImageColor(c, uSaturation, uBrightness, uContrast, uExposure);

    // Neon colors cycling
    float hue = fract(uTime * 0.1 + vUv.x * 0.5 + vUv.y * 0.3);
    vec3 neonColor;
    if (hue < 0.33) {
      neonColor = mix(vec3(1.0, 0.0, 0.5), vec3(0.0, 1.0, 1.0), hue * 3.0);
    } else if (hue < 0.66) {
      neonColor = mix(vec3(0.0, 1.0, 1.0), vec3(1.0, 1.0, 0.0), (hue - 0.33) * 3.0);
    } else {
      neonColor = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.0, 0.5), (hue - 0.66) * 3.0);
    }

    // Glow effect
    vec3 glow = neonColor * edge * 2.0 * uIntensity;

    // Dark background for neon effect
    vec3 bg = c * (1.0 - uIntensity * 0.8);

    vec3 finalColor = bg + glow;

    // Bloom
    finalColor += glow * 0.5;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ============================================================================
// 8. SKETCH SHADER - Pencil drawing
// ============================================================================

export const sketchShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uImage;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uExposure;
  uniform float uDarkMode;
  uniform float uIntensity;
  varying vec2 vUv;

  ${shaderUtils}

  void main() {
    vec2 texel = 1.0 / uResolution;
    vec3 color = texture2D(uImage, vUv).rgb;
    color = processImageColor(color, uSaturation, uBrightness, uContrast, uExposure);

    // Multi-directional edge detection for crosshatch
    float edge1 = 0.0, edge2 = 0.0, edge3 = 0.0;

    for (float i = -2.0; i <= 2.0; i++) {
      vec3 s1 = texture2D(uImage, vUv + texel * vec2(i, i)).rgb;
      vec3 s2 = texture2D(uImage, vUv + texel * vec2(i, -i)).rgb;
      vec3 s3 = texture2D(uImage, vUv + texel * vec2(i, 0.0)).rgb;
      edge1 += calculateLuminance(s1);
      edge2 += calculateLuminance(s2);
      edge3 += calculateLuminance(s3);
    }

    float lum = calculateLuminance(color);
    float centerLum = lum * 5.0;

    float diff1 = abs(edge1 - centerLum);
    float diff2 = abs(edge2 - centerLum);
    float diff3 = abs(edge3 - centerLum);

    float edges = (diff1 + diff2 + diff3) / 3.0;
    edges = smoothstep(0.0, 0.3, edges);

    // Paper texture
    float paper = noise(vUv * uResolution * 0.5 + uTime * 0.1) * 0.1;

    // Crosshatch based on luminance
    vec2 hatchUV = vUv * uResolution * 0.1;
    float hatch1 = step(0.5, fract(hatchUV.x + hatchUV.y)) * step(lum, 0.3);
    float hatch2 = step(0.5, fract(hatchUV.x - hatchUV.y)) * step(lum, 0.5);
    float hatch3 = step(0.5, fract(hatchUV.x * 2.0)) * step(lum, 0.2);

    float hatching = (hatch1 + hatch2 + hatch3) * 0.15 * uIntensity;

    // Combine
    vec3 paperColor = uDarkMode > 0.5 ? vec3(0.1) : vec3(0.95);
    vec3 inkColor = uDarkMode > 0.5 ? vec3(0.9) : vec3(0.1);

    float sketch = edges + hatching;
    vec3 sketchColor = mix(paperColor, inkColor, sketch);
    sketchColor += paper * (uDarkMode > 0.5 ? 1.0 : -1.0);

    vec3 finalColor = mix(color, sketchColor, uIntensity);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ============================================================================
// 9. VAPORWAVE SHADER - Aesthetic retro
// ============================================================================

export const vaporwaveShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uImage;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uExposure;
  uniform float uDarkMode;
  uniform float uIntensity;
  varying vec2 vUv;

  ${shaderUtils}

  void main() {
    vec2 uv = vUv;

    // Subtle wave distortion
    uv.x += sin(uv.y * 10.0 + uTime) * 0.005 * uIntensity;
    uv.y += cos(uv.x * 10.0 + uTime) * 0.005 * uIntensity;

    vec3 color = texture2D(uImage, uv).rgb;
    color = processImageColor(color, uSaturation, uBrightness, uContrast, uExposure);

    // Vaporwave color palette
    vec3 pink = vec3(1.0, 0.4, 0.7);
    vec3 cyan = vec3(0.4, 1.0, 1.0);
    vec3 purple = vec3(0.6, 0.2, 0.8);

    float lum = calculateLuminance(color);

    // Map luminance to vaporwave gradient
    vec3 vaporColor;
    if (lum < 0.33) {
      vaporColor = mix(purple, pink, lum * 3.0);
    } else if (lum < 0.66) {
      vaporColor = mix(pink, cyan, (lum - 0.33) * 3.0);
    } else {
      vaporColor = mix(cyan, vec3(1.0), (lum - 0.66) * 3.0);
    }

    // Preserve some original color
    vaporColor = mix(vaporColor, color * vec3(1.2, 0.8, 1.2), 0.3);

    // Scanlines
    float scanline = sin(vUv.y * uResolution.y * 1.0) * 0.03 * uIntensity;
    vaporColor -= scanline;

    // Grid overlay
    vec2 grid = abs(fract(vUv * 20.0) - 0.5);
    float gridLine = step(0.48, max(grid.x, grid.y)) * 0.1 * uIntensity;
    vaporColor = mix(vaporColor, pink, gridLine);

    // Sun reflection gradient at bottom
    float sunGradient = smoothstep(0.0, 0.4, 1.0 - vUv.y) * uIntensity * 0.3;
    vaporColor += vec3(1.0, 0.5, 0.3) * sunGradient;

    // Chromatic aberration
    float caAmount = 0.002 * uIntensity;
    vec3 ca;
    ca.r = texture2D(uImage, uv + vec2(caAmount, 0.0)).r;
    ca.b = texture2D(uImage, uv - vec2(caAmount, 0.0)).b;
    vaporColor.r = mix(vaporColor.r, ca.r * pink.r, 0.3);
    vaporColor.b = mix(vaporColor.b, ca.b * cyan.b, 0.3);

    vec3 finalColor = mix(color, vaporColor, uIntensity);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ============================================================================
// 10. NOIR SHADER - Film noir black & white
// ============================================================================

export const noirShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uImage;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uExposure;
  uniform float uDarkMode;
  uniform float uIntensity;
  varying vec2 vUv;

  ${shaderUtils}

  void main() {
    vec3 color = texture2D(uImage, vUv).rgb;
    color = processImageColor(color, uSaturation, uBrightness, uContrast, uExposure);

    // Convert to grayscale with high contrast
    float lum = calculateLuminance(color);

    // S-curve for dramatic contrast
    lum = lum * lum * (3.0 - 2.0 * lum);
    lum = pow(lum, 1.0 + uIntensity * 0.5);

    vec3 bw = vec3(lum);

    // Film grain
    float grain = (rand(vUv * uResolution + uTime * 100.0) - 0.5) * 0.15 * uIntensity;
    bw += grain;

    // Vignette - stronger for noir
    float vignette = 1.0 - pow(distance(vUv, vec2(0.5)) * 1.5, 2.0);
    vignette = mix(1.0, vignette, uIntensity);
    bw *= vignette;

    // Subtle sepia tint
    vec3 sepia = vec3(1.0, 0.95, 0.85);
    bw *= mix(vec3(1.0), sepia, uIntensity * 0.3);

    // Scratches
    float scratch = step(0.998, rand(vec2(floor(vUv.x * uResolution.x * 0.1), uTime)));
    scratch *= rand(vUv + uTime) * uIntensity;
    bw += scratch * 0.3;

    // Dust particles
    float dust = step(0.9995, rand(vUv * uResolution + floor(uTime * 10.0)));
    bw -= dust * 0.5 * uIntensity;

    vec3 finalColor = mix(color, bw, uIntensity);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ============================================================================
// SHADER MAP
// ============================================================================

export type ShaderType =
  | 'ascii'
  | 'crt'
  | 'glitch'
  | 'pixelate'
  | 'halftone'
  | 'matrix'
  | 'thermal'
  | 'neon'
  | 'sketch'
  | 'vaporwave'
  | 'noir';

export const shaderMap: Record<Exclude<ShaderType, 'ascii'>, string> = {
  crt: crtShader,
  glitch: glitchShader,
  pixelate: pixelateShader,
  halftone: halftoneShader,
  matrix: matrixShader,
  thermal: thermalShader,
  neon: neonShader,
  sketch: sketchShader,
  vaporwave: vaporwaveShader,
  noir: noirShader,
};

export const shaderNames: Record<ShaderType, string> = {
  ascii: 'ASCII Pattern',
  crt: 'CRT Monitor',
  glitch: 'Digital Glitch',
  pixelate: 'Pixelate',
  halftone: 'Halftone Print',
  matrix: 'Matrix Rain',
  thermal: 'Thermal Vision',
  neon: 'Neon Glow',
  sketch: 'Pencil Sketch',
  vaporwave: 'Vaporwave',
  noir: 'Film Noir',
};
