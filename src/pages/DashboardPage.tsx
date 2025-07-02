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
      setContainer(candidate);
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