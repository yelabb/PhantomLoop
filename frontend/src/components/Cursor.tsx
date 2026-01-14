// Base Cursor Component

import { useRef } from 'react';
import { Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import { to3D, lerp } from '../utils/coordinates';

interface CursorProps {
  x: number;
  y: number;
  color: string;
  size: number;
  emissiveIntensity?: number;
}

export function Cursor({ 
  x, 
  y, 
  color, 
  size,
  emissiveIntensity = 0.5 
}: CursorProps) {
  const meshRef = useRef<Mesh>(null);
  const targetPos = to3D(x, y, 0);

  // Smooth interpolation for cursor movement
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.x = lerp(meshRef.current.position.x, targetPos[0], 0.3);
      meshRef.current.position.y = lerp(meshRef.current.position.y, targetPos[1], 0.3);
      meshRef.current.position.z = lerp(meshRef.current.position.z, targetPos[2], 0.3);

      // Gentle floating animation
      const time = Date.now() * 0.001;
      meshRef.current.position.y += Math.sin(time * 2) * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} position={targetPos}>
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial 
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        roughness={0.3}
        metalness={0.7}
      />
    </mesh>
  );
}
