// Base Cursor Component - Optimized for 40Hz updates

import { useRef, useMemo, memo, useLayoutEffect } from 'react';
import { Mesh, Color, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { to3D, lerp } from '../utils/coordinates';

interface CursorProps {
  x: number;
  y: number;
  color: string;
  size: number;
  emissiveIntensity?: number;
}

// Memoized cursor component to prevent unnecessary re-renders
export const Cursor = memo(function Cursor({ 
  x, 
  y, 
  color, 
  size,
  emissiveIntensity = 0.5 
}: CursorProps) {
  const meshRef = useRef<Mesh>(null);
  const targetRef = useRef(new Vector3(0, 0, 0));
  const timeRef = useRef(0);
  
  // Memoize color to avoid creating new Color objects
  const colorObj = useMemo(() => new Color(color), [color]);
  
  // Update target position in layout effect (before paint, after render)
  useLayoutEffect(() => {
    const pos = to3D(x, y, 0);
    targetRef.current.set(pos[0], pos[1], pos[2]);
  }, [x, y]);

  // Smooth interpolation for cursor movement - runs at 60fps in RAF
  useFrame((_, delta) => {
    if (meshRef.current) {
      const target = targetRef.current;
      const lerpFactor = 1 - Math.pow(0.001, delta); // Frame-rate independent lerp
      
      meshRef.current.position.x = lerp(meshRef.current.position.x, target.x, lerpFactor);
      meshRef.current.position.y = lerp(meshRef.current.position.y, target.y, lerpFactor);
      meshRef.current.position.z = lerp(meshRef.current.position.z, target.z, lerpFactor);

      // Gentle floating animation using accumulated time (no Date.now() garbage)
      timeRef.current += delta;
      meshRef.current.position.y += Math.sin(timeRef.current * 2) * 0.1;
    }
  });

  // Use lower polygon count for better performance (16 segments instead of 32)
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial 
        color={colorObj}
        emissive={colorObj}
        emissiveIntensity={emissiveIntensity}
        roughness={0.3}
        metalness={0.7}
      />
    </mesh>
  );
});
