// Main 3D Arena Component

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { PhantomCursor } from './PhantomCursor';
import { BioLinkCursor } from './BioLinkCursor';
import { LoopBackCursor } from './LoopBackCursor';
import { TargetMarker } from './TargetMarker';
import { GridFloor } from './GridFloor';
import { ErrorLines } from './ErrorLines';
import { CameraController } from './CameraController';
import { useStore } from '../store';
import { normalizePosition } from '../utils/coordinates';

export function Arena() {
  const { 
    currentPacket, 
    decoderOutput,
    showPhantom,
    showBioLink,
    showLoopBack,
    showTrails,
    showTarget,
    showGrid,
  } = useStore();

  const hasData = !!currentPacket;

  return (
    <Canvas
      camera={{ position: [50, 50, 50], fov: 60 }}
      style={{ background: '#0a0a0a' }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.4} />

      {/* Camera Controls */}
      <CameraController />
      <OrbitControls makeDefault />
      <Stats />

      {hasData && (() => {
        try {
          // Extract data from packet
          const intention = currentPacket?.data?.intention;
          const kinematics = currentPacket?.data?.kinematics;
          
          if (!intention || !kinematics) {
            console.warn('[Arena] Missing data:', { intention: !!intention, kinematics: !!kinematics });
            return null;
          }

          // Normalize coordinates
          const phantomPos = normalizePosition(intention.target_x, intention.target_y);
          const bioLinkPos = normalizePosition(kinematics.x, kinematics.y);
          const loopBackPos = decoderOutput 
            ? normalizePosition(decoderOutput.x, decoderOutput.y)
            : bioLinkPos;

          return (
            <>
              {/* Trinity Cursors */}
              {showPhantom && <PhantomCursor x={phantomPos.x} y={phantomPos.y} />}
              {showBioLink && <BioLinkCursor x={bioLinkPos.x} y={bioLinkPos.y} />}
              {showLoopBack && <LoopBackCursor x={loopBackPos.x} y={loopBackPos.y} />}

              {/* Error Lines - show distance between cursors */}
              {showTrails && <ErrorLines />}

              {/* Target Marker */}
              {showTarget && <TargetMarker x={phantomPos.x} y={phantomPos.y} />}

              {/* Grid Floor */}
              {showGrid && <GridFloor />}
            </>
          );
        } catch (error) {
          console.error('[Arena] Error rendering:', error);
          return null;
        }
      })()}
    </Canvas>
  );
}
