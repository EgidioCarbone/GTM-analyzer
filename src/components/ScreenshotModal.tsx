import React from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScreenshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenshots: string[];
  currentIndex: number;
  onPrevious: () => void;
  onNext: () => void;
  onThumbnailClick?: (index: number) => void;
}

export default function ScreenshotModal({
  isOpen,
  onClose,
  screenshots,
  currentIndex,
  onPrevious,
  onNext,
  onThumbnailClick
}: ScreenshotModalProps) {
  if (!isOpen || screenshots.length === 0) return null;

  const currentScreenshot = screenshots[currentIndex];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative max-w-6xl max-h-[90vh] w-full bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {screenshots.length === 1 ? '🍪 Banner dei Cookie' : `Screenshot ${currentIndex + 1} di ${screenshots.length}`}
              </h3>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Image Container */}
            <div className="relative p-4">
              <div className="relative max-h-[70vh] overflow-hidden rounded-lg">
                <img
                  src={`data:image/png;base64,${currentScreenshot}`}
                  alt={screenshots.length === 1 ? '🍪 Banner dei Cookie' : `Screenshot ${currentIndex + 1}`}
                  className="w-full h-auto max-h-[70vh] object-contain mx-auto"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'flex items-center justify-center h-64 bg-gray-100 dark:bg-gray-800 rounded-lg';
                    errorDiv.innerHTML = `
                      <div class="text-center text-gray-500 dark:text-gray-400">
                        <div class="text-4xl mb-2">📷</div>
                        <div>Errore nel caricamento dell'immagine</div>
                      </div>
                    `;
                    target.parentNode?.insertBefore(errorDiv, target);
                  }}
                />
              </div>

              {/* Navigation */}
              {screenshots.length > 1 && (
                <>
                  <button
                    onClick={onPrevious}
                    disabled={currentIndex === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                  </button>
                  <button
                    onClick={onNext}
                    disabled={currentIndex === screenshots.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/90 dark:bg-gray-800/90 rounded-full shadow-lg hover:bg-white dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails */}
            {screenshots.length > 1 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {screenshots.map((screenshot, index) => (
                    <button
                      key={index}
                      onClick={() => onThumbnailClick?.(index)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                        index === currentIndex
                          ? 'border-blue-500 dark:border-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <img
                        src={`data:image/png;base64,${screenshot}`}
                        alt={screenshots.length === 1 ? '🍪 Banner dei Cookie' : `Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
