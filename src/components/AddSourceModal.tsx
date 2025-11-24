import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SourceCard, SourceItem } from "./SourceCard";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelectSource: (id: string) => void;
};

const SHEET_ICON = (
  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="4" width="28" height="40" rx="4" fill="#0F9D58" />
    <rect x="16" y="12" width="16" height="4" fill="white" />
    <rect x="16" y="20" width="16" height="4" fill="white" />
    <rect x="16" y="28" width="16" height="4" fill="white" />
  </svg>
);

const GA4_ICON = (
  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="24" width="6" height="16" rx="3" fill="#F9AB00" />
    <rect x="20" y="14" width="6" height="26" rx="3" fill="#F9AB00" />
    <rect x="32" y="8" width="6" height="32" rx="3" fill="#F9AB00" />
  </svg>
);

const SUPABASE_ICON = (
  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M26 6c0-.8-.9-1.2-1.5-.7L8.7 21.1c-.6.5-.2 1.5.6 1.5H22v19c0 .8.9 1.2 1.5.7l15.8-15.7c.6-.5.2-1.5-.6-1.5H26V6Z" fill="#3ECF8E"/>
  </svg>
);

const POSTGRES_ICON = (
  <svg width="40" height="40" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
    <path d="M64 9c-9 0-17 5-22 11-10 11-11 27-10 41 1 13 6 28 17 36 6 4 13 5 19 2 7 3 14 2 20-3 14-11 17-33 15-49-1-12-6-23-16-30C82 11 73 9 64 9Z" fill="#336791"/>
    <path d="M63 33c-6 0-11 5-11 11s5 11 11 11c7 0 12-5 12-11s-5-11-12-11Z" fill="#fff"/>
  </svg>
);

const KLAVIYO_ICON = (
  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 24c6-6 12-9 18-9s12 3 18 9c-6 6-12 9-18 9S12 30 6 24Z" fill="#00A86B"/>
    <circle cx="24" cy="24" r="4" fill="#fff"/>
  </svg>
);

const SHOPIFY_ICON = (
  <svg width="40" height="40" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <path d="M64 40 48 224l144 16 16-176Z" fill="#95BF47"/>
    <path d="m120 64 56-8-6 152-56-8Z" fill="#5E8E3E"/>
  </svg>
);

const META_ICON = (
  <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="20" fill="#1877F2" />
    <path d="M27 22c-1.1-2-2.2-3-3.4-3-2.3 0-4.6 3.5-6.6 10.5l-1.8-5.1c-.3-1-.6-1.9-.9-2.7C13.7 20 15.2 18 17.5 18c1.7 0 3.1 1.1 4.7 3.4C23.7 19.1 25.1 18 26.9 18c2.7 0 4.6 2.2 4.6 5.8 0 1.4-.3 3-.8 4.6-.9 3.1-2.4 5.2-4.1 5.2-1.2 0-2.1-.8-3.1-2.5L22 23.6l1.8 5.1c.7 1.9 1.3 3.3 2 3.3 1.1 0 2.4-1.9 3.2-4.7.4-1.2.6-2.4.6-3.4C29.6 22.5 28.6 21.7 27 22Z" fill="white"/>
  </svg>
);

const GOOGLE_ADS_ICON = (
  <svg width="40" height="40" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 36c0 3.3-2.7 6-6 6s-6-2.7-6-6 2.7-6 6-6 6 2.7 6 6Z" fill="#34A853"/>
    <path d="M17 6c0-2.2 1.8-4 4-4 1.6 0 3 1 3.7 2.5l12 29.5c.8 2-.2 4.4-2.2 5.2-2 .8-4.4-.2-5.2-2.2L17.7 11.5c-.2-.5-.4-1-.4-1.5V6Z" fill="#4285F4"/>
    <path d="M30 18.5c0-3 2.5-5.5 5.5-5.5 1.7 0 3.2.8 4.3 2L26 38.7l-4-10 8-10.2Z" fill="#FBBC04"/>
  </svg>
);

export const SOURCE_LIST: SourceItem[] = [
  {
    id: "sheets",
    name: "Google Sheets",
    description: "Connect your Google Sheets and chat with your data using natural language.",
    icon: SHEET_ICON,
  },
  {
    id: "ga4",
    name: "Google Analytics 4 (GA4)",
    description: "Track website and app traffic, user behavior, and conversions for insights.",
    icon: GA4_ICON,
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Connect your Supabase database. This grants the AI agent direct access.",
    icon: SUPABASE_ICON,
  },
  {
    id: "postgres",
    name: "Postgres",
    description: "",
    icon: POSTGRES_ICON,
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    description: "",
    icon: KLAVIYO_ICON,
  },
  {
    id: "shopify",
    name: "Shopify",
    description: "",
    icon: SHOPIFY_ICON,
  },
  {
    id: "meta-ads",
    name: "Meta Ads",
    description: "Connect your Facebook Ads account and analyze ad performance.",
    icon: META_ICON,
  },
  {
    id: "google-ads",
    name: "Google Ads",
    description: "Track your Google Ads data and import it for actionable insights.",
    icon: GOOGLE_ADS_ICON,
  },
];

export function AddSourceModal({ isOpen, onClose, onSelectSource }: Props) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", onKey);
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return SOURCE_LIST.filter((s) => s.name.toLowerCase().includes(term));
  }, [search]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-3xl shadow-xl border border-gray-200 p-6 md:p-8 animate-[fadeIn_150ms_ease,slideUp_200ms_ease]">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-semibold text-gray-900">Create a new source</h2>
              <p className="text-lg text-gray-600 mt-1">Select a source to get started.</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-xl leading-none px-2"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-orange-200">
              <span className="text-gray-500">🔍</span>
              <input
                className="w-full outline-none text-sm text-gray-800 placeholder-gray-400"
                placeholder="Search sources"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((source) => (
              <SourceCard key={source.id} source={source} onSelect={onSelectSource} />
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// CTA example (place in any component):
// const [open, setOpen] = useState(false);
// <button
//   onClick={() => setOpen(true)}
//   className="px-3 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium"
// >
//   Add a source
// </button>
// <AddSourceModal
//   isOpen={open}
//   onClose={() => setOpen(false)}
//   onSelectSource={(id) => {
//     console.log("Selected source", id);
//     setOpen(false);
//   }}
// />

// Tailwind keyframes (if not already present):
// @layer utilities {
//   @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
//   @keyframes slideUp { from { transform: translateY(8px); } to { transform: translateY(0); } }
// }
