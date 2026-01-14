// Error Visualization - Lines showing distance between Trinity cursors

import { Line } from '@react-three/drei';
import { useStore } from '../store';
import { normalizePosition, to3D } from '../utils/coordinates';
import { COLORS } from '../utils/constants';

export function ErrorLines() {
  const { currentPacket, decoderOutput } = useStore();

  if (!currentPacket?.data) return null;

  const intention = currentPacket.data.intention;
  const kinematics = currentPacket.data.kinematics;

  // Normalize coordinates
  const phantomPos = normalizePosition(intention.target_x, intention.target_y);
  const bioLinkPos = normalizePosition(kinematics.x, kinematics.y);
  const loopBackPos = decoderOutput 
    ? normalizePosition(decoderOutput.x, decoderOutput.y)
    : bioLinkPos;

  // Convert to 3D
  const phantom3D = to3D(phantomPos.x, phantomPos.y, 0);
  const bioLink3D = to3D(bioLinkPos.x, bioLinkPos.y, 0);
  const loopBack3D = to3D(loopBackPos.x, loopBackPos.y, 0);

  return (
    <>
      {/* Phantom → Bio-Link (Intention Error) */}
      <Line
        points={[phantom3D, bioLink3D]}
        color="#FFFF00"
        lineWidth={2}
        dashed
        dashScale={2}
        transparent
        opacity={0.5}
      />

      {/* Bio-Link → Loop-Back (Decoder Error) */}
      {decoderOutput && (
        <Line
          points={[bioLink3D, loopBack3D]}
          color="#FF00FF"
          lineWidth={3}
          transparent
          opacity={0.7}
        />
      )}

      {/* Phantom → Loop-Back (Total Error) */}
      {decoderOutput && (
        <Line
          points={[phantom3D, loopBack3D]}
          color="#FF4444"
          lineWidth={1}
          dashed
          dashScale={4}
          transparent
          opacity={0.3}
        />
      )}
    </>
  );
}
