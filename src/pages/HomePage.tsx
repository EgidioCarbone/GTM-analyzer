import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Brain, TestTube, Shield, ArrowRight, CheckCircle, Upload } from 'lucide-react';
import { useContainer } from '../context/ContainerContext';

// ---------- TIPI ----------
type ColorKey = 'blue' | 'purple' | 'green' | 'red' | 'cyan';

type ColorClasses = {
  header: string;
  icon: string;
  arrow: string;
  dot: string;
  hover: string;
  overlay: string;
};

export interface Tool {
  id: string;
  title: string;
  description: string;
  requiresJson: boolean;
  icon: React.ComponentType<{ className?: string }>;
  color: ColorKey;
  features: string[];
}

type ToolCardProps = {
  tool: Tool;
  onClick: () => void;
};

// Configurazione tools
const tools: Tool[] = [
  {
    id: 'container-manager',
    title: 'GTM Analytics',
    description: 'Analisi completa e gestione container GTM con dashboard integrata',
    requiresJson: true,
    icon: BarChart,
    color: 'blue',
    features: ['Analisi dettagliata', 'Dashboard interattiva', 'Report avanzati']
  },
  {
    id: 'ai-plan',
    title: 'AI Plan',
    description: 'Pianificazione intelligente e strategica con intelligenza artificiale',
    requiresJson: true,
    icon: Brain,
    color: 'purple',
    features: ['Pianificazione AI', 'Strategie personalizzate', 'Raccomandazioni smart']
  },
  {
    id: 'ssd-test',
    title: 'SSD Test',
    description: 'Test automatizzati da documenti PDF con esecuzione browser',
    requiresJson: false,
    icon: TestTube,
    color: 'green',
    features: ['Test automatici', 'Esecuzione browser', 'Report dettagliati']
  },
  {
    id: 'ai-sentinel',
    title: 'AI Sentinel',
    description: 'Test automatico del consenso con Playwright per GDPR/CCPA',
    requiresJson: false,
    icon: CheckCircle,
    color: 'cyan',
    features: ['Test automatici', 'Rilevamento CMP', 'Report dettagliati']
  },
  // 🔹 NUOVA CARD: GA4 Insights
  {
    id: 'ga4-insights',
    title: 'GA4 Insights',
    description: 'KPI, trend e insight con IA dai dati di Google Analytics 4',
    requiresJson: false,
    icon: BarChart,
    color: 'cyan',
    features: ['Utenti, sessioni, pageviews', 'Top canali e pagine', 'Insight generati con IA']
  }
];

// Componente per le card degli strumenti
const ToolCard: React.FC<ToolCardProps> = ({ tool, onClick }) => {
  const Icon = tool.icon;

  // Mappa colori per evitare classi dinamiche
  const colorClasses: Record<ColorKey, ColorClasses> = {
    blue: {
      header: 'bg-gradient-to-r from-blue-50 to-blue-100',
      icon: 'bg-blue-500',
      arrow: 'text-blue-500',
      dot: 'bg-blue-400',
      hover: 'hover:border-blue-300',
      overlay: 'from-blue-500/5'
    },
    purple: {
      header: 'bg-gradient-to-r from-purple-50 to-purple-100',
      icon: 'bg-purple-500',
      arrow: 'text-purple-500',
      dot: 'bg-purple-400',
      hover: 'hover:border-purple-300',
      overlay: 'from-purple-500/5'
    },
    green: {
      header: 'bg-gradient-to-r from-green-50 to-green-100',
      icon: 'bg-green-500',
      arrow: 'text-green-500',
      dot: 'bg-green-400',
      hover: 'hover:border-green-300',
      overlay: 'from-green-500/5'
    },
    red: {
      header: 'bg-gradient-to-r from-red-50 to-red-100',
      icon: 'bg-red-500',
      arrow: 'text-red-500',
      dot: 'bg-red-400',
      hover: 'hover:border-red-300',
      overlay: 'from-red-500/5'
    },
    cyan: {
      header: 'bg-gradient-to-r from-cyan-50 to-cyan-100',
      icon: 'bg-cyan-500',
      arrow: 'text-cyan-500',
      dot: 'bg-cyan-400',
      hover: 'hover:border-cyan-300',
      overlay: 'from-cyan-500/5'
    }
  };

  const colors = colorClasses[tool.color];

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300
        cursor-pointer group border border-gray-200 ${colors.hover}
        overflow-hidden h-full flex flex-col
      `}
    >
      {/* Header con icona e colore */}
      <div className={`${colors.header} p-4`}>
        <div className="flex items-center justify-between">
          <div className={`w-10 h-10 rounded-lg ${colors.icon} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="flex items-center space-x-2">
            {tool.requiresJson ? (
              <div className="flex items-center text-amber-600 text-sm">
                <Upload className="w-4 h-4 mr-1" />
                <span>Richiede JSON</span>
              </div>
            ) : (
              <div className="flex items-center text-green-600 text-sm">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span>Pronto all'uso</span>
              </div>
            )}
            <ArrowRight className={`w-5 h-5 ${colors.arrow} group-hover:translate-x-1 transition-transform`} />
          </div>
        </div>
      </div>

      {/* Contenuto */}
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {tool.title}
        </h3>
        <p className="text-gray-600 mb-3 leading-relaxed flex-grow text-sm">
          {tool.description}
        </p>

        {/* Features */}
        <div className="space-y-1">
          {tool.features.map((feature: string, index: number) => (
            <div key={index} className="flex items-center text-xs text-gray-500">
              <div className={`w-1 h-1 rounded-full ${colors.dot} mr-2`} />
              {feature}
            </div>
          ))}
        </div>
      </div>

      {/* Hover effect */}
      <div className={`absolute inset-0 bg-gradient-to-r ${colors.overlay} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
    </motion.div>
  );
};

export default function HomePage() {
  const navigate = useNavigate();
  const { container, setContainer } = useContainer() as any; // mantiene il tuo context com'è

  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiPlanFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File, mode: 'analytics' | 'plan') => {
    try {
      const json = JSON.parse(await file.text());

      const candidate =
        (json.tag && json.trigger)
          ? json
          : json.containerVersion?.tag
          ? json.containerVersion
          : json.container?.tag
          ? json.container
          : undefined;

      if (!candidate) throw new Error();

      // Estrai ID dal nome del file
      const match = file.name.match(/(GTM-[A-Z0-9]{7})/i);
      const publicId = match ? match[1] : 'GTM-XXXXX';

      // Passa il container con publicId aggiunto
      setContainer({ ...candidate, publicId });

      // Vai alla pagina appropriata con il mode corretto
      if (mode === 'analytics') {
        navigate('/dashboard?mode=analytics');
      } else if (mode === 'plan') {
        navigate('/plan?mode=plan');
      }
    } catch {
      alert('❌ Il file non sembra un JSON valido GTM.');
    }
  };

  const handleToolClick = (tool: Tool) => {
    if (tool.requiresJson && !container) {
      // Se richiede JSON e non c'è, apri file picker
      if (tool.id === 'container-manager') {
        fileInputRef.current?.click();
      } else if (tool.id === 'ai-plan') {
        aiPlanFileInputRef.current?.click();
      } else {
        navigate('/dashboard');
      }
    } else {
      // Vai direttamente allo strumento
      if (tool.id === 'container-manager') {
        navigate('/container-manager?mode=analytics');
      } else if (tool.id === 'ai-plan') {
        navigate('/plan?mode=plan');
      } else if (tool.id === 'ssd-test') {
        navigate('/ssd-test?mode=ssd');
      } else if (tool.id === 'ai-sentinel') {
        navigate('/ai-sentinel?mode=ai-sentinel');
      } else if (tool.id === 'ga4-insights') {
        navigate('/ga4-insights');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 flex flex-col relative overflow-hidden">
      {/* Sfondo dinamico con particelle */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Cerchi animati */}
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 left-20 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        <div className="absolute -bottom-40 right-20 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-6000"></div>

        {/* Particelle fluttuanti */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-purple-400 rounded-full opacity-60 animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 10}s`,
                animationDuration: `${3 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Input file nascosto per GTM Analytics */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, 'analytics');
        }}
        className="hidden"
      />

      {/* Input file nascosto per AI Plan */}
      <input
        ref={aiPlanFileInputRef}
        type="file"
        accept=".json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileUpload(file, 'plan');
        }}
        className="hidden"
      />

      {/* Header Professionale */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center py-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mr-4">
                <BarChart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">LikeSense</h1>
                <p className="text-sm text-gray-500">GTM Intelligence Platform</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
        <div className="w-full">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-6"
            >
              <div className="w-20 h-20 mx-auto bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                <Brain className="w-10 h-10 text-white" />
              </div>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl font-bold text-gray-900 mb-4"
            >
              Choose Your Analytics Tool
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-xl text-gray-600 max-w-3xl mx-auto"
            >
              Select the perfect tool for your GTM analysis needs. Each tool is designed for specific use cases and requirements.
            </motion.p>
          </div>

          {/* Tools Grid - Layout Responsivo Ottimizzato */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-8 items-stretch max-w-8xl mx-auto px-4">
            {tools.map((tool: Tool, index: number) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="flex"
              >
                <ToolCard tool={tool} onClick={() => handleToolClick(tool)} />
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
