# 3D ASCII Effects

Interactive 3D cards with ASCII pattern shaders. Built with React Three Fiber and Next.js.

## Features

- **Card3DHover** - Simple 3D model with mouse-follow rotation
- **Card3DAscii** - 3D models with ASCII post-processing shader
- **CardAsciiPattern** - ASCII shader applied to 2D images
- Interactive sandbox with 30+ configurable parameters
- GPU-based fluid simulation for painting effects
- Light/dark mode support
- Blocky and rounded pattern styles

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to see the demo.

## How It Works

The ASCII effect is achieved through a multi-pass GPU rendering pipeline:

1. **3D Scene Render** - The 3D model is rendered to a Frame Buffer Object (FBO) at 2x resolution
2. **Fluid Simulation** - GPU-based Navier-Stokes simulation for painting effects
3. **ASCII Pattern Shader** - Divides screen into tiles, maps luminance to pattern density
4. **Final Composite** - Color adjustments and display

### Pattern Atlas System

Pattern atlases are horizontal strips of patterns arranged by density:
- **Blocky patterns** (pat-cards.png) - 6 columns, pixelated look
- **Rounded patterns** (pat3.png) - 4 columns, smooth look
- **Colored patterns** - Revealed through fluid painting interaction

## Installation in Your Project

1. Install dependencies:

```bash
npm install three @react-three/fiber @react-three/drei
```

2. Copy components from `src/components/` to your project

3. Copy pattern textures from `public/patterns/` to your public folder

## Components

### Card3DHover

Simple 3D model with mouse-follow rotation.

```tsx
import { Card3DHover } from '@/components';

<Card3DHover
  modelPath="/models/my-model.glb"
  title="My Card"
  accentColor="#0052FF"
  enableFloat={true}
/>
```

### Card3DAscii

3D model with ASCII post-processing shader.

```tsx
import { Card3DAscii } from '@/components';

<Card3DAscii
  modelPath="/models/my-model.glb"
  tileSize={6}
  useBlockyPattern={true}
  darkMode={false}
  enableFloat={true}
  enablePainting={false}
  height={400}
/>
```

#### Full Props List

| Category | Prop | Type | Default | Description |
|----------|------|------|---------|-------------|
| **Model** | modelPath | string | required | Path to GLB model |
| | accentColor | string | #0052FF | Accent color |
| **Pattern** | tileSize | number | 6 | Tile size in pixels |
| | useBlockyPattern | boolean | true | Blocky vs rounded |
| **Color** | darkMode | boolean | false | Dark theme |
| | saturation | number | 1.0 | Color saturation |
| | brightness | number | 0.0 | Brightness (-1 to 1) |
| | contrast | number | 1.0 | Contrast |
| | exposure | number | 0.0 | Exposure |
| **Animation** | animationSpeed | number | 1.0 | Pattern animation |
| | enableFloat | boolean | true | Floating animation |
| | floatSpeed | number | 1.5 | Float speed |
| | floatIntensity | number | 0.8 | Float amount |
| **Fluid** | enablePainting | boolean | false | Enable painting |
| | paintRadius | number | 0.0035 | Brush radius |
| | velocityDissipation | number | 0.9 | Velocity decay |
| | densityDissipation | number | 0.98 | Density decay |
| **Advanced** | fadeThreshold | number | 0.1 | Color threshold |
| | fadeWidth | number | 0.05 | Transition width |
| | patternOpacity | number | 1.0 | Pattern opacity |
| **Display** | height | number | 350 | Card height |
| | showLabel | boolean | true | Show title |

### CardAsciiPattern

ASCII shader applied to 2D images.

```tsx
import { CardAsciiPattern } from '@/components';

<CardAsciiPattern
  imageUrl="/images/my-image.jpg"
  className="h-[300px] rounded-xl"
  tileSize={8}
  darkMode={false}
  enableInteractivity={true}
/>
```

## Project Structure

```
src/
  components/
    Card3DHover.tsx      # Simple 3D hover
    Card3DAscii.tsx      # 3D + ASCII shader
    CardAsciiPattern.tsx # 2D ASCII pattern
    index.ts             # Exports
  app/
    page.tsx             # Demo with tabs
    layout.tsx           # Root layout
    globals.css          # Global styles
public/
  models/                # GLB models
  patterns/              # Pattern textures
    pat-cards.png        # Blocky (6 cols)
    pat3.png             # Rounded (4 cols)
    pat7-colored.png     # Colored
    blocky/              # Colored blocky
```

## Credits

ASCII shader inspired by [Base.org](https://base.org). Built with [Three.js](https://threejs.org) and [React Three Fiber](https://docs.pmnd.rs/react-three-fiber).

## License

MIT
