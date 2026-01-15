// Temporal Inspector - Redux DevTools-inspired timeline control

import { memo, useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { STREAM_CONFIG } from '../utils/constants';

const ReplayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6a6 6 0 0 1-6 6 6 6 0 0 1-5.65-4H4.26A8 8 0 0 0 12 21a8 8 0 0 0 0-16z" />
  </svg>
);

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const StepIcon = ({ direction }: { direction: 'back' | 'forward' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    {direction === 'back' ? (
      <path d="M11 7v10l-5-5 5-5zm2 10V7l6 5-6 5z" />
    ) : (
      <path d="M13 17V7l5 5-5 5zM11 7v10l-6-5 6-5z" />
    )}
  </svg>
);

const LiveIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8 4a8 8 0 0 1-8 8 8 8 0 0 1-8-8 8 8 0 0 1 8-8 8 8 0 0 1 8 8z" />
  </svg>
);

type Snapshot = {
  id: string;
  index: number;
  timestamp: number;
  decoderName: string;
  groundTruth: { x: number; y: number };
  decoded?: { x: number; y: number };
  error: number | null;
};

export const TemporalInspector = memo(function TemporalInspector() {
  const packetHistory = useStore((state) => state.packetHistory);
  const timelineIndex = useStore((state) => state.timelineIndex);
  const isTimeTraveling = useStore((state) => state.isTimeTraveling);
  const setTimelineIndex = useStore((state) => state.setTimelineIndex);
  const setTimeTraveling = useStore((state) => state.setTimeTraveling);
  const resumeLive = useStore((state) => state.resumeLive);
  const decoderOutput = useStore((state) => state.decoderOutput);
  const activeDecoder = useStore((state) => state.activeDecoder);

  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(0);
  const [loopReplay, setLoopReplay] = useState(true);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  const historyLength = packetHistory.length;
  const maxIndex = Math.max(0, historyLength - 1);

  const clampedTimelineIndex = Math.min(timelineIndex, maxIndex);
  const clampedRangeStart = Math.min(rangeStart, maxIndex);
  const clampedRangeEnd = Math.min(Math.max(rangeEnd, clampedRangeStart), maxIndex);

  useEffect(() => {
    if (!isReplaying || historyLength === 0) return;

    if (!isTimeTraveling) {
      setTimeTraveling(true);
      setTimelineIndex(clampedRangeStart);
    }

    const interval = Math.max(5, STREAM_CONFIG.PACKET_INTERVAL_MS / replaySpeed);
    const handle = window.setInterval(() => {
      const currentIndex = useStore.getState().timelineIndex;
      const next = currentIndex + 1;

      if (next > clampedRangeEnd) {
        if (loopReplay) {
          setTimelineIndex(clampedRangeStart);
          return;
        }
        setIsReplaying(false);
        return;
      }

      setTimelineIndex(next);
    }, interval);

    return () => window.clearInterval(handle);
  }, [isReplaying, historyLength, clampedRangeStart, clampedRangeEnd, loopReplay, replaySpeed, isTimeTraveling, setTimeTraveling, setTimelineIndex]);

  const selectedPacket = packetHistory[clampedTimelineIndex];
  const livePacket = packetHistory[historyLength - 1];

  const selectedTimeMs = selectedPacket?.data?.trial_time_ms ?? 0;
  const liveTimeMs = livePacket?.data?.trial_time_ms ?? 0;

  const deltaToLive = useMemo(() => {
    if (!selectedPacket || !livePacket) return null;
    const dx = selectedPacket.data.kinematics.x - livePacket.data.kinematics.x;
    const dy = selectedPacket.data.kinematics.y - livePacket.data.kinematics.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return { dx, dy, dist };
  }, [selectedPacket, livePacket]);

  const handleScrub = (value: number) => {
    if (historyLength === 0) return;
    setTimeTraveling(true);
    setTimelineIndex(value);
  };

  const handleSnapshot = () => {
    if (!selectedPacket) return;
    const gt = selectedPacket.data.kinematics;
    const decoded = decoderOutput ? { x: decoderOutput.x, y: decoderOutput.y } : undefined;
    const error = decoded
      ? Math.sqrt((gt.x - decoded.x) ** 2 + (gt.y - decoded.y) ** 2)
      : null;

    const snapshot: Snapshot = {
      id: `${selectedPacket.data.sequence_number}-${Date.now()}`,
      index: clampedTimelineIndex,
      timestamp: selectedPacket.data.trial_time_ms,
      decoderName: activeDecoder?.name ?? 'No Decoder',
      groundTruth: { x: gt.x, y: gt.y },
      decoded,
      error,
    };

    setSnapshots((prev) => [snapshot, ...prev].slice(0, 8));
  };

  const speedOptions = [0.25, 0.5, 1, 2, 4];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isTimeTraveling ? 'bg-purple-400' : 'bg-green-400'}`} />
          <span className="text-xs text-gray-300">
            {isTimeTraveling ? 'Time Travel' : 'Live Stream'}
          </span>
        </div>
        <button
          onClick={resumeLive}
          className="flex items-center gap-2 text-xs text-gray-200 px-2 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700"
        >
          <LiveIcon />
          Live
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>History</span>
          <span>
            {historyLength === 0 ? '0' : `${clampedTimelineIndex + 1} / ${historyLength}`}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={maxIndex}
          value={clampedTimelineIndex}
          onChange={(event) => handleScrub(Number(event.target.value))}
          className="w-full accent-purple-500"
          disabled={historyLength === 0}
        />
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>{(selectedTimeMs / 1000).toFixed(2)}s</span>
          <span>{(liveTimeMs / 1000).toFixed(2)}s</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleScrub(Math.max(0, clampedTimelineIndex - 40))}
            className="px-2 py-1 text-xs text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700"
            title="Back 1s"
          >
            -1s
          </button>
          <button
            onClick={() => setTimelineIndex(Math.max(0, clampedTimelineIndex - 1))}
            className="p-1 text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700"
            title="Step back"
          >
            <StepIcon direction="back" />
          </button>
          <button
            onClick={() => setTimelineIndex(Math.min(maxIndex, clampedTimelineIndex + 1))}
            className="p-1 text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700"
            title="Step forward"
          >
            <StepIcon direction="forward" />
          </button>
          <button
            onClick={() => handleScrub(Math.min(maxIndex, clampedTimelineIndex + 40))}
            className="px-2 py-1 text-xs text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-700"
            title="Forward 1s"
          >
            +1s
          </button>
        </div>

        <button
          onClick={() => setIsReplaying((prev) => !prev)}
          className={`flex items-center gap-2 px-3 py-1 text-xs border ${
            isReplaying ? 'bg-purple-600/80 border-purple-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-200'
          }`}
          disabled={historyLength === 0}
        >
          {isReplaying ? <PauseIcon /> : <ReplayIcon />}
          {isReplaying ? 'Pause' : 'Replay'}
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Replay Range</span>
          <span>{clampedRangeStart + 1} → {clampedRangeEnd + 1}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="range"
            min={0}
            max={maxIndex}
            value={clampedRangeStart}
            onChange={(event) => setRangeStart(Math.min(Number(event.target.value), clampedRangeEnd))}
            className="w-full accent-blue-500"
            disabled={historyLength === 0}
          />
          <input
            type="range"
            min={0}
            max={maxIndex}
            value={clampedRangeEnd}
            onChange={(event) => setRangeEnd(Math.max(Number(event.target.value), clampedRangeStart))}
            className="w-full accent-pink-500"
            disabled={historyLength === 0}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>Start</span>
          <span>End</span>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
        <div className="flex items-center gap-2">
          {speedOptions.map((speed) => (
            <button
              key={speed}
              onClick={() => setReplaySpeed(speed)}
              className={`px-2 py-1 text-[11px] border ${
                replaySpeed === speed
                  ? 'bg-blue-600/80 border-blue-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-300'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-300">
          <input
            type="checkbox"
            checked={loopReplay}
            onChange={(event) => setLoopReplay(event.target.checked)}
            className="accent-purple-500"
          />
          Loop
        </label>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Realtime Δ</span>
        {deltaToLive ? (
          <span className="text-gray-300">
            Δx {deltaToLive.dx.toFixed(2)} · Δy {deltaToLive.dy.toFixed(2)} · d {deltaToLive.dist.toFixed(2)}
          </span>
        ) : (
          <span className="text-gray-500">-</span>
        )}
      </div>

      <div className="border border-gray-800/80 bg-gray-900/40 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Snapshots</span>
          <button
            onClick={handleSnapshot}
            className="text-xs text-purple-200 px-2 py-1 bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30"
            disabled={!selectedPacket}
          >
            Capture
          </button>
        </div>
        {snapshots.length === 0 ? (
          <p className="text-xs text-gray-500">Capture points to compare decoder behavior over time.</p>
        ) : (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {snapshots.map((shot) => (
              <div key={shot.id} className="flex items-center justify-between gap-2 text-[11px] text-gray-300">
                <button
                  onClick={() => handleScrub(shot.index)}
                  className="text-left flex-1 hover:text-white"
                >
                  <div className="font-medium text-gray-200">{shot.decoderName}</div>
                  <div className="text-gray-500">
                    t={(shot.timestamp / 1000).toFixed(2)}s · err {shot.error ? shot.error.toFixed(2) : 'n/a'}
                  </div>
                </button>
                <button
                  onClick={() => setSnapshots((prev) => prev.filter((item) => item.id !== shot.id))}
                  className="text-gray-500 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
