// Target Marker Component - Optimized

import { memo, useRef, useMemo } from 'react';
import { Mesh, Color } from 'three';
import { useFrame } from '@react-three/fiber';
import { to3D } from '../utils/coordinates';
import { COLORS, VISUALIZATION } from '../utils/constants';

interface TargetMarkerProps {
  x: number;
  y: number;
}

export const TargetMarker = memo(function TargetMarker({ x, y }: TargetMarkerProps) {
  const ringRef = useRef<Mesh>(null);
  const position = useMemo(() => to3D(x, y, -0.5), [x, y]); // Memoize position calculation
  const targetColor = useMemo(() => new Color(COLORS.TARGET), []); // Memoize color

  // Rotating animation
  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <group position={position}>
      {/* Outer ring - reduced segments for performance */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[VISUALIZATION.TARGET_RADIUS, VISUALIZATION.TARGET_RADIUS + 0.2, 16]} />
        <meshBasicMaterial 
          color={targetColor}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Inner glow - reduced segments */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[VISUALIZATION.TARGET_RADIUS * 0.5, 16]} />
        <meshBasicMaterial 
          color={targetColor}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
});
