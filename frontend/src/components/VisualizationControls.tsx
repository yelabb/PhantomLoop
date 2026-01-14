// Visualization Controls Component

import { useStore } from '../store';

// Define CheckboxItem outside the component
const CheckboxItem = ({ 
  label, 
  checked, 
  onChange, 
  color 
}: { 
  label: string; 
  checked: boolean; 
  onChange: () => void;
  color?: string;
}) => (
  <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-800/50 p-2 rounded transition">
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 rounded accent-phantom"
    />
    <span className={`text-sm ${color || 'text-white'}`}>{label}</span>
  </label>
);

export function VisualizationControls() {
  const {
    showPhantom,
    showBioLink,
    showLoopBack,
    showTrails,
    showTarget,
    showGrid,
    cameraMode,
    togglePhantom,
    toggleBioLink,
    toggleLoopBack,
    toggleTrails,
    toggleTarget,
    toggleGrid,
    setCameraMode,
  } = useStore();

  return (
    <div className="bg-gray-900/90 backdrop-blur-sm p-4 rounded-lg border border-gray-700 w-80">
      <h3 className="text-sm font-semibold text-white mb-3">Visualization</h3>
      
      {/* Trinity Toggles */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">Trinity Cursors</p>
        <div className="flex flex-col gap-1">
          <CheckboxItem
            label="🟡 Phantom (Intention)"
            checked={showPhantom}
            onChange={togglePhantom}
            color="text-phantom"
          />
          <CheckboxItem
            label="🟢 Bio-Link (Ground Truth)"
            checked={showBioLink}
            onChange={toggleBioLink}
            color="text-biolink"
          />
          <CheckboxItem
            label="🔵 Loop-Back (Decoder)"
            checked={showLoopBack}
            onChange={toggleLoopBack}
            color="text-loopback"
          />
        </div>
      </div>

      {/* Other Options */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-2">Environment</p>
        <div className="flex flex-col gap-1">
          <CheckboxItem
            label="Trajectory Trails"
            checked={showTrails}
            onChange={toggleTrails}
          />
          <CheckboxItem
            label="Target Marker"
            checked={showTarget}
            onChange={toggleTarget}
          />
          <CheckboxItem
            label="Grid Floor"
            checked={showGrid}
            onChange={toggleGrid}
          />
        </div>
      </div>

      {/* Camera Mode */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Camera</p>
        <div className="flex gap-2">
          {(['top', 'perspective', 'side'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setCameraMode(mode)}
              className={`flex-1 px-3 py-2 rounded text-xs font-medium transition ${
                cameraMode === mode
                  ? 'bg-phantom text-black'
                  : 'bg-gray-800 text-white hover:bg-gray-700'
              }`}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
