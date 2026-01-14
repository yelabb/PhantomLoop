// Visualization Controls Component - Optimized with improved UI

import { memo } from 'react';
import { useStore } from '../store';

// Toggle switch component
const ToggleSwitch = memo(function ToggleSwitch({ 
  label, 
  checked, 
  onChange, 
  color,
  icon,
}: { 
  label: string; 
  checked: boolean; 
  onChange: () => void;
  color?: string;
  icon?: string;
}) {
  return (
    <button 
      onClick={onChange}
      className="flex items-center justify-between cursor-pointer hover:bg-gray-800/30 px-2 py-1.5 rounded-lg transition-all duration-200 group w-full text-left"
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-sm">{icon}</span>}
        <span className={`text-sm transition-colors duration-200 ${
          checked ? (color || 'text-white') : 'text-gray-500'
        }`}>{label}</span>
      </div>
      <div className={`relative w-8 h-4 rounded-full transition-all duration-200 ${
        checked ? 'bg-gray-600' : 'bg-gray-800'
      }`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-200 ${
          checked 
            ? `left-4 ${color?.replace('text-', 'bg-') || 'bg-white'}` 
            : 'left-0.5 bg-gray-600'
        }`} />
      </div>
    </button>
  );
});

export const VisualizationControls = memo(function VisualizationControls() {
  const showPhantom = useStore((state) => state.showPhantom);
  const showBioLink = useStore((state) => state.showBioLink);
  const showLoopBack = useStore((state) => state.showLoopBack);
  const showTrails = useStore((state) => state.showTrails);
  const showTarget = useStore((state) => state.showTarget);
  const showGrid = useStore((state) => state.showGrid);
  const cameraMode = useStore((state) => state.cameraMode);
  const togglePhantom = useStore((state) => state.togglePhantom);
  const toggleBioLink = useStore((state) => state.toggleBioLink);
  const toggleLoopBack = useStore((state) => state.toggleLoopBack);
  const toggleTrails = useStore((state) => state.toggleTrails);
  const toggleTarget = useStore((state) => state.toggleTarget);
  const toggleGrid = useStore((state) => state.toggleGrid);
  const setCameraMode = useStore((state) => state.setCameraMode);

  return (
    <div className="glass-panel p-4 rounded-xl w-80 pointer-events-auto animate-slide-up" style={{ animationDelay: '0.2s' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-biolink animate-pulse" />
        <h3 className="text-sm font-semibold text-white">Visualization</h3>
      </div>
      
      {/* Trinity Toggles */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Cursors</p>
        <div className="flex flex-col">
          <ToggleSwitch
            icon="◉"
            label="Phantom"
            checked={showPhantom}
            onChange={togglePhantom}
            color="text-phantom"
          />
          <ToggleSwitch
            icon="◉"
            label="Bio-Link"
            checked={showBioLink}
            onChange={toggleBioLink}
            color="text-biolink"
          />
          <ToggleSwitch
            icon="◉"
            label="Loop-Back"
            checked={showLoopBack}
            onChange={toggleLoopBack}
            color="text-loopback"
          />
        </div>
      </div>

      {/* Other Options */}
      <div className="mb-4 pt-2 border-t border-gray-700/50">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Environment</p>
        <div className="flex flex-col">
          <ToggleSwitch
            label="Trails"
            checked={showTrails}
            onChange={toggleTrails}
          />
          <ToggleSwitch
            label="Target"
            checked={showTarget}
            onChange={toggleTarget}
          />
          <ToggleSwitch
            label="Grid"
            checked={showGrid}
            onChange={toggleGrid}
          />
        </div>
      </div>

      {/* Camera Mode */}
      <div className="pt-2 border-t border-gray-700/50">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Camera</p>
        <div className="flex gap-1.5">
          {(['top', 'perspective', 'side'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setCameraMode(mode)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                cameraMode === mode
                  ? 'bg-gradient-to-r from-phantom/80 to-yellow-500/80 text-black shadow-lg shadow-phantom/20'
                  : 'bg-gray-800/80 text-gray-400 hover:bg-gray-700/80 hover:text-white'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
