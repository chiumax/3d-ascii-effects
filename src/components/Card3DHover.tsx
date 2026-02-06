'use client';

/**
 * Card3DHover - Simple 3D model with mouse-follow rotation
 *
 * A minimal implementation of the 3D hover effect:
 * 1. Tracks mouse position relative to the card
 * 2. Rotates the 3D model based on mouse position
 * 3. Smoothly interpolates rotation with lerp
 */

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, Float } from '@react-three/drei';
import { useRef, useState, Suspense, useCallback, useEffect } from 'react';
import { Group, MathUtils, Vector2 } from 'three';

interface ModelProps {
  modelPath: string;
  isHovered: boolean;
  mouseUV: Vector2;
  enableFloat?: boolean;
}

function Model({ modelPath, isHovered, mouseUV, enableFloat = true }: ModelProps) {
  const groupRef = useRef<Group>(null);
  const { scene } = useGLTF(modelPath);

  useFrame(() => {
    if (!groupRef.current) return;

    if (isHovered && mouseUV.x >= 0 && mouseUV.y >= 0) {
      // Convert UV (0-1) to rotation: center (0.5) = no rotation
      const targetRotationY = (mouseUV.x - 0.5) * Math.PI * 0.4;
      const targetRotationX = -(mouseUV.y - 0.5) * Math.PI * 0.4;

      groupRef.current.rotation.y = MathUtils.lerp(
        groupRef.current.rotation.y,
        targetRotationY,
        0.08
      );
      groupRef.current.rotation.x = MathUtils.lerp(
        groupRef.current.rotation.x,
        targetRotationX,
        0.08
      );
    } else {
      // Return to rest position and add subtle idle rotation
      groupRef.current.rotation.y = MathUtils.lerp(groupRef.current.rotation.y, 0, 0.05);
      groupRef.current.rotation.x = MathUtils.lerp(groupRef.current.rotation.x, 0, 0.05);
      groupRef.current.rotation.y += 0.002;
    }
  });

  const content = (
    <group ref={groupRef}>
      <primitive object={scene.clone()} scale={1.0} />
    </group>
  );

  if (enableFloat) {
    return (
      <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.8}>
        {content}
      </Float>
    );
  }

  return content;
}

function Scene({ modelPath, isHovered, mouseUV, enableFloat }: ModelProps) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />
      <Environment preset="city" />
      <Suspense fallback={null}>
        <Model
          modelPath={modelPath}
          isHovered={isHovered}
          mouseUV={mouseUV}
          enableFloat={enableFloat}
        />
      </Suspense>
    </>
  );
}

export interface Card3DHoverProps {
  title?: string;
  description?: string;
  modelPath: string;
  accentColor?: string;
  enableFloat?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function Card3DHover({
  title,
  description,
  modelPath,
  accentColor = '#0052FF',
  enableFloat = true,
  showLabel = true,
  className = '',
}: Card3DHoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const mouseUVRef = useRef(new Vector2(-1, -1));
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
      {/* Accent gradient on hover */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 rounded-xl"
        style={{
          opacity: isHovered ? 0.15 : 0,
          background: `radial-gradient(circle at 50% 30%, ${accentColor}, transparent 70%)`,
        }}
      />

      <div className="h-[350px] bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <Scene
            modelPath={modelPath}
            isHovered={isHovered}
            mouseUV={mouseUVRef.current}
            enableFloat={enableFloat}
          />
        </Canvas>
      </div>

      {showLabel && title && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent rounded-b-xl">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {description && <p className="text-gray-400 text-sm mt-1">{description}</p>}
        </div>
      )}

      {/* Hover indicator */}
      <div
        className="absolute top-4 right-4 w-2 h-2 rounded-full transition-colors duration-300"
        style={{ backgroundColor: isHovered ? accentColor : '#374151' }}
      />
    </div>
  );
}

export default Card3DHover;
