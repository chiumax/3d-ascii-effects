'use client';

/**
 * CardAsciiPattern - ASCII pattern shader applied to 2D images
 *
 * Applies the same ASCII pattern shader to any image, with optional
 * fluid simulation for interactive painting effects.
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';

// ============================================================================
// DOUBLE FBO CLASS
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
// QUAD GEOMETRY
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
  uniform float uBaseTileSize;
  uniform float uTime;
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uContrast;
  uniform float uExposure;
  uniform float uAltPatternOpacity;
  uniform float uFadeThreshold;
  uniform float uFadeWidth;
  uniform sampler2D uPatternAtlas;
  uniform sampler2D uAltPatternAtlas;
  uniform int uPatternAtlasColumns;
  uniform int uAltPatternAtlasColumns;
  uniform float uDarkMode;
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

  vec2 getCoveredUV(vec2 uv, vec2 containerSize, vec2 imageSize) {
    vec2 containerAspect = containerSize / max(containerSize.x, containerSize.y);
    vec2 imageAspect = imageSize / max(imageSize.x, imageSize.y);
    vec2 scale = containerAspect / imageAspect;
    float scaleToFit = max(scale.x, scale.y);
    vec2 scaledSize = imageAspect * scaleToFit;
    vec2 offset = (containerAspect - scaledSize) * 0.5;
    vec2 adjustedUV = (uv * containerAspect - offset) / scaledSize;
    return adjustedUV;
  }

  vec3 getColorForIntensity(int patternIndex, float patternAlpha, bool useOriginalColors, vec3 originalColor, vec4 patternColor) {
    if (useOriginalColors) {
      vec3 backgroundColor = vec3(1.0, 1.0, 1.0);
      if (patternAlpha < 0.001) {
        return backgroundColor;
      }
      vec3 blendedColor = mix(backgroundColor, originalColor, patternAlpha);
      return mix(backgroundColor, blendedColor, uAltPatternOpacity);
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
    vec2 adjustedTileCenter = getCoveredUV(tileCenterUV, uLogicalResolution, uImageDimensions);

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

    float fadeStart = uFadeThreshold;
    float fadeEnd = uFadeThreshold + uFadeWidth;
    float transitionFactor = smoothstep(fadeStart, fadeEnd, paintStrength);

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

    vec4 altPatternColor = sampleAltPatternAtlas(uAltPatternAtlas, uAltPatternAtlasColumns, altAtlasIndex, patternUV);
    vec4 regularPatternColor = samplePatternAtlas(uPatternAtlas, uPatternAtlasColumns, regularAtlasIndex, patternUV);

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
// ASCII FLUID SCENE
// ============================================================================

interface SceneProps {
  imageUrl: string;
  tileSize: number;
  saturation: number;
  darkMode: boolean;
  enableInteractivity: boolean;
}

function AsciiFluidScene({
  imageUrl,
  tileSize,
  saturation,
  darkMode,
  enableInteractivity,
}: SceneProps) {
  const { size, gl } = useThree();
  const timeRef = useRef(0);

  const [imageTexture, setImageTexture] = useState<THREE.Texture | null>(null);
  const [imageDimensions, setImageDimensions] = useState(new THREE.Vector2(1, 1));
  const [patternAtlas, setPatternAtlas] = useState<THREE.Texture | null>(null);
  const [altPatternAtlas, setAltPatternAtlas] = useState<THREE.Texture | null>(null);

  const mouseRef = useRef(new THREE.Vector2(-1, -1));
  const lastMouseRef = useRef(new THREE.Vector2(-1, -1));
  const isMouseInitRef = useRef(false);
  const isHoveredRef = useRef(false);

  const velocityFBO = useMemo(() => new DoubleFBO(128, 128, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
  }), []);

  const densityFBO = useMemo(() => new DoubleFBO(512, 512, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
  }), []);

  const patternFBO = useMemo(() => {
    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    return new THREE.WebGLRenderTarget(
      Math.round(size.width * 2 * pixelRatio),
      Math.round(size.height * 2 * pixelRatio),
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
      }
    );
  }, [size.width, size.height]);

  const splatMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: fluidBaseVertex,
    fragmentShader: splatShader,
    uniforms: {
      texelSize: { value: new THREE.Vector2(1/128, 1/128) },
      uTarget: { value: null },
      aspectRatio: { value: 1 },
      color: { value: new THREE.Vector3() },
      point: { value: new THREE.Vector2() },
      radius: { value: 0.0035 },
    },
  }), []);

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

  const asciiMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: asciiVertexShader,
    fragmentShader: asciiFragmentShader,
    uniforms: {
      uImage: { value: null },
      uImageDimensions: { value: new THREE.Vector2(1, 1) },
      uDeformTexture: { value: null },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
      uLogicalResolution: { value: new THREE.Vector2(size.width, size.height) },
      uCoordinateScale: { value: 1.0 },
      uBaseTileSize: { value: tileSize },
      uTime: { value: 0 },
      uSaturation: { value: saturation },
      uBrightness: { value: 0.0 },
      uContrast: { value: 1.0 },
      uExposure: { value: 0.0 },
      uAltPatternOpacity: { value: 1.0 },
      uFadeThreshold: { value: 0.1 },
      uFadeWidth: { value: 0.05 },
      uPatternAtlas: { value: null },
      uAltPatternAtlas: { value: null },
      uPatternAtlasColumns: { value: 4 },
      uAltPatternAtlasColumns: { value: 6 },
      uDarkMode: { value: darkMode ? 1.0 : 0.0 },
    },
  }), [size.width, size.height, tileSize, saturation, darkMode]);

  const displayMaterial = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: displayVertexShader,
    fragmentShader: displayFragmentShader,
    uniforms: {
      uMap: { value: null },
    },
  }), []);

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

    loader.load(imageUrl, (texture) => {
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      setImageTexture(texture);
      if (texture.image) {
        setImageDimensions(new THREE.Vector2(texture.image.width, texture.image.height));
      }
    });

    loader.load('/patterns/pat3.png', (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      setPatternAtlas(texture);
    });

    loader.load('/patterns/pat7-colored.png', (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearFilter;
      setAltPatternAtlas(texture);
    });
  }, [imageUrl]);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1 - (e.clientY - rect.top) / rect.height;
      mouseRef.current.set(x, y);
      isHoveredRef.current = true;
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
      isMouseInitRef.current = false;
    };

    canvas.addEventListener('mousemove', handleMouseMove, { passive: true });
    canvas.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [gl]);

  useFrame(() => {
    if (!imageTexture || !patternAtlas || !altPatternAtlas) return;

    timeRef.current += 0.05;

    const prevTarget = gl.getRenderTarget();
    const prevAutoClear = gl.autoClear;

    // Fluid simulation
    if (enableInteractivity && isHoveredRef.current) {
      const mouse = mouseRef.current;

      if (!isMouseInitRef.current) {
        isMouseInitRef.current = true;
        lastMouseRef.current.copy(mouse);
      } else {
        const deltaX = (mouse.x - lastMouseRef.current.x) * 100;
        const deltaY = (mouse.y - lastMouseRef.current.y) * 100;

        if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
          splatMaterial.uniforms.uTarget.value = velocityFBO.read.texture;
          splatMaterial.uniforms.aspectRatio.value = size.width / size.height;
          splatMaterial.uniforms.point.value.set(mouse.x, mouse.y);
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

        lastMouseRef.current.copy(mouse);
      }
    }

    // Advection
    advectionMaterial.uniforms.uVelocity.value = velocityFBO.read.texture;
    advectionMaterial.uniforms.uSource.value = velocityFBO.read.texture;
    advectionMaterial.uniforms.dissipation.value = 0.9;
    fluidMesh.material = advectionMaterial;
    gl.setRenderTarget(velocityFBO.write);
    gl.render(fluidScene, quadCamera);
    velocityFBO.swap();

    advectionMaterial.uniforms.uSource.value = densityFBO.read.texture;
    advectionMaterial.uniforms.dissipation.value = 0.96;
    gl.setRenderTarget(densityFBO.write);
    gl.render(fluidScene, quadCamera);
    densityFBO.swap();

    // ASCII pattern render
    const pixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const renderWidth = Math.round(size.width * 2 * pixelRatio);
    const renderHeight = Math.round(size.height * 2 * pixelRatio);

    asciiMaterial.uniforms.uTime.value = timeRef.current;
    asciiMaterial.uniforms.uImage.value = imageTexture;
    asciiMaterial.uniforms.uImageDimensions.value = imageDimensions;
    asciiMaterial.uniforms.uDeformTexture.value = densityFBO.read.texture;
    asciiMaterial.uniforms.uPatternAtlas.value = patternAtlas;
    asciiMaterial.uniforms.uAltPatternAtlas.value = altPatternAtlas;
    asciiMaterial.uniforms.uResolution.value.set(renderWidth, renderHeight);
    asciiMaterial.uniforms.uLogicalResolution.value.set(size.width, size.height);
    asciiMaterial.uniforms.uCoordinateScale.value = size.width / renderWidth;

    patternFBO.setSize(renderWidth, renderHeight);
    gl.setRenderTarget(patternFBO);
    gl.render(patternScene, quadCamera);

    // Display
    displayMaterial.uniforms.uMap.value = patternFBO.texture;
    gl.setRenderTarget(null);
    gl.autoClear = false;
    gl.render(displayScene, quadCamera);

    gl.setRenderTarget(prevTarget);
    gl.autoClear = prevAutoClear;
  }, 1);

  return null;
}

// ============================================================================
// CARD COMPONENT
// ============================================================================

export interface CardAsciiPatternProps {
  imageUrl: string;
  className?: string;
  tileSize?: number;
  saturation?: number;
  darkMode?: boolean;
  enableInteractivity?: boolean;
}

export function CardAsciiPattern({
  imageUrl,
  className = '',
  tileSize = 8,
  saturation = 1.0,
  darkMode = false,
  enableInteractivity = true,
}: CardAsciiPatternProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: false }}
        style={{ background: darkMode ? '#000' : '#fff' }}
      >
        <AsciiFluidScene
          imageUrl={imageUrl}
          tileSize={tileSize}
          saturation={saturation}
          darkMode={darkMode}
          enableInteractivity={enableInteractivity}
        />
      </Canvas>
    </div>
  );
}

export default CardAsciiPattern;
