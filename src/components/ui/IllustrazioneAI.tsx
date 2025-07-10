// src/components/ui/IllustrazioneAI.tsx

export default function IllustrazioneAI() {
  return (
    <div className="flex justify-center animate-fade-in">
      <svg width="200" height="200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="80" fill="url(#gradient)" />
        <polygon points="100,40 130,160 70,160" fill="#fff" opacity="0.3" />
        <circle cx="100" cy="100" r="30" fill="#d946ef" />
        <defs>
          <linearGradient id="gradient" x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
            <stop stopColor="#d946ef" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}