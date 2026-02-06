'use client';

/**
 * Card3DAscii - 3D models with ASCII post-processing shader
 *
 * Renders 3D models to a texture, then applies an ASCII pattern shader
 * as post-processing. Includes optional fluid simulation for interactive painting.
 */

import { Canvas, useFrame, useThree, createPortal } from '@react-three/fiber';
import { useGLTF, Float } from '@react-three/drei';
import { useRef, useEffect, useState, useMemo, Suspense, useCallback } from 'react';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { ShaderType, shaderMap, shaderVertex } from './shaders';

// ============================================================================
// DOUBLE FBO CLASS - Ping-pong rendering for fluid simulation
// ============================================================================

class DoubleFBO {
  public read: THREE.WebGLRenderTarget;
  public write: THREE.WebGLRenderTarget;

  constructor(width: number, height: number, options: THREE.RenderTargetOptions) {
    this.read = new THREE.WebGLRenderTarget(width, height, options);
    this.write = new THREE.WebGLRenderTarget(width, height, options);
  }

  get texture(): THREE.Texture {
    return this.read.texture;
  }

  swap() {
    const temp = this.read;
    this.read = this.write;
    this.write = temp;
  }

  dispose() {
    this.read.dispose();
    this.write.dispose();
  }
}

// ============================================================================
// QUAD GEOMETRY - Fullscreen triangle for efficient rendering
// ============================================================================

const quadGeometry = new THREE.BufferGeometry();
quadGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)
);
quadGeometry.setAttribute(
  'uv',
  new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2)
);

const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2);
quadCamera.position.set(0, 0, 1);

// ============================================================================
// FLUID SIMULATION SHADERS
// ============================================================================

const fluidBaseVertex = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec2 vL;
  varying vec2 vR;
  varying vec2 vT;
  varying vec2 vB;
  uniform vec2 texelSize;
  void main () {
    vUv = uv;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const splatShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTarget;
  uniform float aspectRatio;
  uniform vec3 color;
  uniform vec2 point;
  uniform float radius;
  void main () {
    vec2 p = vUv - point.xy;
    p.x *= aspectRatio;
    vec3 splat = exp(-dot(p, p) / radius) * color;
    vec3 base = texture2D(uTarget, vUv).xyz;
    gl_FragColor = vec4(base + splat, 1.0);
  }
`;

const advectionShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uVelocity;
  uniform sampler2D uSource;
  uniform vec2 texelSize;
  uniform float dt;
  uniform float dissipation;
  void main () {
    vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
    gl_FragColor = dissipation * texture2D(uSource, coord);
    gl_FragColor.a = 1.0;
  }
`;

const fillShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform vec3 uColor;
  void main () {
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

// ============================================================================
// ASCII PATTERN SHADER
// ============================================================================

const asciiVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const asciiFragmentShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uImage;
  uniform vec2 uImageDimensions;
  uniform sampler2D uDeformTexture;
  uniform vec2 uResolution;
  uniform vec2 uLogicalResolution;
  uniform float uCoordinateScale;
  uniform int uPatternCount;
  uniform float uBaseTileSize;
  uniform float uTime;
  uniform float uDeformStrength;
  uniform float uRandomSpeed;
  uniform float uRandomSpread;
  uniform float uRandomThreshold;
  uniform float uUseWhiteBackground;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uExposure;
  uniform float uAltPatternOpacity;
  uniform float uEnableFadeTransition;
  uniform float uFadeThreshold;
  uniform float uFadeWidth;
  uniform float uUseOriginalSvgColors;
  uniform sampler2D uPatternAtlas;
  uniform sampler2D uAltPatternAtlas;
  uniform int uPatternAtlasColumns;
  uniform int uAltPatternAtlasColumns;
  uniform float uDarkMode;
  uniform float uBottomFade;
  varying vec2 vUv;

  const float TIME_SPEED = 0.5;
  const float SPATIAL_FREQ = 0.008;
  const float TIME_AMPLITUDE = 0.1;

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

  vec3 processImageColor(vec3 color) {
    color = adjustExposure(color, uExposure);
    color = adjustBrightness(color, uBrightness);
    color = adjustContrast(color, uContrast);
    color = adjustSaturation(color, uSaturation);
    return color;
  }

  vec4 samplePatternAtlas(sampler2D atlas, int atlasColumns, int patternIndex, vec2 uv) {
    float colIndex = float(patternIndex);
    vec2 atlasOffset = vec2(colIndex / float(atlasColumns), 0.0);
    vec2 atlasUV = (uv / vec2(float(atlasColumns), 1.0)) + atlasOffset;
    return texture2D(atlas, atlasUV);
  }

  vec4 sampleAltPatternAtlas(sampler2D atlas, int atlasColumns, int patternIndex, vec2 uv) {
    float colIndex = float(patternIndex);
    vec2 margin = vec2(0.5 / 512.0, 0.0);
    vec2 scaledUV = uv * (1.0 - 2.0 * margin.x) + margin;
    vec2 atlasOffset = vec2(colIndex / float(atlasColumns), 0.0);
    vec2 atlasUV = (scaledUV / vec2(float(atlasColumns), 1.0)) + atlasOffset;
    return texture2D(atlas, atlasUV);
  }

  vec3 getColorForIntensity(int patternIndex, float patternAlpha, bool useOriginalColors, vec3 originalColor, vec4 patternColor) {
    if (useOriginalColors) {
      vec3 backgroundColor = vec3(1.0, 1.0, 1.0);
      if (patternAlpha < 0.001) {
        return backgroundColor;
      }
      if (uUseOriginalSvgColors > 0.5) {
        return mix(backgroundColor, patternColor.rgb, patternAlpha);
      } else {
        vec3 blendedColor = mix(backgroundColor, originalColor, patternAlpha);
        return mix(backgroundColor, blendedColor, uAltPatternOpacity);
      }
    } else {
      vec3 backgroundColor = vec3(1.0, 1.0, 1.0);
      vec3 color1 = vec3(0.949, 0.949, 0.949);
      vec3 color2 = vec3(0.91, 0.91, 0.91);
      vec3 color2b = vec3(0.925, 0.925, 0.925);
      vec3 color3 = vec3(0.98, 0.98, 0.98);
      vec3 color4 = vec3(0.99, 0.99, 0.99);

      if (uDarkMode > 0.5) {
        backgroundColor = vec3(0.0, 0.0, 0.0);
        color1 = vec3(0.33, 0.33, 0.33);
        color2 = vec3(0.33, 0.33, 0.33);
        color2b = vec3(0.33, 0.33, 0.33);
        color3 = vec3(0.33, 0.33, 0.33);
        color4 = vec3(0.33, 0.33, 0.33);
      }

      if (patternAlpha < 0.001) {
        return backgroundColor;
      } else {
        vec3 baseColor;
        if (patternIndex <= 1) baseColor = color1;
        else if (patternIndex == 2) baseColor = color2;
        else if (patternIndex == 3) baseColor = color2b;
        else if (patternIndex <= 4) baseColor = color3;
        else baseColor = color4;
        return baseColor;
      }
    }
  }

  void main() {
    vec2 pix = gl_FragCoord.xy * uCoordinateScale;
    vec2 tilePos = floor(pix / uBaseTileSize) * uBaseTileSize;
    vec2 tileCenterUV = (tilePos + uBaseTileSize * 0.5) / uLogicalResolution;
    vec2 adjustedTileCenter = tileCenterUV;

    if (adjustedTileCenter.x < 0.0 || adjustedTileCenter.x > 1.0 || adjustedTileCenter.y < 0.0 || adjustedTileCenter.y > 1.0) {
      if (uDarkMode > 0.5) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
      } else {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      }
      return;
    }

    vec3 originalCol = texture2D(uImage, adjustedTileCenter).rgb;
    originalCol = processImageColor(originalCol);

    if (length(originalCol) < 0.04) {
      if (uUseWhiteBackground > 0.5) {
        if (uDarkMode > 0.5) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        } else {
          gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        }
        return;
      } else {
        vec2 pixelInTile = mod(pix, uBaseTileSize);
        vec2 patternUV = pixelInTile / uBaseTileSize;
        vec4 patternColor = samplePatternAtlas(uPatternAtlas, uPatternAtlasColumns, 0, patternUV);

        vec3 backgroundColor = vec3(1.0, 1.0, 1.0);
        if (uDarkMode > 0.5) {
          backgroundColor = vec3(0.0, 0.0, 0.0);
        }

        if (patternColor.a < 0.001) {
          gl_FragColor = vec4(backgroundColor, 1.0);
        } else {
          gl_FragColor = vec4(vec3(0.98, 0.98, 0.98), 1.0);
        }
        return;
      }
    }

    float lum = calculateLuminance(originalCol);

    vec2 tileIndex = floor(pix / uBaseTileSize);
    float timeOffset = sin(uTime * TIME_SPEED + dot(tileIndex, vec2(SPATIAL_FREQ))) * TIME_AMPLITUDE;
    lum = clamp(lum + timeOffset, 0.0, 1.0);

    lum = 0.85 - lum;

    float scaledIntensity = lum * 5.0;

    int patternIndex;
    if (scaledIntensity < 0.5) patternIndex = 0;
    else if (scaledIntensity < 3.5) patternIndex = int(floor(scaledIntensity * 0.8)) + 1;
    else if (scaledIntensity < 5.0) patternIndex = 4;
    else patternIndex = 5;

    patternIndex = clamp(patternIndex, 0, 5);

    vec2 pixelInTile = mod(pix, uBaseTileSize);
    vec2 patternUV = pixelInTile / uBaseTileSize;

    vec3 deformColor = texture2D(uDeformTexture, adjustedTileCenter).rgb;
    float paintStrength = (deformColor.r + deformColor.g + deformColor.b) / 3.0;

    float transitionFactor = 0.0;
    bool useAltPatterns = false;

    if (uEnableFadeTransition > 0.5) {
      float fadeStart = uFadeThreshold;
      float fadeEnd = uFadeThreshold + uFadeWidth;
      transitionFactor = smoothstep(fadeStart, fadeEnd, paintStrength);
      useAltPatterns = paintStrength > uFadeThreshold;
    } else {
      useAltPatterns = paintStrength > uFadeThreshold;
      transitionFactor = useAltPatterns ? 1.0 : 0.0;
    }

    vec4 altPatternColor;
    vec4 regularPatternColor;

    int regularAtlasIndex;
    if (patternIndex == 0) regularAtlasIndex = max(0, uPatternAtlasColumns - 1);
    else if (patternIndex == 1) regularAtlasIndex = max(0, uPatternAtlasColumns - 2);
    else if (patternIndex == 2) regularAtlasIndex = max(0, uPatternAtlasColumns - 3);
    else if (patternIndex == 3) regularAtlasIndex = max(0, uPatternAtlasColumns - 4);
    else if (patternIndex == 4) regularAtlasIndex = max(0, uPatternAtlasColumns - 5);
    else regularAtlasIndex = 0;

    int altPatternIndex;
    if (lum < 0.1) altPatternIndex = 0;
    else if (lum < 0.3) altPatternIndex = 1;
    else if (lum < 0.5) altPatternIndex = 2;
    else if (lum < 0.7) altPatternIndex = 3;
    else if (lum < 0.9) altPatternIndex = 4;
    else altPatternIndex = 5;

    altPatternIndex = clamp(altPatternIndex, 0, 5);
    int altAtlasIndex = min(altPatternIndex, uAltPatternAtlasColumns - 1);

    altPatternColor = sampleAltPatternAtlas(uAltPatternAtlas, uAltPatternAtlasColumns, altAtlasIndex, patternUV);
    regularPatternColor = samplePatternAtlas(uPatternAtlas, uPatternAtlasColumns, regularAtlasIndex, patternUV);

    vec4 patternColor = mix(regularPatternColor, altPatternColor, transitionFactor);

    vec3 altColor = getColorForIntensity(altPatternIndex, altPatternColor.a, true, originalCol, altPatternColor);
    vec3 regularColor = getColorForIntensity(patternIndex, regularPatternColor.a, false, originalCol, regularPatternColor);

    bool regularNeedsFallback = (regularColor.r >= 0.999 && regularColor.g >= 0.999 && regularColor.b >= 0.999);

    if (regularNeedsFallback) {
      vec4 regularFallbackPattern;
      if (patternIndex <= 2) {
        regularFallbackPattern = samplePatternAtlas(uPatternAtlas, uPatternAtlasColumns, uPatternAtlasColumns - 2, patternUV);
      } else {
        regularFallbackPattern = samplePatternAtlas(uPatternAtlas, uPatternAtlasColumns, uPatternAtlasColumns - 3, patternUV);
      }

      if (regularFallbackPattern.a < 0.001) {
        vec3 backgroundColor = vec3(1.0, 1.0, 1.0);
        if (uDarkMode > 0.5) {
          backgroundColor = vec3(0.0, 0.0, 0.0);
        }
        regularColor = backgroundColor;
      } else {
        regularColor = vec3(0.925, 0.925, 0.925);
      }
    }

    vec3 finalColor = mix(regularColor, altColor, transitionFactor);

    if (uBottomFade > 0.5) {
      float fadeStart = 0.3;
      float fadeStrength = smoothstep(0.0, fadeStart, vUv.y);
      fadeStrength = fadeStrength * fadeStrength * (3.0 - 2.0 * fadeStrength);
      finalColor = mix(uDarkMode > 0.5 ? vec3(0.0) : vec3(1.0), finalColor, fadeStrength);
    }

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ============================================================================
// DISPLAY SHADER
// ============================================================================

const displayVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const displayFragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2 vUv;
  void main() {
    gl_FragColor = texture2D(uMap, vUv);
  }
`;

// ============================================================================
// 3D MODEL COMPONENT
// ============================================================================

interface ModelProps {
  modelPath: string;
  isHovered: boolean;
  mouseUV: THREE.Vector2;
  enableFloat?: boolean;
  floatSpeed?: number;
  floatIntensity?: number;
  modelScale?: number;
}

function Model({ modelPath, isHovered, mouseUV, enableFloat = true, floatSpeed = 1.5, floatIntensity = 0.8, modelScale = 1.0 }: ModelProps) {
  const { scene } = useGLTF(modelPath);
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;

    if (isHovered && mouseUV.x >= 0 && mouseUV.y >= 0) {
      const targetRotationY = (mouseUV.x - 0.5) * Math.PI * 0.33;
      const targetRotationX = -(mouseUV.y - 0.5) * Math.PI * 0.33;

      groupRef.current.rotation.y = MathUtils.lerp(groupRef.current.rotation.y, targetRotationY, 0.08);
      groupRef.current.rotation.x = MathUtils.lerp(groupRef.current.rotation.x, targetRotationX, 0.08);
    } else {
      groupRef.current.rotation.y = MathUtils.lerp(groupRef.current.rotation.y, 0, 0.05);
      groupRef.current.rotation.x = MathUtils.lerp(groupRef.current.rotation.x, 0, 0.05);
    }
  });

  const modelContent = (
    <group ref={groupRef}>
      <primitive object={scene.clone()} scale={modelScale} />
    </group>
  );

  if (enableFloat) {
    return (
      <Float speed={floatSpeed} rotationIntensity={0.15} floatIntensity={floatIntensity}>
        {modelContent}
      </Float>
    );
  }

  return modelContent;
}

// ============================================================================
// SCENE WITH 3D + ASCII POST-PROCESSING
// ============================================================================

interface SceneProps {
  modelPath: string;
  accentColor: string;
  tileSize: number;
  darkMode: boolean;
  saturation: number;
  brightness: number;
  contrast: number;
  exposure: number;
  animationSpeed: number;
  enableFloat: boolean;
  floatSpeed: number;
  floatIntensity: number;
  enablePainting: boolean;
  paintRadius: number;
  velocityDissipation: number;
  densityDissipation: number;
  useBlockyPattern: boolean;
  luminanceOffset: number;
  fadeThreshold: number;
  fadeWidth: number;
  patternOpacity: number;
  enableFadeTransition: boolean;
  invertLuminance: boolean;
  mouseUV: THREE.Vector2;
  isCardHovered: boolean;
  modelScale: number;
  shaderType: ShaderType;
  shaderIntensity: number;
}

function Scene3DAscii({
  modelPath,
  accentColor,
  tileSize,
  darkMode,
  saturation,
  brightness,
  contrast,
  exposure,
  animationSpeed,
  enableFloat,
  floatSpeed,
  floatIntensity,
  enablePainting,
  paintRadius,
  velocityDissipation,
  densityDissipation,
  useBlockyPattern,
  luminanceOffset,
  fadeThreshold,
  fadeWidth,
  patternOpacity,
  enableFadeTransition,
  invertLuminance,
  mouseUV,
  isCardHovered,
  modelScale,
  shaderType,
  shaderIntensity,
}: SceneProps) {
  const { size, gl, camera } = useThree();
  const timeRef = useRef(0);

  const [patternAtlas, setPatternAtlas] = useState<THREE.Texture | null>(null);
  const [altPatternAtlas, setAltPatternAtlas] = useState<THREE.Texture | null>(null);

  const lastMouseRef = useRef(new THREE.Vector2(-1, -1));
  const isMouseInitRef = useRef(false);

  const sceneFBO = useMemo(() => new THREE.WebGLRenderTarget(
    size.width * 2, size.height * 2,
    { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat }
  ), [size.width, size.height]);

  const velocityFBO = useMemo(() => new DoubleFBO(128, 128, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat, type: THREE.HalfFloatType,
  }), []);

  const densityFBO = useMemo(() => new DoubleFBO(512, 512, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat, type: THREE.HalfFloatType,
  }), []);

  const patternFBO = useMemo(() => {
    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    return new THREE.WebGLRenderTarget(
      Math.round(size.width * 2 * pixelRatio),
      Math.round(size.height * 2 * pixelRatio),
      { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat }
    );
  }, [size.width, size.height]);

  const modelScene = useMemo(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(darkMode ? 0x000000 : 0x010101);
    return scene;
  }, [darkMode]);

  const splatMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: fluidBaseVertex,
    fragmentShader: splatShader,
    uniforms: {
      texelSize: { value: new THREE.Vector2(1/128, 1/128) },
      uTarget: { value: null },
      aspectRatio: { value: 1 },
      color: { value: new THREE.Vector3() },
      point: { value: new THREE.Vector2() },
      radius: { value: paintRadius },
    },
  }), [paintRadius]);

  const advectionMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: fluidBaseVertex,
    fragmentShader: advectionShader,
    uniforms: {
      texelSize: { value: new THREE.Vector2(1/128, 1/128) },
      uVelocity: { value: null },
      uSource: { value: null },
      dt: { value: 0.016 },
      dissipation: { value: 1 },
    },
  }), []);

  const fillMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: fluidBaseVertex,
    fragmentShader: fillShader,
    uniforms: {
      texelSize: { value: new THREE.Vector2(1/512, 1/512) },
      uColor: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
    },
  }), []);

  const densityInitializedRef = useRef(false);

  const asciiMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: asciiVertexShader,
    fragmentShader: asciiFragmentShader,
    uniforms: {
      uImage: { value: null },
      uImageDimensions: { value: new THREE.Vector2(size.width, size.height) },
      uDeformTexture: { value: null },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uLogicalResolution: { value: new THREE.Vector2(size.width, size.height) },
      uCoordinateScale: { value: 1.0 },
      uPatternCount: { value: 6 },
      uBaseTileSize: { value: tileSize },
      uTime: { value: 0 },
      uDeformStrength: { value: 0.05 },
      uRandomSpeed: { value: 0.1 },
      uRandomSpread: { value: 0.5 },
      uRandomThreshold: { value: 0.3 },
      uUseWhiteBackground: { value: 1.0 },
      uSaturation: { value: 1.0 },
      uBrightness: { value: 0.0 },
      uContrast: { value: 1.0 },
      uExposure: { value: 0.0 },
      uAltPatternOpacity: { value: 1.0 },
      uEnableFadeTransition: { value: 0.0 },
      uFadeThreshold: { value: 0.1 },
      uFadeWidth: { value: 0.05 },
      uUseOriginalSvgColors: { value: 0.0 },
      uPatternAtlas: { value: null },
      uAltPatternAtlas: { value: null },
      uPatternAtlasColumns: { value: 4 },
      uAltPatternAtlasColumns: { value: 6 },
      uDarkMode: { value: darkMode ? 1.0 : 0.0 },
      uBottomFade: { value: 0.0 },
    },
  }), [size.width, size.height, tileSize, darkMode]);

  const displayMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: displayVertexShader,
    fragmentShader: displayFragmentShader,
    uniforms: { uMap: { value: null } },
  }), []);

  // Custom shader material for non-ASCII shaders
  const customShaderMaterial = useMemo(() => {
    if (shaderType === 'ascii') return null;
    const fragmentShader = shaderMap[shaderType];
    if (!fragmentShader) return null;

    return new THREE.ShaderMaterial({
      vertexShader: shaderVertex,
      fragmentShader,
      uniforms: {
        uImage: { value: null },
        uResolution: { value: new THREE.Vector2(size.width, size.height) },
        uTime: { value: 0 },
        uSaturation: { value: saturation },
        uBrightness: { value: brightness },
        uContrast: { value: contrast },
        uExposure: { value: exposure },
        uDarkMode: { value: darkMode ? 1.0 : 0.0 },
        uIntensity: { value: shaderIntensity },
        uBaseTileSize: { value: tileSize },
      },
    });
  }, [shaderType, size.width, size.height, saturation, brightness, contrast, exposure, darkMode, shaderIntensity, tileSize]);

  const customShaderScene = useMemo(() => new THREE.Scene(), []);
  const customShaderMesh = useMemo(() => {
    if (!customShaderMaterial) return null;
    return new THREE.Mesh(quadGeometry, customShaderMaterial);
  }, [customShaderMaterial]);

  useEffect(() => {
    if (customShaderMesh) {
      customShaderScene.add(customShaderMesh);
      return () => {
        customShaderScene.remove(customShaderMesh);
      };
    }
  }, [customShaderScene, customShaderMesh]);

  const fluidScene = useMemo(() => new THREE.Scene(), []);
  const patternScene = useMemo(() => new THREE.Scene(), []);
  const displayScene = useMemo(() => new THREE.Scene(), []);

  const fluidMesh = useMemo(() => new THREE.Mesh(quadGeometry, splatMaterial), [splatMaterial]);
  const patternMesh = useMemo(() => new THREE.Mesh(quadGeometry, asciiMaterial), [asciiMaterial]);
  const displayMesh = useMemo(() => new THREE.Mesh(quadGeometry, displayMaterial), [displayMaterial]);

  useEffect(() => {
    fluidScene.add(fluidMesh);
    patternScene.add(patternMesh);
    displayScene.add(displayMesh);
    return () => {
      fluidScene.remove(fluidMesh);
      patternScene.remove(patternMesh);
      displayScene.remove(displayMesh);
    };
  }, [fluidScene, patternScene, displayScene, fluidMesh, patternMesh, displayMesh]);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const patternUrl = useBlockyPattern ? '/patterns/pat-cards.png' : '/patterns/pat3.png';
    const altPatternUrl = useBlockyPattern ? '/patterns/blocky/pat-strip-blue.png' : '/patterns/pat7-colored.png';

    loader.load(patternUrl, (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = useBlockyPattern ? THREE.NearestFilter : THREE.LinearFilter;
      texture.minFilter = useBlockyPattern ? THREE.NearestFilter : THREE.LinearFilter;
      setPatternAtlas(texture);
    });
    loader.load(altPatternUrl, (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = useBlockyPattern ? THREE.NearestFilter : THREE.LinearFilter;
      texture.minFilter = useBlockyPattern ? THREE.NearestFilter : THREE.LinearFilter;
      setAltPatternAtlas(texture);
    });
  }, [useBlockyPattern]);

  useEffect(() => {
    if (!isCardHovered) {
      isMouseInitRef.current = false;
    }
  }, [isCardHovered]);

  useFrame(() => {
    // For ASCII shader, wait for pattern atlases
    if (shaderType === 'ascii' && (!patternAtlas || !altPatternAtlas)) return;
    // For custom shaders, check material exists
    if (shaderType !== 'ascii' && !customShaderMaterial) return;

    timeRef.current += 0.05;

    const prevTarget = gl.getRenderTarget();
    const prevAutoClear = gl.autoClear;

    // Initialize density FBO with paint (once) - only for ASCII
    if (shaderType === 'ascii' && !densityInitializedRef.current) {
      densityInitializedRef.current = true;
      fillMaterial.uniforms.uColor.value.set(0.5, 0.5, 0.5);
      fluidMesh.material = fillMaterial;
      gl.setRenderTarget(densityFBO.write);
      gl.render(fluidScene, quadCamera);
      densityFBO.swap();
      gl.setRenderTarget(densityFBO.write);
      gl.render(fluidScene, quadCamera);
      densityFBO.swap();
    }

    // Fluid simulation (only when painting is enabled and hovering) - only for ASCII
    if (shaderType === 'ascii' && enablePainting && isCardHovered && mouseUV.x >= 0 && mouseUV.y >= 0) {
      if (!isMouseInitRef.current) {
        isMouseInitRef.current = true;
        lastMouseRef.current.copy(mouseUV);
      } else {
        const deltaX = (mouseUV.x - lastMouseRef.current.x) * 100;
        const deltaY = (mouseUV.y - lastMouseRef.current.y) * 100;

        if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
          splatMaterial.uniforms.uTarget.value = velocityFBO.read.texture;
          splatMaterial.uniforms.aspectRatio.value = size.width / size.height;
          splatMaterial.uniforms.point.value.set(mouseUV.x, mouseUV.y);
          splatMaterial.uniforms.color.value.set(deltaX * 5, deltaY * 5, 1);
          fluidMesh.material = splatMaterial;
          gl.setRenderTarget(velocityFBO.write);
          gl.render(fluidScene, quadCamera);
          velocityFBO.swap();

          splatMaterial.uniforms.uTarget.value = densityFBO.read.texture;
          splatMaterial.uniforms.color.value.set(
            Math.abs(deltaX) * 0.1 + 0.2,
            Math.abs(deltaY) * 0.1 + 0.3,
            Math.abs(deltaX + deltaY) * 0.05 + 0.5
          );
          gl.setRenderTarget(densityFBO.write);
          gl.render(fluidScene, quadCamera);
          densityFBO.swap();
        }
        lastMouseRef.current.copy(mouseUV);
      }

      advectionMaterial.uniforms.uVelocity.value = velocityFBO.read.texture;
      advectionMaterial.uniforms.uSource.value = velocityFBO.read.texture;
      advectionMaterial.uniforms.dissipation.value = velocityDissipation;
      fluidMesh.material = advectionMaterial;
      gl.setRenderTarget(velocityFBO.write);
      gl.render(fluidScene, quadCamera);
      velocityFBO.swap();

      advectionMaterial.uniforms.uSource.value = densityFBO.read.texture;
      advectionMaterial.uniforms.dissipation.value = densityDissipation;
      gl.setRenderTarget(densityFBO.write);
      gl.render(fluidScene, quadCamera);
      densityFBO.swap();
    }

    // Render 3D scene to FBO
    sceneFBO.setSize(size.width * 2, size.height * 2);
    gl.setRenderTarget(sceneFBO);
    gl.render(modelScene, camera);

    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const renderWidth = Math.round(size.width * 2 * pixelRatio);
    const renderHeight = Math.round(size.height * 2 * pixelRatio);

    if (shaderType === 'ascii') {
      // ASCII post-process pipeline
      asciiMaterial.uniforms.uImage.value = sceneFBO.texture;
      asciiMaterial.uniforms.uImageDimensions.value.set(size.width * 2, size.height * 2);
      asciiMaterial.uniforms.uDeformTexture.value = densityFBO.read.texture;
      asciiMaterial.uniforms.uPatternAtlas.value = patternAtlas;
      asciiMaterial.uniforms.uAltPatternAtlas.value = altPatternAtlas;
      asciiMaterial.uniforms.uTime.value = timeRef.current * animationSpeed;
      asciiMaterial.uniforms.uResolution.value.set(renderWidth, renderHeight);
      asciiMaterial.uniforms.uLogicalResolution.value.set(size.width, size.height);
      asciiMaterial.uniforms.uCoordinateScale.value = size.width / renderWidth;
      asciiMaterial.uniforms.uBaseTileSize.value = tileSize;
      asciiMaterial.uniforms.uSaturation.value = saturation;
      asciiMaterial.uniforms.uBrightness.value = brightness;
      asciiMaterial.uniforms.uContrast.value = contrast;
      asciiMaterial.uniforms.uExposure.value = exposure;
      asciiMaterial.uniforms.uDarkMode.value = darkMode ? 1.0 : 0.0;
      asciiMaterial.uniforms.uPatternAtlasColumns.value = useBlockyPattern ? 6 : 4;
      asciiMaterial.uniforms.uAltPatternAtlasColumns.value = 6;
      asciiMaterial.uniforms.uFadeThreshold.value = fadeThreshold;
      asciiMaterial.uniforms.uFadeWidth.value = fadeWidth;
      asciiMaterial.uniforms.uAltPatternOpacity.value = patternOpacity;
      asciiMaterial.uniforms.uEnableFadeTransition.value = enableFadeTransition ? 1.0 : 0.0;

      patternFBO.setSize(renderWidth, renderHeight);
      gl.setRenderTarget(patternFBO);
      gl.render(patternScene, quadCamera);

      // Display
      displayMaterial.uniforms.uMap.value = patternFBO.texture;
    } else {
      // Custom shader pipeline
      customShaderMaterial!.uniforms.uImage.value = sceneFBO.texture;
      customShaderMaterial!.uniforms.uResolution.value.set(size.width, size.height);
      customShaderMaterial!.uniforms.uTime.value = timeRef.current * animationSpeed;
      customShaderMaterial!.uniforms.uSaturation.value = saturation;
      customShaderMaterial!.uniforms.uBrightness.value = brightness;
      customShaderMaterial!.uniforms.uContrast.value = contrast;
      customShaderMaterial!.uniforms.uExposure.value = exposure;
      customShaderMaterial!.uniforms.uDarkMode.value = darkMode ? 1.0 : 0.0;
      customShaderMaterial!.uniforms.uIntensity.value = shaderIntensity;
      customShaderMaterial!.uniforms.uBaseTileSize.value = tileSize;

      patternFBO.setSize(renderWidth, renderHeight);
      gl.setRenderTarget(patternFBO);
      gl.render(customShaderScene, quadCamera);

      // Display
      displayMaterial.uniforms.uMap.value = patternFBO.texture;
    }

    gl.setRenderTarget(null);
    gl.autoClear = false;
    gl.render(displayScene, quadCamera);

    gl.setRenderTarget(prevTarget);
    gl.autoClear = prevAutoClear;
  }, 1);

  return (
    <>
      {createPortal(
        <>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 5, 5]} intensity={1.2} color={accentColor} />
          <directionalLight position={[-5, 3, -5]} intensity={0.6} />
          <pointLight position={[0, 2, 3]} intensity={0.8} color="#ffffff" />
          <Suspense fallback={null}>
            <Model
              modelPath={modelPath}
              isHovered={isCardHovered}
              mouseUV={mouseUV}
              enableFloat={enableFloat}
              floatSpeed={floatSpeed}
              floatIntensity={floatIntensity}
              modelScale={modelScale}
            />
          </Suspense>
        </>,
        modelScene
      )}
    </>
  );
}

// ============================================================================
// CARD COMPONENT
// ============================================================================

export interface Card3DAsciiProps {
  title?: string;
  description?: string;
  modelPath: string;
  accentColor?: string;
  // Pattern Settings
  tileSize?: number;
  useBlockyPattern?: boolean;
  // Color Adjustments
  darkMode?: boolean;
  saturation?: number;
  brightness?: number;
  contrast?: number;
  exposure?: number;
  // Animation
  animationSpeed?: number;
  enableFloat?: boolean;
  floatSpeed?: number;
  floatIntensity?: number;
  // Fluid Painting
  enablePainting?: boolean;
  paintRadius?: number;
  velocityDissipation?: number;
  densityDissipation?: number;
  // Shader Advanced
  luminanceOffset?: number;
  fadeThreshold?: number;
  fadeWidth?: number;
  patternOpacity?: number;
  enableFadeTransition?: boolean;
  invertLuminance?: boolean;
  // Shader Type
  shaderType?: ShaderType;
  shaderIntensity?: number;
  // Display
  showLabel?: boolean;
  className?: string;
  height?: number;
  modelScale?: number;
}

export function Card3DAscii({
  title,
  description,
  modelPath,
  accentColor = '#0052FF',
  // Pattern Settings
  tileSize = 6,
  useBlockyPattern = true,
  // Color Adjustments
  darkMode = false,
  saturation = 1.0,
  brightness = 0.0,
  contrast = 1.0,
  exposure = 0.0,
  // Animation
  animationSpeed = 1.0,
  enableFloat = true,
  floatSpeed = 1.5,
  floatIntensity = 0.8,
  // Fluid Painting
  enablePainting = false,
  paintRadius = 0.0035,
  velocityDissipation = 0.9,
  densityDissipation = 0.98,
  // Shader Advanced
  luminanceOffset = 0.85,
  fadeThreshold = 0.1,
  fadeWidth = 0.05,
  patternOpacity = 1.0,
  enableFadeTransition = false,
  invertLuminance = true,
  // Shader Type
  shaderType = 'ascii',
  shaderIntensity = 0.8,
  // Display
  showLabel = true,
  className = '',
  height = 350,
  modelScale = 1.0,
}: Card3DAsciiProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const mouseUVRef = useRef(new THREE.Vector2(-1, -1));
  const rectRef = useRef<DOMRect | null>(null);

  const updateRect = useCallback(() => {
    if (containerRef.current) {
      rectRef.current = containerRef.current.getBoundingClientRect();
    }
  }, []);

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, { passive: true });
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
    };
  }, [updateRect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!rectRef.current) updateRect();
    const rect = rectRef.current;
    if (!rect) return;

    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    mouseUVRef.current.set(
      Math.max(0, Math.min(1, x)),
      Math.max(0, Math.min(1, y))
    );
  }, [updateRect]);

  const handleMouseEnter = useCallback(() => {
    updateRect();
    setIsHovered(true);
  }, [updateRect]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    mouseUVRef.current.set(-1, -1);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative group ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="rounded-xl overflow-hidden border border-gray-800"
           style={{ background: darkMode ? '#000' : '#fff', height: `${height}px` }}>
        <Canvas
          camera={{ position: [0, 0, 4], fov: 45 }}
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true }}
          dpr={[1, 2]}
        >
          <Scene3DAscii
            modelPath={modelPath}
            accentColor={accentColor}
            tileSize={tileSize}
            darkMode={darkMode}
            saturation={saturation}
            brightness={brightness}
            contrast={contrast}
            exposure={exposure}
            animationSpeed={animationSpeed}
            enableFloat={enableFloat}
            floatSpeed={floatSpeed}
            floatIntensity={floatIntensity}
            enablePainting={enablePainting}
            paintRadius={paintRadius}
            velocityDissipation={velocityDissipation}
            densityDissipation={densityDissipation}
            useBlockyPattern={useBlockyPattern}
            luminanceOffset={luminanceOffset}
            fadeThreshold={fadeThreshold}
            fadeWidth={fadeWidth}
            patternOpacity={patternOpacity}
            enableFadeTransition={enableFadeTransition}
            invertLuminance={invertLuminance}
            mouseUV={mouseUVRef.current}
            isCardHovered={isHovered}
            modelScale={modelScale}
            shaderType={shaderType}
            shaderIntensity={shaderIntensity}
          />
        </Canvas>
      </div>
      {showLabel && title && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent rounded-b-xl">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {description && <p className="text-gray-400 text-sm mt-1">{description}</p>}
        </div>
      )}
    </div>
  );
}

export default Card3DAscii;
