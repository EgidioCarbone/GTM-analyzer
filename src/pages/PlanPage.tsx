// src/pages/PlanPage.tsx

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles, Loader2, RefreshCcw, Tag, ToggleLeft, Code2 } from "lucide-react";
import { Tab } from "@headlessui/react";

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

  const cleanMarkdown = (md: string) => md.split("\n").filter(line => !["Tags Analysis", "Triggers Analysis", "Variables Analysis"].includes(line.trim())).join("\n");
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
        analyzeGtmSection("tags", container.tag ?? [], container.publicId).then(md => { setStatus(s => ({ ...s, tags: true })); return md; }),
        analyzeGtmSection("triggers", container.trigger ?? [], container.publicId).then(md => { setStatus(s => ({ ...s, triggers: true })); return md; }),
        analyzeGtmSection("variables", container.variable ?? [], container.publicId).then(md => { setStatus(s => ({ ...s, variables: true })); return md; })
      ]);

      const cleaned = {
        tags: cleanMarkdown(tagsMd),
        triggers: cleanMarkdown(triggersMd),
        variables: cleanMarkdown(variablesMd)
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 p-6">
      <div className="flex flex-col items-center text-center gap-4 max-w-2xl">
        <Sparkles className="h-10 w-10 text-purple-500 animate-pulse" />
        <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-purple-500 to-pink-500 text-transparent bg-clip-text">AI-Powered GTM Measurement Plan</h1>
        <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base">Analizza automaticamente il tuo container GTM con l'intelligenza artificiale, identifica criticità e genera un piano di misurazione professionale pronto da consegnare.</p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={handleExport} disabled={loading} className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90">
            {loading ? <>Generazione in corso… <Spinner /></> : <>Genera documento Word <Sparkles className="ml-2 h-4 w-4" /></>}
          </Button>
          <Button onClick={clearPreview} variant="outline">
            <RefreshCcw className="mr-2 h-4 w-4" /> Resetta anteprima
          </Button>
        </div>
      </div>

      {(preview.tags || preview.triggers || preview.variables) ? (
        <div className="mt-8 w-full max-w-4xl animate-fade-in">
          <Tab.Group>
            <Tab.List className="flex justify-center space-x-2 mb-4">
              {[{ label: "Tags", icon: Tag }, { label: "Triggers", icon: ToggleLeft }, { label: "Variables", icon: Code2 }].map(tab => (
                <Tab key={tab.label} className={({ selected }) => `px-4 py-2 text-sm font-medium rounded-full flex items-center gap-1 ${selected ? "bg-purple-600 text-white shadow" : "bg-gray-200 text-gray-800 hover:bg-gray-300"}`}>
                  <tab.icon className="h-4 w-4" /> {tab.label}
                  {loading && !status[tab.label.toLowerCase() as "tags" | "triggers" | "variables"] && <Spinner />}
                  {status[tab.label.toLowerCase() as "tags" | "triggers" | "variables"] && "✅"}
                </Tab>
              ))}
            </Tab.List>
            <Tab.Panels>
              {(["tags", "triggers", "variables"] as const).map(type => (
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
        <table className="min-w-full divide-y divide-gray-300 text-sm text-left">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 bg-gray-100 font-semibold text-gray-700 border-b">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 border-t border-gray-200 whitespace-pre-wrap">
        {children}
      </td>
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
      ) : null}
    </div>
  );
}