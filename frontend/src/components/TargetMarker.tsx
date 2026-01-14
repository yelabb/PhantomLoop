// Target Marker Component

import { useRef } from 'react';
import { Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import { to3D } from '../utils/coordinates';
import { COLORS, VISUALIZATION } from '../utils/constants';

interface TargetMarkerProps {
  x: number;
  y: number;
}

export function TargetMarker({ x, y }: TargetMarkerProps) {
  const ringRef = useRef<Mesh>(null);
  const position = to3D(x, y, -0.5); // Slightly below cursors

  // Rotating animation
  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.rotation.y = clock.getElapsedTime() * 0.5;
    }
  });

  return (
    <group position={position}>
      {/* Outer ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[VISUALIZATION.TARGET_RADIUS, VISUALIZATION.TARGET_RADIUS + 0.2, 32]} />
        <meshBasicMaterial 
          color={COLORS.TARGET}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Inner glow */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[VISUALIZATION.TARGET_RADIUS * 0.5, 32]} />
        <meshBasicMaterial 
          color={COLORS.TARGET}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
}
