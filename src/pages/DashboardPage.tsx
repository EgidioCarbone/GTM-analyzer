import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import FileUpload from "../components/FileUpload";
import Dashboard from "../components/Dashboard";
import { useContainer } from "../context/ContainerContext";

export default function DashboardPage() {
  const { container, setContainer } = useContainer();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Controlla se siamo in modalità analytics
  const isAnalyticsMode = new URLSearchParams(location.search).get('mode') === 'analytics';

  const handleFile = async (file: File) => {
  try {
    const json = JSON.parse(await file.text());

    const candidate =
      json.tag && json.trigger
        ? json
        : json.containerVersion?.tag
        ? json.containerVersion
        : json.container?.tag
        ? json.container
        : undefined;

    if (!candidate) throw new Error();

    // Estrai ID dal nome del file
    const match = file.name.match(/(GTM-[A-Z0-9]{7})/i);
    const publicId = match ? match[1] : "GTM-XXXXX";

    // Passa il container con publicId aggiunto
    setContainer({ ...candidate, publicId });
    
    // Non serve reindirizzare, la pagina si aggiorna automaticamente
    // perché container è ora disponibile e mostra la Dashboard
  } catch {
    alert("❌ Il file non sembra un JSON valido GTM.");
  }
};


  return (
    <main className={`${!container ? "min-h-screen" : "p-6 space-y-6"}`}>
      {!container ? (
        <div className="w-full">
          <FileUpload onFile={handleFile} />
        </div>
      ) : (
        <Dashboard />
      )}
    </main>
  );
}