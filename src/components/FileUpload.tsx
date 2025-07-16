import React, { useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";

export default function FileUpload({ onFile }: { onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (file: File) => {
    setLoading(true);
    setTimeout(() => {
      onFile(file);
      // Lasciamo loading attivo: sarà disattivato quando cambia il contesto esterno
    }, 800); // Simuliamo un breve delay
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] animate-fadeIn space-y-12 transition-all duration-300">
      {loading ? (
        <div className="flex flex-col items-center space-y-6 animate-fadeIn">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
          <p className="text-lg text-gray-600 dark:text-gray-300 font-medium">
            Analizzando la struttura del contenitore...
          </p>
        </div>
      ) : (
        <>
          <div className="text-center space-y-4">
            <h1 className="text-5xl font-extrabold text-[#1a365d] dark:text-orange-300 tracking-tight">
              🚀 LikeSense – GTM AIntelligence
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Carica un file JSON esportato da Google Tag Manager per analizzare i tag, i trigger e le variabili con una dashboard interattiva.
            </p>
          </div>

          <div
            onClick={() => input.current?.click()}
            className="group relative cursor-pointer border-4 border-dashed border-gray-300 dark:border-gray-600 hover:border-orange-400 transition-all duration-300 rounded-2xl p-14 w-full max-w-2xl bg-white dark:bg-gray-800 shadow-md hover:shadow-2xl transform hover:scale-105"
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <UploadCloud className="w-12 h-12 text-orange-500 animate-bounce-slow" />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-200 group-hover:text-orange-600 transition">
                Clicca o trascina qui il file JSON del contenitore GTM
              </p>
            </div>

            <input
              ref={input}
              hidden
              type="file"
              accept="application/json"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        </>
      )}
    </div>
  );
}