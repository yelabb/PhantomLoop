// Main 3D Arena Component - Performance Optimized

import { memo, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { PhantomCursor } from './PhantomCursor';
import { BioLinkCursor } from './BioLinkCursor';
import { LoopBackCursor } from './LoopBackCursor';
import { TargetMarker } from './TargetMarker';
import { GridFloor } from './GridFloor';
import { ErrorLines } from './ErrorLines';
import { CameraController } from './CameraController';
import { useStore } from '../store';
import { normalizePosition } from '../utils/coordinates';
import type { StreamPacket } from '../types/packets';
import type { DecoderOutput } from '../types/decoders';

// Memoized scene content to prevent re-renders from Canvas
interface SceneContentProps {
  packet: StreamPacket | null;
  decoderOutput: DecoderOutput | null;
  showPhantom: boolean;
  showBioLink: boolean;
  showLoopBack: boolean;
  showTrails: boolean;
  showTarget: boolean;
  showGrid: boolean;
}

const SceneContent = memo(function SceneContent({
  packet,
  decoderOutput,
  showPhantom,
  showBioLink,
  showLoopBack,
  showTrails,
  showTarget,
  showGrid,
}: SceneContentProps) {
  // Memoize position calculations - use full objects in deps for React Compiler compatibility
  const positions = useMemo(() => {
    if (!packet?.data?.intention || !packet?.data?.kinematics) {
      return null;
    }

    const { intention, kinematics } = packet.data;
    
    const phantomPos = normalizePosition(intention.target_x, intention.target_y);
    const bioLinkPos = normalizePosition(kinematics.x, kinematics.y);
    const loopBackPos = decoderOutput 
      ? normalizePosition(decoderOutput.x, decoderOutput.y)
      : bioLinkPos;

    return { phantomPos, bioLinkPos, loopBackPos };
  }, [packet?.data, decoderOutput]);

  if (!positions) {
    return null;
  }

  const { phantomPos, bioLinkPos, loopBackPos } = positions;

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
});

export function Arena() {
  // Use individual selectors to prevent unnecessary re-renders
  const currentPacket = useStore((state) => state.currentPacket);
  const decoderOutput = useStore((state) => state.decoderOutput);
  const showPhantom = useStore((state) => state.showPhantom);
  const showBioLink = useStore((state) => state.showBioLink);
  const showLoopBack = useStore((state) => state.showLoopBack);
  const showTrails = useStore((state) => state.showTrails);
  const showTarget = useStore((state) => state.showTarget);
  const showGrid = useStore((state) => state.showGrid);

  return (
    <Canvas
      camera={{ position: [50, 50, 50], fov: 60 }}
      style={{ background: '#0a0a0a' }}
      // Performance optimizations
      gl={{ 
        antialias: false, // Disable for performance
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
      }}
      dpr={[1, 1.5]} // Limit DPR for performance
      frameloop="always" // Need continuous for smooth cursor animations
    >
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.4} />

      {/* Camera Controls */}
      <CameraController />
      <OrbitControls makeDefault />

      {/* Memoized scene content */}
      <SceneContent
        packet={currentPacket}
        decoderOutput={decoderOutput}
        showPhantom={showPhantom}
        showBioLink={showBioLink}
        showLoopBack={showLoopBack}
        showTrails={showTrails}
        showTarget={showTarget}
        showGrid={showGrid}
      />
    </Canvas>
  );
}
