import React, { useState } from 'react';

interface UrlFormProps {
  onStart: (url: string) => void;
  onStop: () => void;
  running: boolean;
}

export function UrlForm({ onStart, onStop, running }: UrlFormProps) {
  const [url, setUrl] = useState('https://demo.google-analytics.com/');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onStart(url.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
            Target URL
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={running}
            placeholder="https://example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            required
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={running}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Avvia
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={!running}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Stop
          </button>
        </div>
      </div>
    </form>
  );
}
