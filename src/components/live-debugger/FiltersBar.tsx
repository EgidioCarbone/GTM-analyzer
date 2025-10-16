import React from 'react';

interface FiltersBarProps {
  gaOnly: boolean;
  setGaOnly: (value: boolean) => void;
  searchText: string;
  setSearchText: (value: string) => void;
  eventType: string;
  setEventType: (value: string) => void;
}

export function FiltersBar({
  gaOnly,
  setGaOnly,
  searchText,
  setSearchText,
  eventType,
  setEventType,
}: FiltersBarProps) {
  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <div className="flex flex-wrap gap-4 items-center">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={gaOnly}
            onChange={(e) => setGaOnly(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Solo GA collect</span>
        </label>

        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Cerca nel payload..."
          className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />

        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">Tutti gli eventi</option>
          <option value="datalayer.push">DataLayer Push</option>
          <option value="ga4.hit">GA4 Hit</option>
          <option value="ua.hit">UA Hit</option>
          <option value="console">Console</option>
          <option value="note">Note</option>
        </select>
      </div>
    </div>
  );
}
