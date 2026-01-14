// Trajectory Trail Component

import { useMemo } from 'react';
import { Vector3 } from 'three';
import { Line } from '@react-three/drei';
import { useStore } from '../store';
import { normalizePosition, to3D } from '../utils/coordinates';
import { VISUALIZATION } from '../utils/constants';

interface TrajectoryLineProps {
  color: string;
  type: 'phantom' | 'biolink' | 'loopback';
}

export function TrajectoryLine({ color, type }: TrajectoryLineProps) {
  const { packetBuffer, decoderOutput } = useStore();
  
  const points = useMemo(() => {
    if (packetBuffer.length === 0) return [];

    const newPoints: Vector3[] = [];

    for (let i = Math.max(0, packetBuffer.length - VISUALIZATION.TRAIL_LENGTH); i < packetBuffer.length; i++) {
      const packet = packetBuffer[i];
      let pos;

      if (type === 'phantom') {
        pos = normalizePosition(
          packet.data.intention.target_x,
          packet.data.intention.target_y
        );
      } else if (type === 'biolink') {
        pos = normalizePosition(
          packet.data.kinematics.x,
          packet.data.kinematics.y
        );
      } else if (type === 'loopback' && decoderOutput) {
        pos = normalizePosition(decoderOutput.x, decoderOutput.y);
      } else {
        continue;
      }

      const [x, y, z] = to3D(pos.x, pos.y, 0);
      newPoints.push(new Vector3(x, y, z));
    }

    return newPoints;
  }, [packetBuffer, type, decoderOutput]);

  if (points.length < 2) {
    return null;
  }

  return (
    <Line
      points={points}
      color={color}
      lineWidth={2}
      transparent
      opacity={0.6}
    />
  );
}
