// src/components/FileUpload.tsx

import React, { useRef } from "react";
import { Upload } from "lucide-react";

export default function FileUpload({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="lex flex-col items-center justify-center min-h-screen w-full p-6 bg-gray-50" style={{alignContent: "center"}}
    >
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold text-[#1a365d] tracking-tight">
          🚀 Benvenuto su GTM Analyzer
        </h1>
        <p className="text-gray-600 text-base">
          Carica il file JSON esportato da Google Tag Manager per visualizzare una dashboard interattiva con analisi dettagliate di tag, trigger e variabili del tuo contenitore.
        </p>
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        className="mt-10 w-full bg-gradient-to-br from-white to-gray-50 border-4 border-dashed border-gray-300 hover:border-[#FF6B35] rounded-2xl p-12 cursor-pointer transition-all shadow hover:shadow-xl flex flex-col items-center space-y-4 group"
      >
        <div className="bg-[#FF6B35]/10 p-5 rounded-full shadow-sm group-hover:scale-105 transition-transform">
          <Upload className="w-14 h-14 text-[#FF6B35] animate-pulse group-hover:animate-none" />
        </div>
        <p className="text-gray-700 font-medium text-lg">
          Trascina qui il file JSON oppure clicca per selezionarlo
        </p>
        <p className="text-xs text-gray-400">Formato supportato: .json</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </div>
    </div>
  );
}