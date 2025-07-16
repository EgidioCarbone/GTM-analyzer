// src/pages/PlanPage.tsx

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Loader2, RefreshCcw, Tag, ToggleLeft, Code2 } from "lucide-react";
import { Tab } from "@headlessui/react";
import { motion } from "framer-motion";

import { useContainer } from "../context/ContainerContext";
import { analyzeGtmSection } from "../services/generateMeasurementDoc";
import { renderMeasurementDoc } from "../services/renderMeasurementDoc";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Skeleton } from "../components/ui/Skeleton";

export default function PlanPage() {
  const { container } = useContainer();
  const [preview, setPreview] = useState<{ tags?: string; triggers?: string; variables?: string }>({});
  const [status, setStatus] = useState<{ tags: boolean; triggers: boolean; variables: boolean }>({ tags: false, triggers: false, variables: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("gtmAnalyzerPreview");
    if (saved) {
      setPreview(JSON.parse(saved));
      setStatus({ tags: true, triggers: true, variables: true });
    }
  }, []);

  const cleanMarkdown = (md: string) =>
    md.split("\n").filter((line) => !["Tags Analysis", "Triggers Analysis", "Variables Analysis"].includes(line.trim())).join("\n");

  const Spinner = () => <Loader2 className="h-4 w-4 animate-spin inline-block ml-1" />;

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
        analyzeGtmSection("tags", container.tag ?? [], container.publicId).then((md) => {
          setStatus((s) => ({ ...s, tags: true }));
          return md;
        }),
        analyzeGtmSection("triggers", container.trigger ?? [], container.publicId).then((md) => {
          setStatus((s) => ({ ...s, triggers: true }));
          return md;
        }),
        analyzeGtmSection("variables", container.variable ?? [], container.publicId).then((md) => {
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

      const fullDoc = `# AI-powered GTM Audit\n\n**Progetto:** ${container.publicId ?? "Senza nome"}\n\n${cleaned.tags}\n\n${cleaned.triggers}\n\n${cleaned.variables}`;
      await renderMeasurementDoc(fullDoc, `PianoMisurazione_${container.publicId ?? "SenzaNome"}.docx`);

      toast.success("Documento Word generato!", { id: "plan" });
    } catch (err) {
      console.error(err);
      toast.error("Errore nella generazione del piano.", { id: "plan" });
    } finally {
      setLoading(false);
    }
  };

  const clearPreview = () => {
    localStorage.removeItem("gtmAnalyzerPreview");
    setPreview({});
    setStatus({ tags: false, triggers: false, variables: false });
    toast("Anteprima resettata.", { icon: "✅" });
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen px-6 overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-black">
      <div className="absolute -top-48 -left-48 w-[600px] h-[600px] bg-purple-400 opacity-30 blur-3xl rounded-full z-0"></div>
      <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] bg-pink-400 opacity-30 blur-3xl rounded-full z-0"></div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 flex flex-col items-center text-center gap-4 max-w-2xl"
      >
        <Sparkles className="h-10 w-10 text-purple-500 animate-bounce" />
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-500 text-transparent bg-clip-text drop-shadow-sm">
          AI-Powered GTM Measurement Plan
        </h1>
        <p className="text-gray-700 dark:text-gray-300 text-base md:text-lg max-w-lg leading-relaxed">
          Analizza il tuo container GTM con l'AI, individua criticità e genera un piano di misurazione completo e professionale.
        </p>

        {preview.tags && (
          <div className="bg-yellow-100 text-yellow-800 text-sm px-4 py-2 rounded-md border border-yellow-300 w-full">
            📝 Hai già una <strong>anteprima salvata</strong>. Puoi rigenerare o resettarla.
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center mt-4">

          <Button
            onClick={handleExport}
            disabled={loading}
            className="relative overflow-hidden bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
          >
            <span className="relative z-10 flex items-center gap-2">
              {loading ? (
                <>
                  Generazione in corso… <Spinner />
                </>
              ) : (
                <>
                  Effettua analisi IA <Sparkles className="w-4 h-4" />
                </>
              )}
            </span>
            <div className="absolute inset-0 bg-white opacity-10 blur-sm animate-pulse z-0" />
          </Button>

          <Button
            onClick={clearPreview}
            variant="outline"
            className="border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-100 px-5 py-2 rounded-full transition-colors duration-200"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Resetta anteprima
          </Button>
        </div>
      </motion.div>

      {(preview.tags || preview.triggers || preview.variables) && (
        <div className="mt-12 w-full max-w-4xl animate-fade-in">
          <Tab.Group>
            <Tab.List className="flex justify-center space-x-2 mb-4">
              {[{ label: "Tags", icon: Tag }, { label: "Triggers", icon: ToggleLeft }, { label: "Variables", icon: Code2 }].map((tab) => (
                <Tab
                  key={tab.label}
                  className={({ selected }) =>
                    `px-4 py-2 text-sm font-medium rounded-full flex items-center gap-1 transition-all ${selected ? "bg-purple-600 text-white shadow-md" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`
                  }
                >
                  <tab.icon className="h-4 w-4" /> {tab.label}
                  {loading && !status[tab.label.toLowerCase() as "tags" | "triggers" | "variables"] && <Spinner />}
                  {status[tab.label.toLowerCase() as "tags" | "triggers" | "variables"] && "✅"}
                </Tab>
              ))}
            </Tab.List>
            <Tab.Panels>
              {(["tags", "triggers", "variables"] as const).map((type) => (
                <Tab.Panel key={type}>
                  {preview[type] ? (
                    <ScrollArea>
                      <Card className="bg-white dark:bg-gray-800 shadow-md rounded-xl">
                        <CardContent className="p-4 prose dark:prose-invert max-w-none">
                          <Markdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table: ({ children }) => (
                                <div className="overflow-x-auto rounded-lg border border-gray-300 shadow-sm my-4">
                                  <table className="min-w-full divide-y divide-gray-300 text-sm text-left">{children}</table>
                                </div>
                              ),
                              th: ({ children }) => (
                                <th className="px-4 py-2 bg-gray-100 font-semibold text-gray-700 border-b">{children}</th>
                              ),
                              td: ({ children }) => (
                                <td className="px-4 py-2 border-t border-gray-200 whitespace-pre-wrap">{children}</td>
                              ),
                              tr: ({ children }) => (
                                <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
                              ),
                            }}
                          >
                            {preview[type] ?? ""}
                          </Markdown>
                        </CardContent>
                      </Card>
                    </ScrollArea>
                  ) : (
                    <Skeleton className="h-64 w-full rounded-xl" />
                  )}
                </Tab.Panel>
              ))}
            </Tab.Panels>
          </Tab.Group>
        </div>
      )}
    </div>
  );
}