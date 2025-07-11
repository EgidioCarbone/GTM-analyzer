import React from "react";
import FileUpload from "../components/FileUpload";
import Dashboard from "../components/Dashboard";
import { useContainer } from "../context/ContainerContext";

export default function DashboardPage() {
  const { container, setContainer } = useContainer();

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
  } catch {
    alert("❌ Il file non sembra un JSON valido GTM.");
  }
};


  return (
    <main className={`p-6 space-y-6 ${!container ? "flex items-center justify-center h-full" : ""}`}>
      {!container ? (
        <div className="max-w-2xl w-full"> {/* aumentata la larghezza */}
          <FileUpload onFile={handleFile} />
        </div>
      ) : (
        <Dashboard data={container} onReplace={() => setContainer(null)} />
      )}
    </main>
  );
}