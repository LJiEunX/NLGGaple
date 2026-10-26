import React from 'react';

interface GoldenLaurelWreathProps {
  children?: React.ReactNode;
  className?: string;
}

export const GoldenLaurelWreath: React.FC<GoldenLaurelWreathProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Radiant Golden Glow Burst Background */}
      <div className="absolute inset-[-20%] rounded-full bg-gradient-to-tr from-amber-500/40 via-yellow-300/30 to-amber-600/40 blur-md animate-pulse pointer-events-none" />

      {/* Rotating Sunburst Rays */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-[-15%] w-[130%] h-[130%] pointer-events-none opacity-40 animate-[spin_20s_linear_infinite]"
      >
        <defs>
          <radialGradient id="sunburst-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ca8a04" stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 12 }).map((_, i) => (
          <polygon
            key={i}
            points="50,50 46,0 54,0"
            fill="url(#sunburst-grad)"
            transform={`rotate(${i * 30} 50 50)`}
          />
        ))}
      </svg>

      {/* Golden Laurel Wreath SVG Vector Art */}
      <svg
        viewBox="0 0 120 120"
        className="absolute inset-[-22%] w-[144%] h-[144%] pointer-events-none drop-shadow-[0_2px_8px_rgba(234,179,8,0.7)]"
      >
        <defs>
          <linearGradient id="laurel-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="25%" stopColor="#fde047" />
            <stop offset="60%" stopColor="#eab308" />
            <stop offset="85%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#854d0e" />
          </linearGradient>

          <filter id="laurel-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#000000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Left Laurel Branch */}
        <g filter="url(#laurel-shadow)">
          {/* Main Curved Stem */}
          <path
            d="M 52,106 C 24,102 12,78 16,52 C 19,34 32,20 44,14"
            fill="none"
            stroke="url(#laurel-gold)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Leaves along left stem */}
          {/* Bottom leaf pair */}
          <ellipse cx="44" cy="102" rx="5" ry="2.8" transform="rotate(-30 44 102)" fill="url(#laurel-gold)" />
          <ellipse cx="36" cy="95" rx="5.5" ry="3" transform="rotate(-40 36 95)" fill="url(#laurel-gold)" />

          {/* Lower-mid leaf pair */}
          <ellipse cx="26" cy="84" rx="6" ry="3.2" transform="rotate(-55 26 84)" fill="url(#laurel-gold)" />
          <ellipse cx="19" cy="71" rx="6.5" ry="3.4" transform="rotate(-75 19 71)" fill="url(#laurel-gold)" />

          {/* Mid leaf pair */}
          <ellipse cx="16" cy="56" rx="6.5" ry="3.4" transform="rotate(-90 16 56)" fill="url(#laurel-gold)" />
          <ellipse cx="18" cy="42" rx="6" ry="3.2" transform="rotate(-110 18 42)" fill="url(#laurel-gold)" />

          {/* Upper leaf pair */}
          <ellipse cx="25" cy="30" rx="5.8" ry="3" transform="rotate(-130 25 30)" fill="url(#laurel-gold)" />
          <ellipse cx="35" cy="20" rx="5.2" ry="2.8" transform="rotate(-145 35 20)" fill="url(#laurel-gold)" />

          {/* Top tip leaf */}
          <ellipse cx="46" cy="14" rx="4.8" ry="2.5" transform="rotate(-160 46 14)" fill="url(#laurel-gold)" />
        </g>

        {/* Right Laurel Branch (Mirrored) */}
        <g filter="url(#laurel-shadow)">
          {/* Main Curved Stem */}
          <path
            d="M 68,106 C 96,102 108,78 104,52 C 101,34 88,20 76,14"
            fill="none"
            stroke="url(#laurel-gold)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />

          {/* Leaves along right stem */}
          <ellipse cx="76" cy="102" rx="5" ry="2.8" transform="rotate(30 76 102)" fill="url(#laurel-gold)" />
          <ellipse cx="84" cy="95" rx="5.5" ry="3" transform="rotate(40 84 95)" fill="url(#laurel-gold)" />

          <ellipse cx="94" cy="84" rx="6" ry="3.2" transform="rotate(55 94 84)" fill="url(#laurel-gold)" />
          <ellipse cx="101" cy="71" rx="6.5" ry="3.4" transform="rotate(75 101 71)" fill="url(#laurel-gold)" />

          <ellipse cx="104" cy="56" rx="6.5" ry="3.4" transform="rotate(90 104 56)" fill="url(#laurel-gold)" />
          <ellipse cx="102" cy="42" rx="6" ry="3.2" transform="rotate(110 102 42)" fill="url(#laurel-gold)" />

          <ellipse cx="95" cy="30" rx="5.8" ry="3" transform="rotate(130 95 30)" fill="url(#laurel-gold)" />
          <ellipse cx="85" cy="20" rx="5.2" ry="2.8" transform="rotate(145 85 20)" fill="url(#laurel-gold)" />

          <ellipse cx="74" cy="14" rx="4.8" ry="2.5" transform="rotate(160 74 14)" fill="url(#laurel-gold)" />
        </g>

        {/* Bottom Laurel Ribbon / Bow */}
        <g filter="url(#laurel-shadow)">
          <path
            d="M 52,104 C 56,108 64,108 68,104 C 64,102 56,102 52,104 Z"
            fill="url(#laurel-gold)"
          />
          <circle cx="60" cy="105" r="3.2" fill="url(#laurel-gold)" stroke="#854d0e" strokeWidth="0.5" />
          <path
            d="M 58,107 L 53,116 L 57,114 L 60,116 L 60,107"
            fill="url(#laurel-gold)"
            opacity="0.9"
          />
          <path
            d="M 62,107 L 67,116 L 63,114 L 60,116 L 60,107"
            fill="url(#laurel-gold)"
            opacity="0.9"
          />
        </g>
      </svg>

      {/* Center Slot (Points Badge) */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};
