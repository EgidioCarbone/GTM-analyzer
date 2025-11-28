import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, RefreshCcw, Tag } from "lucide-react";
import Lottie from "lottie-react";

import { useContainer } from "../context/ContainerContext";
import { buildTagsTable, generateMeasurementDoc } from "../services/generateMeasurementDoc";
import { renderMeasurementDoc } from "../services/renderMeasurementDoc";
import { Card, CardContent } from "../components/ui/card";
import { ScrollArea } from "../components/ui/scroll-area";
import { useLanguage } from "../context/LanguageContext";

import animationData from "../assets/background-ai-loader.json";

function useCyclingTypewriter(texts: string[], speed = 70, hold = 3000): { text: string; step: number } {
  const [step, setStep] = useState(0);
  const [sub, setSub] = useState(0);
  const [text, setText] = useState("");

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (sub < texts[step].length) {
      setText(texts[step].slice(0, sub + 1));
      t = setTimeout(() => setSub(sub + 1), speed);
      return () => clearTimeout(t);
    }
    t = setTimeout(() => {
      setSub(0);
      setStep((s) => (s + 1) % texts.length);
    }, hold);
    return () => clearTimeout(t);
  }, [sub, step, texts, speed, hold]);

  return { text, step };
}

export default function PlanPage() {
  const { container } = useContainer();
  const { t, language } = useLanguage();

  const [preview, setPreview] = useState<{ tags?: string }>({});
  const [loading, setLoading] = useState(false);
  const [contextText, setContextText] = useState("");

  const steps = useMemo(
    () => [
      { label: t("plan.step1.label"), desc: t("plan.step1.desc") },
      { label: t("plan.step2.label"), desc: t("plan.step2.desc") },
      { label: t("plan.step3.label"), desc: t("plan.step3.desc") },
    ],
    [t]
  );

  const { text: typing } = useCyclingTypewriter(steps.map((s) => s.label), 70, 3000);
  const CurrentIcon = Loader2;

  useEffect(() => {
    const saved = localStorage.getItem("gtmAnalyzerPreview");
    if (saved) {
      const parsed = JSON.parse(saved);
      setPreview({ tags: parsed.tags });
    }
    const ctx = localStorage.getItem("gtmAnalyzerContext");
    if (ctx) setContextText(ctx);
  }, []);

  const clean = (md: string) => {
    const lines = md.split("\n");
    const headerRe = /^#{0,6}\s*(Tags|Triggers|Variables) Analysis\s*$/i;
    return lines.filter((l) => !headerRe.test(l.trim())).join("\n");
  };

  const Spinner = () => <Loader2 className="h-4 w-4 animate-spin inline-block ml-1" />;

  const handleExport = async () => {
    if (!container) return toast.error(t("plan.error.noContainer"));
    setLoading(true);
    toast.loading(t("plan.toast.analyzing"), { id: "plan" });

    try {
      const tagsMd = await buildTagsTable(container.tag ?? [], container.trigger ?? []);
      const cleaned = { tags: clean(tagsMd) };
      setPreview(cleaned);
      localStorage.setItem("gtmAnalyzerPreview", JSON.stringify(cleaned));

      const doc = await generateMeasurementDoc({
        tags: container.tag ?? [],
        triggers: container.trigger ?? [],
        variables: container.variable ?? [],
        projectName: container.publicId,
        contextText,
        language,
      });

      await renderMeasurementDoc(doc, `PianoMisurazione_${container.publicId ?? "SenzaNome"}.docx`);
      toast.success(t("plan.success.doc"), { id: "plan" });
    } catch (e) {
      console.error(e);
      toast.error(t("plan.error.generate"), { id: "plan" });
    } finally {
      setLoading(false);
      try {
        toast.dismiss("plan");
      } catch {}
    }
  };

  const clearPreview = () => {
    localStorage.removeItem("gtmAnalyzerPreview");
    setPreview({});
    toast(t("plan.toast.reset"), { icon: "i" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 relative overflow-hidden py-12 px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-32 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-40" />
        <div className="absolute -bottom-48 -right-20 w-[430px] h-[430px] bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-35" />
      </div>

      {loading && (
        <div className="fixed inset-0 z-50 bg-white/70 flex items-center justify-center">
          <div className="relative flex flex-col items-center bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-md">
            <div className="w-56">
              <Lottie animationData={animationData} loop autoplay />
            </div>
            <div className="flex items-center justify-center gap-2 mt-2 text-gray-800 text-sm font-semibold">
              <CurrentIcon className="w-4 h-4 text-gray-700 shrink-0 animate-spin" />
              <p className="min-h-[1.5rem]">{typing || t("plan.loading.default")}</p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto relative z-10 flex flex-col space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-white/80 shadow-sm text-purple-600 text-sm font-medium">
            <Tag className="w-4 h-4" />
            {t("plan.badge")}
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold text-slate-900">{t("plan.title")}</h1>
          <p className="text-slate-600 text-base md:text-lg max-w-3xl mx-auto">{t("plan.subtitle")}</p>
        </div>

        <div className="max-w-5xl w-full mx-auto">
          <div className="bg-white/80 backdrop-blur border border-white/60 rounded-3xl shadow-2xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">{t("plan.context.label")}</label>
              <textarea
                value={contextText}
                onChange={(e) => {
                  setContextText(e.target.value);
                  localStorage.setItem("gtmAnalyzerContext", e.target.value);
                }}
                placeholder={t("plan.context.placeholder")}
                className="w-full min-h-[200px] p-4 rounded-2xl border border-gray-200 bg-white/70 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-200 shadow-inner"
              />
            </div>

            {preview.tags && (
              <div className="flex items-start gap-3 bg-amber-50 text-amber-800 text-sm px-4 py-3 rounded-2xl border border-amber-200 shadow-sm">
                <span className="mt-0.5 font-bold">!</span>
                <div>{t("plan.preview.notice")}</div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={clearPreview}
                className="px-4 py-2 rounded-full border border-purple-200 text-sm font-semibold text-purple-700 bg-white hover:bg-purple-50 transition shadow-sm"
              >
                <RefreshCcw className="inline-block mr-2 h-4 w-4 align-middle" />
                {t("plan.reset")}
              </button>
              <button
                onClick={handleExport}
                disabled={loading}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-sm font-semibold shadow-lg shadow-purple-200/80 hover:opacity-95 disabled:opacity-60 transition"
              >
                {loading ? (
                  <>
                    {t("plan.generating")} <Spinner />
                  </>
                ) : (
                  t("plan.generate")
                )}
              </button>
            </div>
          </div>
        </div>

        {preview.tags && (
          <div className="w-full">
            <ScrollArea>
              <Card className="bg-white/90 backdrop-blur shadow-xl rounded-3xl border border-white/60">
                <CardContent className="p-4 prose max-w-none">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-sm my-4 bg-white/80">
                          <table className="min-w-full divide-y divide-gray-200 text-sm text-left">{children}</table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="px-4 py-2 bg-gray-100 font-semibold text-slate-700 border-b border-gray-200">{children}</th>
                      ),
                      td: ({ children }) => <td className="px-4 py-2 border-t border-gray-200 whitespace-pre-wrap">{children}</td>,
                      tr: ({ children }) => <tr className="hover:bg-gray-50 transition-colors">{children}</tr>,
                    }}
                  >
                    {preview.tags ?? ""}
                  </Markdown>
                </CardContent>
              </Card>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}
