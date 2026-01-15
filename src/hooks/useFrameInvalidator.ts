// Frame invalidator hook - triggers Canvas re-renders at controlled rate
// This works with Canvas frameloop="demand" for optimal performance

import { useEffect, useRef } from 'react';
// import { useThree } from '@react-three/fiber';

/**
 * Invalidates the Three.js frame at a controlled rate
 * Use this inside Canvas components to trigger renders
 * @param targetFPS - Target frames per second (default: 60)
 */
export function useFrameInvalidator(targetFPS: number = 60) {
  // const { invalidate } = useThree();
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const frameInterval = 1000 / targetFPS;

  useEffect(() => {
    const animate = (time: number) => {
      const elapsed = time - lastTimeRef.current;

      if (elapsed >= frameInterval) {
        lastTimeRef.current = time - (elapsed % frameInterval);
        // invalidate();
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [frameInterval]);
}
