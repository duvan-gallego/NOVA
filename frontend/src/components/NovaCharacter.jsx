import React from "react";

export function NovaCharacter({ mode = "idle", emotion = "calm" }) {
  return (
    <div className={`nova-character mode-${mode} emotion-${emotion}`} aria-hidden="true">
      <svg className="nova-character-svg" viewBox="0 0 260 260" role="img">
        <defs>
          <linearGradient id="nova-body" x1="65" x2="200" y1="54" y2="218">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#f2f8fb" />
          </linearGradient>
          <linearGradient id="nova-core" x1="84" x2="176" y1="86" y2="182">
            <stop offset="0" stopColor="#77e2ed" />
            <stop offset="1" stopColor="#14a9c6" />
          </linearGradient>
          <filter id="nova-shadow" colorInterpolationFilters="sRGB" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="18" floodColor="#10231f" floodOpacity="0.18" stdDeviation="16" />
          </filter>
        </defs>

        <g className="nova-ambient">
          <path className="nova-orbit-dash top" d="M40 96 C78 42 174 31 219 76" />
          <path className="nova-orbit-dash bottom" d="M43 200 C88 233 171 235 217 196" />
          <circle className="nova-aura" cx="130" cy="136" r="118" />
          <circle className="nova-halo outer" cx="130" cy="136" r="102" />
          <circle className="nova-halo middle" cx="130" cy="136" r="78" />
          <circle className="nova-halo inner" cx="130" cy="136" r="52" />
          <path className="nova-wave left" d="M38 112 C16 126 16 151 38 166" />
          <path className="nova-wave right" d="M222 112 C244 126 244 151 222 166" />
          <path className="nova-star" d="M62 65 L68 78 L82 80 L72 90 L74 104 L62 97 L50 104 L52 90 L42 80 L56 78 Z" />
          <path className="nova-lime-star" d="M202 90 L207 100 L218 102 L210 110 L212 121 L202 116 L192 121 L194 110 L186 102 L197 100 Z" />
          <g className="nova-bubbles">
            <circle cx="58" cy="38" r="6" />
            <circle cx="70" cy="24" r="8" />
            <circle cx="77" cy="43" r="4" />
          </g>
        </g>

        <ellipse className="nova-floor-shadow" cx="130" cy="228" rx="58" ry="12" />

        <g className="nova-body" filter="url(#nova-shadow)">
          <g className="nova-arms">
            <g className="nova-arm-pose pose-idle">
              <path className="nova-arm left" d="M74 146 C49 150 39 169 50 186" />
              <path className="nova-arm right" d="M186 146 C211 150 221 169 210 186" />
            </g>
            <g className="nova-arm-pose pose-listening">
              <path className="nova-arm left" d="M74 150 C54 150 44 163 49 178" />
              <path className="nova-arm right" d="M186 150 C206 150 216 163 211 178" />
            </g>
            <g className="nova-arm-pose pose-thinking">
              <path className="nova-arm left" d="M74 150 C55 157 49 174 59 188" />
              <path className="nova-arm right" d="M186 150 C203 143 198 126 181 119" />
            </g>
            <g className="nova-arm-pose pose-speaking">
              <path className="nova-arm left" d="M75 151 C55 151 44 147 43 139" />
              <path className="nova-arm right" d="M185 151 C205 151 216 147 217 139" />
            </g>
          </g>
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
              <g className="nova-eye-wrap left">
                <ellipse className="nova-eye-white" cx="111" cy="126" rx="13" ry="15" />
                <circle className="nova-pupil" cx="112" cy="128" r="6" />
                <circle className="nova-eye-shine" cx="109" cy="125" r="2" />
                <path className="nova-eye-lid" d="M98 126 C105 118 117 118 124 126" />
              </g>
              <g className="nova-eye-wrap right">
                <ellipse className="nova-eye-white" cx="149" cy="126" rx="13" ry="15" />
                <circle className="nova-pupil" cx="150" cy="128" r="6" />
                <circle className="nova-eye-shine" cx="147" cy="125" r="2" />
                <path className="nova-eye-lid" d="M136 126 C143 118 155 118 162 126" />
              </g>
            </g>
            <g className="nova-cheeks">
              <ellipse className="nova-cheek left" cx="94" cy="145" rx="9" ry="6" />
              <ellipse className="nova-cheek right" cx="166" cy="145" rx="9" ry="6" />
            </g>
            <g className="nova-mouth">
              <path className="mouth-smile" d="M108 153 C119 165 141 165 152 153" />
              <ellipse className="mouth-talking" cx="130" cy="157" rx="14" ry="7" />
            </g>
          </g>
        </g>

        <g className="nova-thinking-sparks">
          <path d="M82 62 L88 74 L101 78 L89 84 L83 97 L77 84 L64 78 L77 73 Z" />
          <path d="M195 80 L199 89 L209 93 L200 98 L196 108 L191 98 L181 94 L190 89 Z" />
        </g>

        <g className="nova-rocket">
          <path className="rocket-flame" d="M218 52 C228 61 227 73 215 85 C217 74 210 66 199 65 C205 57 211 53 218 52 Z" />
          <path className="rocket-body" d="M197 44 C209 22 228 17 237 18 C238 28 233 47 211 59 Z" />
          <path className="rocket-window" d="M219 34 A7 7 0 1 0 219 48 A7 7 0 1 0 219 34" />
          <path className="rocket-fin left" d="M198 45 L184 52 L193 57" />
          <path className="rocket-fin right" d="M211 59 L209 74 L220 63" />
        </g>

        <g className="nova-thought-dots">
          <circle cx="94" cy="72" r="5" />
          <circle cx="108" cy="58" r="7" />
          <circle cx="127" cy="51" r="4" />
        </g>
      </svg>
    </div>
  );
}
