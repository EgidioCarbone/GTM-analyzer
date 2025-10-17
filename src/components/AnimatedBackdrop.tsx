import React from 'react';

interface AnimatedBackdropProps {
  variant?: 'home' | 'default';
}

export function AnimatedBackdrop({ variant = 'home' }: AnimatedBackdropProps) {
  const blobColors =
    variant === 'home'
      ? [
          'bg-purple-300',
          'bg-yellow-300',
          'bg-pink-300',
          'bg-blue-300',
        ]
      : [
          'bg-blue-200',
          'bg-cyan-200',
          'bg-purple-200',
          'bg-indigo-200',
        ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Cerchi animati */}
      <div className={`absolute -top-40 -left-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob ${blobColors[0]}`}></div>
      <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000 ${blobColors[1]}`}></div>
      <div className={`absolute -bottom-40 left-20 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000 ${blobColors[2]}`}></div>
      <div className={`absolute -bottom-40 right-20 w-80 h-80 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-6000 ${blobColors[3]}`}></div>

      {/* Particelle fluttuanti */}
      <div className="absolute inset-0">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full opacity-60 animate-float bg-white/60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 10}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
