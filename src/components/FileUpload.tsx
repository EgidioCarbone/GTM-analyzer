import React, { useRef } from "react";
import { Upload } from "lucide-react";

export default function FileUpload({ onFile }: { onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-[#1a365d] dark:text-orange-300">
          🚀 LikeSense - GTM AIntelligence 🚀 
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md">
          Carica un file JSON esportato da Google Tag Manager per analizzare tag,
          trigger e variabili con una dashboard interattiva.
        </p>
      </div>

      <div
        onClick={() => input.current?.click()}
        className="border-2 border-dashed border-gray-300 dark:border-gray-500
                   hover:border-[#FF6B35] rounded-xl p-10 w-full max-w-2xl
                   text-center bg-white dark:bg-gray-800 cursor-pointer
                   transition-all shadow-sm hover:shadow-lg"
      >
        <Upload className="mx-auto w-10 h-10 text-[#FF6B35]" />
        <p className="mt-2 text-gray-700 dark:text-gray-200 font-medium">
          Clicca o trascina qui il file JSON del contenitore GTM
        </p>
        <input
          ref={input}
          hidden
          type="file"
          accept="application/json"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </div>
    </div>
  );
}