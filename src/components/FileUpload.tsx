import React, { useRef, useState, useEffect } from "react";
import { 
  UploadCloud, 
  Loader2, 
  BarChart3, 
  Zap, 
  Target, 
  Brain, 
  TrendingUp, 
  Shield, 
  FileText, 
  Globe,
  CheckCircle,
  ArrowRight,
  Play,
  Sparkles
} from "lucide-react";

export default function FileUpload({ onFile }: { onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleFile = (file: File) => {
    setLoading(true);
    setTimeout(() => {
      onFile(file);
    }, 800);
  };

  const features = [
    {
      icon: BarChart3,
      title: "Dashboard Intelligente",
      description: "Score di qualità, KPI e metriche dettagliate del tuo container GTM",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: Brain,
      title: "Analisi Automatica AI",
      description: "Identifica tag obsoleti, elementi in pausa e configurazioni non utilizzate",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Target,
      title: "Piano d'Azione",
      description: "Ricevi raccomandazioni prioritarie per ottimizzare il tuo GTM",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: Zap,
      title: "Container Manager",
      description: "Gestisci tag, trigger e variabili con interfaccia avanzata",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: Globe,
      title: "Website Checklist",
      description: "Analizza SEO, performance e accessibilità dei tuoi siti",
      color: "from-indigo-500 to-blue-500"
    },
    {
      icon: FileText,
      title: "Report & Export",
      description: "Genera documenti di misurazione e report dettagliati",
      color: "from-teal-500 to-green-500"
    }
  ];

  const benefits = [
    "🎯 Identifica automaticamente tag UA obsoleti da migrare a GA4",
    "⚡ Trova trigger e variabili non utilizzati che appesantiscono il container",
    "📊 Calcola score di qualità basato su pulizia e efficienza",
    "🧠 Suggerimenti AI per naming e standardizzazione",
    "🚀 Piano d'azione prioritario con stima dell'impatto",
    "💡 Insights educativi per migliorare le best practice"
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] animate-fadeIn space-y-6">
        <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
        <p className="text-lg text-gray-600 dark:text-gray-300 font-medium">
          Analizzando la struttura del contenitore...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-black py-20 w-full">
        {/* Background Elements - Semplificati e ottimizzati */}
        {/* Commentati per uno sfondo più pulito - decommentare se si vogliono effetti decorativi */}
        {/* <div className="absolute -top-48 -left-48 w-[600px] h-[600px] bg-purple-400 opacity-20 blur-3xl rounded-full" />
        <div className="absolute -bottom-48 -right-48 w-[600px] h-[600px] bg-pink-400 opacity-20 blur-3xl rounded-full" /> */}
        
        <div className="relative z-10 w-full px-6 text-center">
          {/* Main Heading */}
          <div className={`mb-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-full text-purple-700 dark:text-purple-300 text-sm font-medium mb-6 animate-scaleIn">
              <Sparkles className="w-4 h-4" />
              Powered by Artificial Intelligence
            </div>
            
            <h1 className="text-6xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 dark:from-purple-400 dark:via-pink-400 dark:to-orange-400 tracking-tight mb-6">
              🚀 LikeSense
            </h1>
            
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              GTM AIntelligence
            </h2>
            
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
              Trasforma il tuo Google Tag Manager in un sistema intelligente e ottimizzato. 
              Analizza, ottimizza e gestisci i tuoi container con l'intelligenza artificiale.
            </p>
          </div>

          {/* CTA Section */}
          <div className={`mb-16 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-2xl mx-auto border border-gray-200 dark:border-gray-700 hover-lift">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                Inizia subito l'analisi
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Carica il file JSON del tuo container GTM e ottieni insights dettagliati in pochi secondi
              </p>
              
              <div
                onClick={() => input.current?.click()}
                className="group relative cursor-pointer border-4 border-dashed border-gray-300 dark:border-gray-600 hover:border-orange-400 transition-all duration-300 rounded-xl p-8 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 hover:shadow-lg transform hover:scale-105 animate-pulse-glow"
              >
                <div className="flex flex-col items-center justify-center space-y-4">
                  <UploadCloud className="w-16 h-16 text-orange-500 animate-bounce" />
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-200 group-hover:text-orange-600 transition">
                    Clicca o trascina qui il file JSON del contenitore GTM
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Supporta file .json esportati da Google Tag Manager
                  </p>
                </div>
              </div>
              
              <input
                ref={input}
                hidden
                type="file"
                accept="application/json"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover-lift">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">100%</div>
              <div className="text-gray-600 dark:text-gray-300">Analisi Automatica</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover-lift">
              <div className="text-3xl font-bold text-pink-600 dark:text-pink-400 mb-2">AI-Powered</div>
              <div className="text-gray-600 dark:text-gray-300">Insights Intelligenti</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover-lift">
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">Real-time</div>
              <div className="text-gray-600 dark:text-gray-300">Metriche Live</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-gray-900 w-full">
        <div className="w-full px-6">
          <div className={`text-center mb-16 transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Potenza dell'Intelligenza Artificiale
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              LikeSense utilizza algoritmi avanzati e AI per trasformare la gestione del tuo GTM
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`group bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 hover-lift transition-all duration-1000 delay-${(index + 1) * 100} ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
              >
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${feature.color} text-white mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 w-full">
        <div className="w-full px-6">
          <div className={`text-center mb-16 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Cosa puoi ottenere
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Scopri i benefici concreti dell'utilizzo di LikeSense per il tuo GTM
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className={`transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
              <div className="space-y-6">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-4 animate-fadeInUp" style={{ animationDelay: `${index * 0.1}s` }}>
                    <CheckCircle className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                    <p className="text-lg text-gray-700 dark:text-gray-300">
                      {benefit}
                    </p>
                  </div>
                ))}
              </div>
              
              <div className="mt-8">
                <button
                  onClick={() => input.current?.click()}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl animate-pulse-glow"
                >
                  <Play className="w-5 h-5" />
                  Inizia l'analisi gratuita
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className={`bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 hover-lift transition-all duration-1000 delay-700 ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Processo in 4 step
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4 animate-fadeInRight" style={{ animationDelay: '0.1s' }}>
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center font-bold text-lg">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">Carica Container</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">File JSON esportato da GTM</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 animate-fadeInRight" style={{ animationDelay: '0.2s' }}>
                  <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-full flex items-center justify-center font-bold text-lg">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">Analisi AI</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Calcolo automatico delle metriche</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 animate-fadeInRight" style={{ animationDelay: '0.3s' }}>
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center font-bold text-lg">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">Dashboard</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Insights dettagliati e KPI</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 animate-fadeInRight" style={{ animationDelay: '0.4s' }}>
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center font-bold text-lg">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">Ottimizza</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Segui le raccomandazioni AI</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 w-full">
        <div className="w-full px-6 text-center">
          <div className={`transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <h2 className="text-4xl font-bold text-white mb-6">
              Pronto a trasformare il tuo GTM?
            </h2>
            <p className="text-xl text-purple-100 mb-8">
              Unisci l'analisi automatica all'intelligenza artificiale per ottenere il massimo dal tuo Google Tag Manager
            </p>
            
            <button
              onClick={() => input.current?.click()}
              className="inline-flex items-center gap-3 px-10 py-5 bg-white text-purple-600 font-bold rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl animate-pulse-glow"
            >
              <UploadCloud className="w-6 h-6" />
              Inizia ora l'analisi
              <ArrowRight className="w-6 h-6" />
            </button>
            
            <p className="text-purple-200 mt-4 text-sm">
              Nessuna registrazione richiesta • Analisi istantanea • Risultati dettagliati
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}