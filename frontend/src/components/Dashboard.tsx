// Main Dashboard Overlay Component - Memoized

import { memo } from 'react';
import { ConnectionStatus } from './ConnectionStatus';
import { SessionManager } from './SessionManager';
import { DecoderSelector } from './DecoderSelector';
import { MetricsPanel } from './MetricsPanel';
import { VisualizationControls } from './VisualizationControls';
import { DesyncAlert } from './DesyncAlert';

export const Dashboard = memo(function Dashboard() {
  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between pointer-events-auto">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-phantom">PHANTOM LOOP</h1>
          <p className="text-sm text-gray-400">Neural Gauntlet Arena</p>
        </div>
        
        <ConnectionStatus />
      </div>

      {/* Left Sidebar */}
      <div className="absolute top-20 left-4 flex flex-col gap-4 pointer-events-auto">
        <SessionManager />
        <DecoderSelector />
        <VisualizationControls />
      </div>

      {/* Right Sidebar */}
      <div className="absolute top-20 right-4 pointer-events-auto">
        <MetricsPanel />
      </div>

      {/* Bottom Center - Desync Alert */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto">
        <DesyncAlert />
      </div>
    </div>
  );
});
