import React, { useEffect, useState } from 'react';

interface StatusBarProps {
  running: boolean;
  startTime?: number;
}

export function StatusBar({ running, startTime }: StatusBarProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running || !startTime) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 100);

    return () => clearInterval(interval);
  }, [running, startTime]);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hrs = Math.floor(minutes / 60);

    if (hrs > 0) {
      return `${hrs}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const status = running ? 'RUNNING' : 'STOPPED';
  const statusColor = running ? 'bg-green-500' : 'bg-gray-400';

  return (
    <div className="bg-white p-4 rounded-lg shadow-md flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${statusColor} animate-pulse`}></div>
        <span className="font-semibold text-gray-700">Status: {status}</span>
      </div>
      {running && startTime && (
        <div className="text-gray-600 font-mono">
          {formatTime(elapsed)}
        </div>
      )}
    </div>
  );
}
