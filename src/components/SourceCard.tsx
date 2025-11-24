import React from "react";

export type SourceItem = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
};

type Props = {
  source: SourceItem;
  onSelect: (id: string) => void;
};

export function SourceCard({ source, onSelect }: Props) {
  return (
    <button
      onClick={() => onSelect(source.id)}
      className="w-full text-left bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md hover:-translate-y-[1px] transition transform focus:outline-none focus:ring-2 focus:ring-orange-200"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center">{source.icon}</div>
        <div className="text-lg font-semibold text-gray-900">{source.name}</div>
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{source.description}</p>
      <div className="mt-auto">
        <div className="w-full text-center rounded-md bg-[#FF6A00] hover:bg-[#FF8A33] text-white font-semibold py-2.5 text-sm">
          Get Started
        </div>
      </div>
    </button>
  );
}
