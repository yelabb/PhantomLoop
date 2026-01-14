// Camera Controller Component

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useStore } from '../store';
import { CAMERA_PRESETS } from '../utils/constants';

export function CameraController() {
  const { camera } = useThree();
  const { cameraMode } = useStore();

  useEffect(() => {
    const preset = CAMERA_PRESETS[cameraMode];
    const [x, y, z] = preset.position;
    
    // Smooth camera transition
    const duration = 1000; // 1 second
    const startPos = { ...camera.position };
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

      camera.position.x = startPos.x + (x - startPos.x) * eased;
      camera.position.y = startPos.y + (y - startPos.y) * eased;
      camera.position.z = startPos.z + (z - startPos.z) * eased;

      camera.lookAt(preset.target[0], preset.target[1], preset.target[2]);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [cameraMode, camera]);

  return null;
}
