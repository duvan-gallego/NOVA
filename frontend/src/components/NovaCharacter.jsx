import React from "react";

export function NovaCharacter({ mode = "idle", emotion = "calm" }) {
  return (
    <div className={`nova-character mode-${mode} emotion-${emotion}`} aria-hidden="true">
      <svg className="nova-character-svg" viewBox="0 0 260 260" role="img">
        <defs>
          <linearGradient id="nova-body" x1="65" x2="200" y1="54" y2="218">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#dfeee7" />
          </linearGradient>
          <linearGradient id="nova-core" x1="84" x2="176" y1="86" y2="182">
            <stop offset="0" stopColor="#40c7bd" />
            <stop offset="1" stopColor="#1f6f68" />
          </linearGradient>
          <filter id="nova-shadow" colorInterpolationFilters="sRGB" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="18" floodColor="#10231f" floodOpacity="0.18" stdDeviation="16" />
          </filter>
        </defs>

        <g className="nova-ambient">
          <circle className="nova-halo outer" cx="130" cy="136" r="102" />
          <circle className="nova-halo middle" cx="130" cy="136" r="78" />
          <path className="nova-wave left" d="M38 112 C16 126 16 151 38 166" />
          <path className="nova-wave right" d="M222 112 C244 126 244 151 222 166" />
        </g>

        <g className="nova-body" filter="url(#nova-shadow)">
          <path
            className="nova-antenna"
            d="M130 66 C130 44 146 38 158 29"
            fill="none"
            strokeLinecap="round"
            strokeWidth="8"
          />
          <circle className="nova-antenna-dot" cx="162" cy="27" r="10" />
          <path
            className="nova-shell"
            d="M67 126 C67 80 91 55 130 55 C169 55 193 80 193 126 L193 158 C193 193 166 218 130 218 C94 218 67 193 67 158 Z"
          />
          <circle className="nova-core" cx="130" cy="139" r="64" />
          <g className="nova-face">
            <g className="nova-eyes">
              <path className="nova-eye left" d="M103 124 C108 119 116 119 121 124" />
              <path className="nova-eye right" d="M139 124 C144 119 152 119 157 124" />
            </g>
            <g className="nova-mouth">
              <path className="mouth-smile" d="M108 153 C119 165 141 165 152 153" />
              <g className="mouth-bars">
                <rect x="109" y="146" width="8" height="18" rx="4" />
                <rect x="123" y="139" width="8" height="32" rx="4" />
                <rect x="137" y="144" width="8" height="22" rx="4" />
                <rect x="151" y="148" width="8" height="14" rx="4" />
              </g>
            </g>
          </g>
        </g>

        <g className="nova-thinking-sparks">
          <path d="M82 62 L88 74 L101 78 L89 84 L83 97 L77 84 L64 78 L77 73 Z" />
          <path d="M195 80 L199 89 L209 93 L200 98 L196 108 L191 98 L181 94 L190 89 Z" />
        </g>
      </svg>
    </div>
  );
}
