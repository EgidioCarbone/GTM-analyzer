import React from "react";
import { X } from "lucide-react";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Conferma",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6 relative animate-[fadeIn_0.15s_ease-out]">
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 rounded hover:bg-black/5"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        <p className="text-sm text-gray-700 mb-6 whitespace-pre-line">
          {message}
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-100"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:brightness-110"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}