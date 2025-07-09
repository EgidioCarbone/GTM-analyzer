import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Loader2, RefreshCcw } from "lucide-react";
import { Tab } from "@headlessui/react";

import { useContainer } from "../context/ContainerContext";
import { analyzeGtmSection } from "../services/generateMeasurementDoc";
import { renderMeasurementDoc } from "../services/renderMeasurementDoc";

/* componenti UI locali (no alias) */
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";

export default function PlanPage() {
  const { container } = useContainer();

  const [preview, setPreview] = useState<{
    tags?: string;
    triggers?: string;
    variables?: string;
  }>({});

  const [status, setStatus] = useState<{
    tags: boolean;
    triggers: boolean;
    variables: boolean;
  }>({ tags: false, triggers: false, variables: false });

  const [loading, setLoading] = useState(false);

  /* restore da localStorage */
  useEffect(() => {
    const saved = localStorage.getItem("gtmAnalyzerPreview");
    if (saved) {
      setPreview(JSON.parse(saved));
      setStatus({ tags: true, triggers: true, variables: true });
    }
  }, []);

  /* pulizia markdown (rimuove intestazioni duplicate) */
  const cleanMarkdown = (md: string) =>
    md
      .split("\n")
      .filter(
        (l) =>
          !["Tags Analysis", "Triggers Analysis", "Variables Analysis"].includes(
            l.trim()
          )
      )
      .join("\n");

  const Spinner = () => (
    <Loader2 className="h-4 w-4 animate-spin inline-block ml-1" />
  );

  /* rigenera piano */
  const handleExport = async () => {
    if (!container) {
      toast.error("Carica prima un container GTM!");
      return;
    }
    setLoading(true);
    setStatus({ tags: false, triggers: false, variables: false });
    toast.loading("Analisi AI in corso…", { id: "plan" });

    try {
      const [tagsMd, triggersMd, variablesMd] = await Promise.all([
        analyzeGtmSection("tags", container.tag ?? [], container.publicId).then(
          (md) => {
            setStatus((s) => ({ ...s, tags: true }));
            return md;
          }
        ),
        analyzeGtmSection(
          "triggers",
          container.trigger ?? [],
          container.publicId
        ).then((md) => {
          setStatus((s) => ({ ...s, triggers: true }));
          return md;
        }),
        analyzeGtmSection(
          "variables",
          container.variable ?? [],
          container.publicId
        ).then((md) => {
          setStatus((s) => ({ ...s, variables: true }));
          return md;
        }),
      ]);

      const cleaned = {
        tags: cleanMarkdown(tagsMd),
        triggers: cleanMarkdown(triggersMd),
        variables: cleanMarkdown(variablesMd),
      };

      setPreview(cleaned);
      localStorage.setItem("gtmAnalyzerPreview", JSON.stringify(cleaned));

      const fullDoc = `
# AI-powered GTM Audit

**Progetto:** ${container.publicId ?? "Senza nome"}

${cleaned.tags}

${cleaned.triggers}

${cleaned.variables}
      `;

      await renderMeasurementDoc(
        fullDoc,
        `PianoMisurazione_${container.publicId ?? "SenzaNome"}.docx`
      );
      toast.success("Documento Word generato!", { id: "plan" });
    } catch (err) {
      console.error(err);
      toast.error("Errore nella generazione del piano.", { id: "plan" });
    } finally {
      setLoading(false);
    }
  };

  /* reset anteprima */
  const clearPreview = () => {
    localStorage.removeItem("gtmAnalyzerPreview");
    setPreview({});
    setStatus({ tags: false, triggers: false, variables: false });
    toast("Anteprima resettata.", { icon: "✅" });
  };

  /* ----------------------------------------------------- */
  return (
    <div className="p-6 flex flex-col gap-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Sparkles className="text-blue-500" />
        Generazione Piano di Misurazione AI
      </h1>

      <p className="text-gray-600">
        Analizza il container GTM con l'intelligenza artificiale, identifica
        criticità e genera un documento professionale da consegnare.
      </p>

      <div className="flex gap-4">
        <Button onClick={handleExport} disabled={loading}>
          {loading ? (
            <>
              Generazione in corso…
              <Spinner />
            </>
          ) : (
            <>
              Genera documento Word
              <Sparkles className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>

        <Button onClick={clearPreview} variant="outline">
          <RefreshCcw className="mr-2 h-4 w-4" /> Resetta anteprima
        </Button>
      </div>

      {(preview.tags || preview.triggers || preview.variables) && (
        <Tab.Group>
          <Tab.List className="flex space-x-2 border-b">
            {["Tags", "Triggers", "Variables"].map((tab) => (
              <Tab
                key={tab}
                className={({ selected }) =>
                  `px-4 py-2 text-sm font-medium rounded-t-md ${
                    selected
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                  } transition`
                }
              >
                {tab}
                {loading &&
                  !status[tab.toLowerCase() as "tags" | "triggers" | "variables"] && (
                    <Spinner />
                  )}
                {status[tab.toLowerCase() as "tags" | "triggers" | "variables"] &&
                  " ✅"}
              </Tab>
            ))}
          </Tab.List>

          <Tab.Panels className="animate-fade-in">
            {(["tags", "triggers", "variables"] as const).map((type) => (
              <Tab.Panel key={type}>
                {preview[type] ? (
                  <ScrollArea>
                    <Card>
                      <CardContent className="prose max-w-none">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {preview[type] ?? ""}
                        </Markdown>
                      </CardContent>
                    </Card>
                  </ScrollArea>
                ) : (
                  <p className="text-gray-500">
                    Nessuna anteprima disponibile.
                  </p>
                )}
              </Tab.Panel>
            ))}
          </Tab.Panels>
        </Tab.Group>
      )}
    </div>
  );
}