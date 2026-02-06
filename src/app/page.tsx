'use client';

import { useState } from 'react';
import { Card3DHover, Card3DAscii, CardAsciiPattern, shaderNames, ShaderType } from '@/components';

// ============================================================================
// TYPES
// ============================================================================

type Tab = 'examples' | 'sandbox' | 'docs';

interface SandboxConfig {
  // Model
  selectedModel: number;
  accentColor: string;
  // Shader Type
  shaderType: ShaderType;
  shaderIntensity: number;
  // Pattern
  tileSize: number;
  useBlockyPattern: boolean;
  // Color
  darkMode: boolean;
  saturation: number;
  brightness: number;
  contrast: number;
  exposure: number;
  // Animation
  animationSpeed: number;
  enableFloat: boolean;
  floatSpeed: number;
  floatIntensity: number;
  // Fluid
  enablePainting: boolean;
  paintRadius: number;
  velocityDissipation: number;
  densityDissipation: number;
  // Shader Advanced
  luminanceOffset: number;
  fadeThreshold: number;
  fadeWidth: number;
  patternOpacity: number;
  enableFadeTransition: boolean;
  invertLuminance: boolean;
  // Display
  showLabel: boolean;
  height: number;
  modelScale: number;
}

// ============================================================================
// MODELS DATA
// ============================================================================

const models = [
  { path: '/models/globe.glb', name: 'Globe', color: '#0052FF' },
  { path: '/models/key.glb', name: 'Key', color: '#22c55e' },
  { path: '/models/base-app.glb', name: 'Base App', color: '#8b5cf6' },
  { path: '/models/builders.glb', name: 'Builders', color: '#f59e0b' },
  { path: '/models/open-source.glb', name: 'Open Source', color: '#ec4899' },
  { path: '/models/base-app-2.glb', name: 'Base App 2', color: '#06b6d4' },
  { path: '/models/base-pay.glb', name: 'Base Pay', color: '#ef4444' },
];

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const defaultConfig: SandboxConfig = {
  selectedModel: 4, // Open Source
  accentColor: '#ec4899',
  shaderType: 'ascii',
  shaderIntensity: 0.8,
  tileSize: 6,
  useBlockyPattern: true,
  darkMode: false,
  saturation: 1.5,
  brightness: 0.0,
  contrast: 1.0,
  exposure: 0.5,
  animationSpeed: 1.0,
  enableFloat: true,
  floatSpeed: 1.5,
  floatIntensity: 0.8,
  enablePainting: false,
  paintRadius: 0.0035,
  velocityDissipation: 0.9,
  densityDissipation: 0.98,
  luminanceOffset: 0.85,
  fadeThreshold: 0.1,
  fadeWidth: 0.05,
  patternOpacity: 1.0,
  enableFadeTransition: false,
  invertLuminance: true,
  showLabel: false,
  height: 700,
  modelScale: 0.4,
};

// ============================================================================
// TAB NAVIGATION
// ============================================================================

function TabNav({ activeTab, setActiveTab }: { activeTab: Tab; setActiveTab: (tab: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'examples', label: 'Examples' },
    { id: 'sandbox', label: 'Sandbox' },
    { id: 'docs', label: 'Documentation' },
  ];

  return (
    <nav className="flex gap-1 bg-gray-900 p-1 rounded-lg mb-8">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? 'bg-white text-gray-900'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

// ============================================================================
// EXAMPLES TAB
// ============================================================================

function ExamplesTab() {
  return (
    <div className="space-y-12">
      {/* 3D Hover */}
      <section>
        <h2 className="text-2xl font-bold mb-2">3D Hover</h2>
        <p className="text-gray-400 mb-6">
          Simple 3D model with mouse-follow rotation. Hover over the cards to interact.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.slice(0, 3).map((model) => (
            <Card3DHover
              key={model.path}
              title={model.name}
              description="3D model with hover rotation"
              modelPath={model.path}
              accentColor={model.color}
            />
          ))}
        </div>
      </section>

      {/* 3D ASCII */}
      <section>
        <h2 className="text-2xl font-bold mb-2">3D ASCII</h2>
        <p className="text-gray-400 mb-6">
          3D models with ASCII post-processing shader. The shader converts the 3D scene into an ASCII pattern.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {models.slice(0, 3).map((model) => (
            <Card3DAscii
              key={model.path}
              title={model.name}
              description="ASCII post-processed 3D"
              modelPath={model.path}
              accentColor={model.color}
              useBlockyPattern={true}
            />
          ))}
        </div>
      </section>

      {/* ASCII Pattern (2D) */}
      <section>
        <h2 className="text-2xl font-bold mb-2">ASCII Pattern</h2>
        <p className="text-gray-400 mb-6">
          ASCII shader applied to 2D images. Move your mouse to paint and reveal colored patterns.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="font-medium">Light Mode</h3>
            <CardAsciiPattern
              imageUrl="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800"
              className="h-[300px] rounded-xl border border-gray-200"
              tileSize={8}
            />
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Dark Mode</h3>
            <CardAsciiPattern
              imageUrl="https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800"
              className="h-[300px] rounded-xl border border-gray-800"
              tileSize={8}
              darkMode={true}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// SLIDER COMPONENT
// ============================================================================

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="flex justify-between text-xs font-medium text-gray-400 mb-1">
        <span>{label}</span>
        <span className="text-gray-500">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded"
      />
      <span className="text-gray-300">{label}</span>
    </label>
  );
}

// ============================================================================
// COLLAPSIBLE SECTION
// ============================================================================

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-900/50 hover:bg-gray-800/50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-300">{title}</span>
        <span className="text-gray-500">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && <div className="p-3 space-y-3">{children}</div>}
    </div>
  );
}

// ============================================================================
// SANDBOX TAB
// ============================================================================

function SandboxTab() {
  const [config, setConfig] = useState<SandboxConfig>({ ...defaultConfig, height: 700 });
  const [showControls, setShowControls] = useState(true);

  const updateConfig = <K extends keyof SandboxConfig>(key: K, value: SandboxConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const selectedModel = models[config.selectedModel];

  return (
    <div className="-mx-4 px-4">
      {/* Header Bar */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Interactive Sandbox</h2>
        <button
          onClick={() => setShowControls(!showControls)}
          className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        >
          {showControls ? 'Hide Controls' : 'Show Controls'}
        </button>
      </div>

      <div className="flex gap-6 items-start">
        {/* Preview - Takes up remaining space */}
        <div className="flex-1 min-w-0">
          <Card3DAscii
            modelPath={selectedModel.path}
            accentColor={config.accentColor}
            tileSize={config.tileSize}
            useBlockyPattern={config.useBlockyPattern}
            darkMode={config.darkMode}
            saturation={config.saturation}
            brightness={config.brightness}
            contrast={config.contrast}
            exposure={config.exposure}
            animationSpeed={config.animationSpeed}
            enableFloat={config.enableFloat}
            floatSpeed={config.floatSpeed}
            floatIntensity={config.floatIntensity}
            enablePainting={config.enablePainting}
            paintRadius={config.paintRadius}
            velocityDissipation={config.velocityDissipation}
            densityDissipation={config.densityDissipation}
            luminanceOffset={config.luminanceOffset}
            fadeThreshold={config.fadeThreshold}
            fadeWidth={config.fadeWidth}
            patternOpacity={config.patternOpacity}
            enableFadeTransition={config.enableFadeTransition}
            invertLuminance={config.invertLuminance}
            showLabel={config.showLabel}
            height={config.height}
            modelScale={config.modelScale}
            shaderType={config.shaderType}
            shaderIntensity={config.shaderIntensity}
            title={selectedModel.name}
            description="Configurable ASCII 3D"
          />
        </div>

        {/* Controls Panel - Fixed width sidebar */}
        {showControls && (
          <div className="w-72 flex-shrink-0 space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 sticky top-4">
            {/* Model Selection */}
            <Section title="Model">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Select Model</label>
                <select
                  value={config.selectedModel}
                  onChange={(e) => updateConfig('selectedModel', parseInt(e.target.value))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                >
                  {models.map((model, i) => (
                    <option key={model.path} value={i}>{model.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Accent Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={config.accentColor}
                    onChange={(e) => updateConfig('accentColor', e.target.value)}
                    className="w-10 h-8 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={config.accentColor}
                    onChange={(e) => updateConfig('accentColor', e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                  />
                </div>
              </div>
              <Slider label="Model Scale" value={config.modelScale} min={0.3} max={2.5} step={0.05} onChange={(v) => updateConfig('modelScale', v)} />
              <Slider label="Height (px)" value={config.height} min={300} max={1000} step={10} onChange={(v) => updateConfig('height', v)} />
              <Toggle label="Show Label" checked={config.showLabel} onChange={(v) => updateConfig('showLabel', v)} />
            </Section>

            {/* Shader Effect */}
            <Section title="Shader Effect">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Effect Type</label>
                <select
                  value={config.shaderType}
                  onChange={(e) => updateConfig('shaderType', e.target.value as ShaderType)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
                >
                  {(Object.keys(shaderNames) as ShaderType[]).map((type) => (
                    <option key={type} value={type}>{shaderNames[type]}</option>
                  ))}
                </select>
              </div>
              <Slider
                label="Effect Intensity"
                value={config.shaderIntensity}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => updateConfig('shaderIntensity', v)}
              />
              {config.shaderType !== 'ascii' && (
                <p className="text-xs text-gray-500 italic">
                  Pattern settings only apply to ASCII shader
                </p>
              )}
            </Section>

            {/* Pattern Settings */}
            <Section title="Pattern Settings" defaultOpen={config.shaderType === 'ascii'}>
              <Slider label="Tile Size" value={config.tileSize} min={2} max={20} step={1} onChange={(v) => updateConfig('tileSize', v)} />
              <Toggle label="Blocky Pattern" checked={config.useBlockyPattern} onChange={(v) => updateConfig('useBlockyPattern', v)} />
              <Toggle label="Dark Mode" checked={config.darkMode} onChange={(v) => updateConfig('darkMode', v)} />
            </Section>

            {/* Color Adjustments */}
            <Section title="Color Adjustments">
              <Slider label="Saturation" value={config.saturation} min={0} max={3} step={0.01} onChange={(v) => updateConfig('saturation', v)} />
              <Slider label="Brightness" value={config.brightness} min={-1} max={1} step={0.01} onChange={(v) => updateConfig('brightness', v)} />
              <Slider label="Contrast" value={config.contrast} min={0.1} max={3} step={0.01} onChange={(v) => updateConfig('contrast', v)} />
              <Slider label="Exposure" value={config.exposure} min={-3} max={3} step={0.01} onChange={(v) => updateConfig('exposure', v)} />
            </Section>

            {/* Animation */}
            <Section title="Animation">
              <Slider label="Animation Speed" value={config.animationSpeed} min={0} max={5} step={0.1} onChange={(v) => updateConfig('animationSpeed', v)} />
              <Toggle label="Enable Float" checked={config.enableFloat} onChange={(v) => updateConfig('enableFloat', v)} />
              <Slider label="Float Speed" value={config.floatSpeed} min={0} max={5} step={0.1} onChange={(v) => updateConfig('floatSpeed', v)} />
              <Slider label="Float Intensity" value={config.floatIntensity} min={0} max={2} step={0.1} onChange={(v) => updateConfig('floatIntensity', v)} />
            </Section>

            {/* Fluid Simulation */}
            <Section title="Fluid Painting" defaultOpen={false}>
              <Toggle label="Enable Painting" checked={config.enablePainting} onChange={(v) => updateConfig('enablePainting', v)} />
              <Slider label="Paint Radius" value={config.paintRadius} min={0.001} max={0.02} step={0.0005} onChange={(v) => updateConfig('paintRadius', v)} />
              <Slider label="Velocity Dissipation" value={config.velocityDissipation} min={0.5} max={1} step={0.01} onChange={(v) => updateConfig('velocityDissipation', v)} />
              <Slider label="Density Dissipation" value={config.densityDissipation} min={0.9} max={1} step={0.005} onChange={(v) => updateConfig('densityDissipation', v)} />
            </Section>

            {/* Shader Advanced */}
            <Section title="Shader Advanced" defaultOpen={false}>
              <Slider label="Luminance Offset" value={config.luminanceOffset} min={0} max={1} step={0.01} onChange={(v) => updateConfig('luminanceOffset', v)} />
              <Slider label="Fade Threshold" value={config.fadeThreshold} min={0} max={1} step={0.01} onChange={(v) => updateConfig('fadeThreshold', v)} />
              <Slider label="Fade Width" value={config.fadeWidth} min={0} max={0.5} step={0.01} onChange={(v) => updateConfig('fadeWidth', v)} />
              <Slider label="Pattern Opacity" value={config.patternOpacity} min={0} max={1} step={0.01} onChange={(v) => updateConfig('patternOpacity', v)} />
              <Toggle label="Enable Fade Transition" checked={config.enableFadeTransition} onChange={(v) => updateConfig('enableFadeTransition', v)} />
              <Toggle label="Invert Luminance" checked={config.invertLuminance} onChange={(v) => updateConfig('invertLuminance', v)} />
            </Section>

            {/* Reset Button */}
            <button
              onClick={() => setConfig(defaultConfig)}
              className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              Reset to Defaults
            </button>

            {/* Export Config */}
            <button
              onClick={() => {
                const code = `<Card3DAscii
  modelPath="${selectedModel.path}"
  accentColor="${config.accentColor}"
  shaderType="${config.shaderType}"
  shaderIntensity={${config.shaderIntensity}}
  tileSize={${config.tileSize}}
  useBlockyPattern={${config.useBlockyPattern}}
  darkMode={${config.darkMode}}
  saturation={${config.saturation}}
  brightness={${config.brightness}}
  contrast={${config.contrast}}
  exposure={${config.exposure}}
  animationSpeed={${config.animationSpeed}}
  enableFloat={${config.enableFloat}}
  floatSpeed={${config.floatSpeed}}
  floatIntensity={${config.floatIntensity}}
  enablePainting={${config.enablePainting}}
  height={${config.height}}
/>`;
                navigator.clipboard.writeText(code);
                alert('Code copied to clipboard!');
              }}
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors"
            >
              Copy Component Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DOCUMENTATION TAB
// ============================================================================

function DocsTab() {
  return (
    <div className="prose prose-invert max-w-none">
      <h2 className="text-3xl font-bold mb-8">Documentation</h2>

      {/* How It Works */}
      <section className="mb-16">
        <h3 className="text-2xl font-semibold mb-6 text-blue-400">How It Works</h3>

        <div className="space-y-8">
          <div>
            <h4 className="text-lg font-medium mb-3">Overview</h4>
            <p className="text-gray-400 leading-relaxed">
              The ASCII effect is achieved through a multi-pass GPU rendering pipeline. Instead of using
              traditional text-based ASCII art, we use <strong className="text-white">pattern atlas textures</strong> -
              horizontal strips containing patterns of varying densities. The shader samples these patterns
              based on the luminance (brightness) of each tile in the source image/3D scene.
            </p>
          </div>

          <div className="bg-gray-900 rounded-xl p-6">
            <h4 className="text-lg font-medium mb-4">Render Pipeline</h4>
            <ol className="list-decimal list-inside space-y-3 text-gray-400">
              <li>
                <strong className="text-white">3D Scene Render</strong> - The 3D model is rendered to a
                Frame Buffer Object (FBO) texture at 2x resolution for quality.
              </li>
              <li>
                <strong className="text-white">Fluid Simulation (Optional)</strong> - GPU-based Navier-Stokes
                fluid simulation using ping-pong buffers (DoubleFBO). Mouse movement creates velocity and
                density splats that advect and dissipate over time.
              </li>
              <li>
                <strong className="text-white">ASCII Pattern Shader</strong> - The main shader divides the
                screen into tiles, calculates luminance for each tile, and samples the appropriate pattern
                from the atlas texture.
              </li>
              <li>
                <strong className="text-white">Final Composite</strong> - The result is rendered to screen
                with optional color adjustments (saturation, brightness, contrast, exposure).
              </li>
            </ol>
          </div>

          <div className="bg-gray-900 rounded-xl p-6">
            <h4 className="text-lg font-medium mb-4">Pattern Atlas System</h4>
            <p className="text-gray-400 mb-4">
              Pattern atlases are horizontal strips of patterns arranged by density:
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-white font-medium">Blocky Pattern (pat-cards.png)</p>
                <p className="text-gray-500">6 columns, 64px height, pixelated look</p>
              </div>
              <div>
                <p className="text-white font-medium">Rounded Pattern (pat3.png)</p>
                <p className="text-gray-500">4 columns, 64px height, smooth look</p>
              </div>
              <div>
                <p className="text-white font-medium">Colored Patterns</p>
                <p className="text-gray-500">Used when fluid painting reveals colors</p>
              </div>
              <div>
                <p className="text-white font-medium">Density Mapping</p>
                <p className="text-gray-500">Bright pixels → sparse patterns, Dark pixels → dense patterns</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-6">
            <h4 className="text-lg font-medium mb-4">Key Shader Uniforms</h4>
            <div className="space-y-2 text-sm font-mono">
              <div className="flex justify-between">
                <span className="text-blue-400">uBaseTileSize</span>
                <span className="text-gray-500">Size of each ASCII tile in pixels</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-400">uPatternAtlas</span>
                <span className="text-gray-500">Grayscale pattern texture</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-400">uAltPatternAtlas</span>
                <span className="text-gray-500">Colored pattern texture (for painting)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-400">uDeformTexture</span>
                <span className="text-gray-500">Fluid density texture for paint effect</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-400">uFadeThreshold</span>
                <span className="text-gray-500">Paint strength to trigger color transition</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-6">
            <h4 className="text-lg font-medium mb-4">Fluid Simulation</h4>
            <p className="text-gray-400 mb-4">
              The painting effect uses a simplified Navier-Stokes fluid simulation:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-white">Splat</strong> - Mouse movement adds velocity and density</li>
              <li><strong className="text-white">Advection</strong> - Density follows velocity field</li>
              <li><strong className="text-white">Dissipation</strong> - Values decay over time (configurable)</li>
              <li><strong className="text-white">Ping-Pong Buffers</strong> - DoubleFBO swaps read/write targets</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Installation */}
      <section className="mb-16">
        <h3 className="text-2xl font-semibold mb-6 text-green-400">Installation</h3>

        <div className="space-y-4">
          <div>
            <p className="text-gray-400 mb-2">1. Install dependencies:</p>
            <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto">
              <code className="text-green-400">npm install three @react-three/fiber @react-three/drei</code>
            </pre>
          </div>

          <div>
            <p className="text-gray-400 mb-2">2. Copy components to your project:</p>
            <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
              <code className="text-gray-300">{`src/components/
├── Card3DHover.tsx      # Simple 3D hover
├── Card3DAscii.tsx      # 3D + ASCII shader
├── CardAsciiPattern.tsx # 2D ASCII pattern
└── index.ts             # Exports`}</code>
            </pre>
          </div>

          <div>
            <p className="text-gray-400 mb-2">3. Copy pattern assets:</p>
            <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm">
              <code className="text-gray-300">{`public/patterns/
├── pat-cards.png        # Blocky patterns (6 cols)
├── pat3.png             # Rounded patterns (4 cols)
├── pat7-colored.png     # Colored patterns
└── blocky/
    └── pat-strip-*.png  # Colored blocky variants`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Component Reference */}
      <section className="mb-16">
        <h3 className="text-2xl font-semibold mb-6 text-purple-400">Component Reference</h3>

        {/* Card3DHover */}
        <div className="mb-12">
          <h4 className="text-xl font-medium mb-4">Card3DHover</h4>
          <p className="text-gray-400 mb-4">Simple 3D model with mouse-follow rotation.</p>

          <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
            <code>{`import { Card3DHover } from '@/components';

<Card3DHover
  modelPath="/models/my-model.glb"
  title="My Card"
  description="A 3D hover card"
  accentColor="#0052FF"
  enableFloat={true}
  showLabel={true}
/>`}</code>
          </pre>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-4 text-gray-400">Prop</th>
                  <th className="text-left py-2 px-4 text-gray-400">Type</th>
                  <th className="text-left py-2 px-4 text-gray-400">Default</th>
                  <th className="text-left py-2 px-4 text-gray-400">Description</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">modelPath</td><td className="py-2 px-4">string</td><td className="py-2 px-4 text-gray-500">required</td><td className="py-2 px-4">Path to GLB model</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">title</td><td className="py-2 px-4">string</td><td className="py-2 px-4 text-gray-500">-</td><td className="py-2 px-4">Card title</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">accentColor</td><td className="py-2 px-4">string</td><td className="py-2 px-4 text-gray-500">#0052FF</td><td className="py-2 px-4">Accent color for glow</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">enableFloat</td><td className="py-2 px-4">boolean</td><td className="py-2 px-4 text-gray-500">true</td><td className="py-2 px-4">Enable floating animation</td></tr>
                <tr><td className="py-2 px-4 text-blue-400">showLabel</td><td className="py-2 px-4">boolean</td><td className="py-2 px-4 text-gray-500">true</td><td className="py-2 px-4">Show title overlay</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Card3DAscii */}
        <div className="mb-12">
          <h4 className="text-xl font-medium mb-4">Card3DAscii</h4>
          <p className="text-gray-400 mb-4">3D model with ASCII post-processing shader.</p>

          <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
            <code>{`import { Card3DAscii } from '@/components';

<Card3DAscii
  modelPath="/models/my-model.glb"
  tileSize={6}
  useBlockyPattern={true}
  darkMode={false}
  enableFloat={true}
  enablePainting={false}
/>`}</code>
          </pre>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-4 text-gray-400">Prop</th>
                  <th className="text-left py-2 px-4 text-gray-400">Type</th>
                  <th className="text-left py-2 px-4 text-gray-400">Default</th>
                  <th className="text-left py-2 px-4 text-gray-400">Description</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">modelPath</td><td className="py-2 px-4">string</td><td className="py-2 px-4 text-gray-500">required</td><td className="py-2 px-4">Path to GLB model</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">tileSize</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">6</td><td className="py-2 px-4">ASCII tile size in pixels</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">useBlockyPattern</td><td className="py-2 px-4">boolean</td><td className="py-2 px-4 text-gray-500">true</td><td className="py-2 px-4">Blocky vs rounded patterns</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">darkMode</td><td className="py-2 px-4">boolean</td><td className="py-2 px-4 text-gray-500">false</td><td className="py-2 px-4">Dark theme</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">saturation</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">1.0</td><td className="py-2 px-4">Color saturation (0-3)</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">brightness</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">0.0</td><td className="py-2 px-4">Brightness (-1 to 1)</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">contrast</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">1.0</td><td className="py-2 px-4">Contrast (0.1-3)</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">exposure</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">0.0</td><td className="py-2 px-4">Exposure (-3 to 3)</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">animationSpeed</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">1.0</td><td className="py-2 px-4">Pattern animation speed</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">enableFloat</td><td className="py-2 px-4">boolean</td><td className="py-2 px-4 text-gray-500">true</td><td className="py-2 px-4">Floating animation</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">floatSpeed</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">1.5</td><td className="py-2 px-4">Float animation speed</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">floatIntensity</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">0.8</td><td className="py-2 px-4">Float movement amount</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">enablePainting</td><td className="py-2 px-4">boolean</td><td className="py-2 px-4 text-gray-500">false</td><td className="py-2 px-4">Enable fluid painting</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">paintRadius</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">0.0035</td><td className="py-2 px-4">Paint brush radius</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">velocityDissipation</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">0.9</td><td className="py-2 px-4">Velocity decay rate</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">densityDissipation</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">0.98</td><td className="py-2 px-4">Paint density decay</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">fadeThreshold</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">0.1</td><td className="py-2 px-4">Paint threshold for color</td></tr>
                <tr><td className="py-2 px-4 text-blue-400">height</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">350</td><td className="py-2 px-4">Card height in pixels</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CardAsciiPattern */}
        <div className="mb-12">
          <h4 className="text-xl font-medium mb-4">CardAsciiPattern</h4>
          <p className="text-gray-400 mb-4">ASCII shader applied to 2D images.</p>

          <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm mb-4">
            <code>{`import { CardAsciiPattern } from '@/components';

<CardAsciiPattern
  imageUrl="/images/my-image.jpg"
  className="h-[300px] rounded-xl"
  tileSize={8}
  darkMode={false}
  enableInteractivity={true}
/>`}</code>
          </pre>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-2 px-4 text-gray-400">Prop</th>
                  <th className="text-left py-2 px-4 text-gray-400">Type</th>
                  <th className="text-left py-2 px-4 text-gray-400">Default</th>
                  <th className="text-left py-2 px-4 text-gray-400">Description</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">imageUrl</td><td className="py-2 px-4">string</td><td className="py-2 px-4 text-gray-500">required</td><td className="py-2 px-4">Image URL</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">className</td><td className="py-2 px-4">string</td><td className="py-2 px-4 text-gray-500">-</td><td className="py-2 px-4">CSS classes</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">tileSize</td><td className="py-2 px-4">number</td><td className="py-2 px-4 text-gray-500">8</td><td className="py-2 px-4">Tile size in pixels</td></tr>
                <tr className="border-b border-gray-800/50"><td className="py-2 px-4 text-blue-400">darkMode</td><td className="py-2 px-4">boolean</td><td className="py-2 px-4 text-gray-500">false</td><td className="py-2 px-4">Dark theme</td></tr>
                <tr><td className="py-2 px-4 text-blue-400">enableInteractivity</td><td className="py-2 px-4">boolean</td><td className="py-2 px-4 text-gray-500">true</td><td className="py-2 px-4">Enable painting</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Credits */}
      <section className="mb-16">
        <h3 className="text-2xl font-semibold mb-6 text-yellow-400">Credits</h3>
        <p className="text-gray-400">
          ASCII shader inspired by <a href="https://base.org" className="text-blue-400 hover:underline">Base.org</a>.
          Built with <a href="https://threejs.org" className="text-blue-400 hover:underline">Three.js</a> and{' '}
          <a href="https://docs.pmnd.rs/react-three-fiber" className="text-blue-400 hover:underline">React Three Fiber</a>.
        </p>
      </section>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('examples');

  return (
    <main className="min-h-screen bg-black text-white">
      <div className={`mx-auto px-4 py-8 ${activeTab === 'sandbox' ? 'max-w-[1800px]' : 'container max-w-7xl'}`}>
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">3D ASCII Effects</h1>
          <p className="text-gray-400">
            Interactive 3D cards with ASCII pattern shaders. Hover to interact.
          </p>
        </header>

        {/* Navigation */}
        <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Content */}
        {activeTab === 'examples' && <ExamplesTab />}
        {activeTab === 'sandbox' && <SandboxTab />}
        {activeTab === 'docs' && <DocsTab />}
      </div>
    </main>
  );
}
