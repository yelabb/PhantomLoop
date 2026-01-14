// Camera Controller Component - Optimized

import { memo, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useStore } from '../store';
import { CAMERA_PRESETS } from '../utils/constants';

export const CameraController = memo(function CameraController() {
  const { camera } = useThree();
  const cameraMode = useStore((state) => state.cameraMode); // Individual selector
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    const preset = CAMERA_PRESETS[cameraMode];
    const [x, y, z] = preset.position;
    
    // Smooth camera transition
    const duration = 1000; // 1 second
    const startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

      camera.position.x = startPos.x + (x - startPos.x) * eased;
      camera.position.y = startPos.y + (y - startPos.y) * eased;
      camera.position.z = startPos.z + (z - startPos.z) * eased;

      camera.lookAt(preset.target[0], preset.target[1], preset.target[2]);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [cameraMode, camera]);

  return null;
});
