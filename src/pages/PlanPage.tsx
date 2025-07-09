import { useState } from "react";
import toast from "react-hot-toast";
import Markdown from "react-markdown";
import { Tab } from "@headlessui/react";
import remarkGfm from "remark-gfm";
import { Loader2, Sparkles } from "lucide-react";
import { useContainer } from "../context/ContainerContext";
import { analyzeGtmSection } from "../services/generateMeasurementDoc";
import { renderMeasurementDoc } from "../services/renderMeasurementDoc";

export default function PlanPage() {
  const { container } = useContainer();
  const [preview, setPreview] = useState<{ tags?: string; triggers?: string; variables?: string }>({});
  const [status, setStatus] = useState<{ tags: boolean; triggers: boolean; variables: boolean }>({
    tags: false,
    triggers: false,
    variables: false,
  });
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!container) {
      toast.error("Carica prima un container GTM!");
      return;
    }
    setLoading(true);
    setStatus({ tags: false, triggers: false, variables: false });
    toast.loading("Analisi in corso con l'AI…", { id: "plan" });

    try {
      const [tagsMd, triggersMd, variablesMd] = await Promise.all([
        analyzeGtmSection("tags", container.tag ?? [], container.publicId).then((md) => {
          setPreview((p) => ({ ...p, tags: md }));
          setStatus((s) => ({ ...s, tags: true }));
          return md;
        }),
        analyzeGtmSection("triggers", container.trigger ?? [], container.publicId).then((md) => {
          setPreview((p) => ({ ...p, triggers: md }));
          setStatus((s) => ({ ...s, triggers: true }));
          return md;
        }),
        analyzeGtmSection("variables", container.variable ?? [], container.publicId).then((md) => {
          setPreview((p) => ({ ...p, variables: md }));
          setStatus((s) => ({ ...s, variables: true }));
          return md;
        }),
      ]);

      const fullDoc = `
# AI-powered GTM Audit

**Progetto:** ${container.publicId ?? "Senza nome"}

${tagsMd}

${triggersMd}

${variablesMd}
      `;
      await renderMeasurementDoc(fullDoc, `PianoMisurazione_${container.publicId ?? "SenzaNome"}.docx`);
      toast.success("Documento Word generato con successo!", { id: "plan" });
    } catch (error) {
      console.error(error);
      toast.error("Errore durante la generazione del documento.", { id: "plan" });
    } finally {
      setLoading(false);
    }
  };

  const Spinner = () => <Loader2 className="h-4 w-4 animate-spin inline-block ml-1" />;

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Sparkles className="text-blue-500" />
        Generazione Piano di Misurazione AI
      </h1>
      <p className="text-gray-600">Analizza automaticamente il container GTM con il supporto dell'AI e genera un documento professionale da consegnare al cliente.</p>

      <button
        onClick={handleExport}
        disabled={loading}
        className={`px-4 py-2 rounded-md font-semibold text-white transition ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
      >
        {loading ? "Analisi in corso…" : "Genera Documento Word con AI"}
      </button>

      {(preview.tags || preview.triggers || preview.variables) && (
        <Tab.Group>
          <Tab.List className="flex space-x-2 border-b">
            {["Tags", "Triggers", "Variables"].map((tab) => (
              <Tab
                key={tab}
                className={({ selected }) =>
                  `px-4 py-2 text-sm font-medium rounded-t-md ${selected ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  } transition`
                }
              >
                {tab}
                {loading && !status[tab.toLowerCase() as "tags" | "triggers" | "variables"] && <Spinner />}
                {status[tab.toLowerCase() as "tags" | "triggers" | "variables"] && " ✅"}
              </Tab>
            ))}
          </Tab.List>
          <Tab.Panels className="bg-white rounded-b-md p-4 shadow-md animate-fade-in">
            <Tab.Panel>
              {preview.tags ? (
                <div className="prose max-w-none">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {preview.tags}
                  </Markdown>
                </div>
              ) : (
                <p className="text-gray-500">Nessuna anteprima disponibile.</p>
              )}
            </Tab.Panel>
            <Tab.Panel>
              {preview.triggers ? (
                <div className="prose max-w-none">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {preview.triggers}
                  </Markdown>
                </div>
              ) : (
                <p className="text-gray-500">Nessuna anteprima disponibile.</p>
              )}
            </Tab.Panel>
            <Tab.Panel>
              {preview.variables ? (
                <div className="prose max-w-none">
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {preview.variables}
                  </Markdown>
                </div>
              ) : (
                <p className="text-gray-500">Nessuna anteprima disponibile.</p>
              )}
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      )}
    </div>
  );
}