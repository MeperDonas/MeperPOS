import React from "react";

export function PosIsometricShowcase() {
  return (
    <div
      data-testid="pos-isometric-showcase"
      className="relative w-full max-w-[580px] mx-auto select-none"
    >
      <svg
        viewBox="0 0 680 470"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-xl"
        role="img"
        aria-label="Ilustración isométrica de terminal POS, lector de códigos, inventario y métricas"
      >
        <defs>
          <linearGradient id="posWaveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B968D" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#8B968D" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="posTerracottaGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E07A4B" />
            <stop offset="100%" stopColor="#C25E36" />
          </linearGradient>
          <linearGradient id="posScreenOrange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E07A4B" />
            <stop offset="55%" stopColor="#EB9E6C" />
            <stop offset="100%" stopColor="#D6CFC2" />
          </linearGradient>
        </defs>

        {/* ─── Ambient Horizon Waves ─── */}
        <path
          d="M 10 300 Q 55 268 100 288 T 190 265 T 280 280 L 280 355 L 10 355 Z"
          fill="url(#posWaveFill)"
        />
        <path
          d="M 10 300 Q 55 268 100 288 T 190 265 T 280 280"
          stroke="#7C887E"
          strokeOpacity="0.35"
          strokeWidth="1.2"
          fill="none"
        />
        <path
          d="M 430 225 Q 475 190 520 212 T 605 182 T 665 205 L 665 275 L 430 275 Z"
          fill="url(#posWaveFill)"
        />
        <path
          d="M 430 225 Q 475 190 520 212 T 605 182 T 665 205"
          stroke="#7C887E"
          strokeOpacity="0.35"
          strokeWidth="1.2"
          fill="none"
        />

        {/* ─── Isometric Floor Grid Lines ─── */}
        <g stroke="#7C887E" strokeOpacity="0.32" strokeWidth="1">
          {/* South-West to North-East lines */}
          <line x1="70" y1="330" x2="330" y2="180" />
          <line x1="115" y1="360" x2="375" y2="210" />
          <line x1="160" y1="390" x2="420" y2="240" />
          <line x1="205" y1="420" x2="465" y2="270" />
          <line x1="250" y1="445" x2="510" y2="295" />
          <line x1="295" y1="465" x2="555" y2="315" />

          {/* North-West to South-East lines */}
          <line x1="250" y1="185" x2="535" y2="350" />
          <line x1="205" y1="212" x2="490" y2="377" />
          <line x1="160" y1="239" x2="445" y2="404" />
          <line x1="115" y1="266" x2="400" y2="431" />
          <line x1="70" y1="293" x2="355" y2="458" />
        </g>

        {/* ─── Architectural Data Pins & Nodes ─── */}
        <g>
          {/* Left vertical pin */}
          <line
            x1="82"
            y1="128"
            x2="82"
            y2="323"
            stroke="#7C887E"
            strokeOpacity="0.45"
            strokeWidth="1.2"
          />
          <circle cx="82" cy="128" r="3.5" fill="#C25E36" />
          <circle cx="82" cy="240" r="2.5" fill="#7C887E" />

          {/* Barcode connector */}
          <polyline
            points="106,188 106,215 142,235"
            stroke="#7C887E"
            strokeOpacity="0.45"
            strokeWidth="1.2"
            fill="none"
          />
          <circle cx="106" cy="215" r="3" fill="#7C887E" />

          {/* Grid intersection accent nodes */}
          <circle cx="250" cy="445" r="3.5" fill="#C25E36" />
          <circle cx="535" cy="312" r="3.5" fill="#C25E36" />
          <circle cx="515" cy="362" r="3" fill="#C25E36" />
          <circle cx="388" cy="396" r="2.5" fill="#7C887E" />
        </g>

        {/* ─── Floating Isometric Barcode HUD (Top-Left) ─── */}
        <g transform="translate(95, 92) skewY(-28)">
          {/* Corner brackets */}
          <path
            d="M 0 12 L 0 0 L 10 0"
            stroke="#9BA59D"
            strokeWidth="1.8"
            fill="none"
          />
          <path
            d="M 48 0 L 58 0 L 58 12"
            stroke="#9BA59D"
            strokeWidth="1.8"
            fill="none"
          />
          <path
            d="M 0 42 L 0 54 L 10 54"
            stroke="#9BA59D"
            strokeWidth="1.8"
            fill="none"
          />
          <path
            d="M 48 54 L 58 54 L 58 42"
            stroke="#9BA59D"
            strokeWidth="1.8"
            fill="none"
          />
          {/* Barcode bars */}
          <rect x="8" y="10" width="3" height="34" fill="#C9C5BA" />
          <rect x="14" y="10" width="1.8" height="34" fill="#C9C5BA" />
          <rect x="19" y="10" width="4.5" height="34" fill="#D88C56" />
          <rect x="27" y="10" width="2" height="34" fill="#C9C5BA" />
          <rect x="32" y="10" width="3.5" height="34" fill="#C9C5BA" />
          <rect x="39" y="10" width="1.8" height="34" fill="#D88C56" />
          <rect x="44" y="10" width="4" height="34" fill="#C9C5BA" />
        </g>

        {/* ─── Rising Sales Trend Chart (Top-Right) ─── */}
        <g transform="translate(462, 76)">
          {/* Axes */}
          <polyline
            points="0,12 0,88 86,88"
            stroke="#9BA59D"
            strokeWidth="1.6"
            fill="none"
          />
          {/* Vertical metric ticks */}
          <line x1="18" y1="88" x2="18" y2="54" stroke="#9BA59D" strokeWidth="1.5" />
          <line x1="39" y1="88" x2="39" y2="62" stroke="#9BA59D" strokeWidth="1.5" />
          <line x1="60" y1="88" x2="60" y2="38" stroke="#9BA59D" strokeWidth="1.5" />
          <line x1="76" y1="88" x2="76" y2="22" stroke="#9BA59D" strokeWidth="1.5" />
          {/* Trend line + arrowhead */}
          <polyline
            points="6,66 24,42 42,55 75,16"
            stroke="#E07A4B"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <polyline
            points="66,15 76,15 75,25"
            stroke="#E07A4B"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        {/* ─── Floating Currency Coins (Top-Center-Right) ─── */}
        <g>
          {/* Upper Coin */}
          <g transform="translate(382, 118) rotate(-18)">
            <ellipse
              cx="26"
              cy="26"
              rx="24"
              ry="20"
              fill="#C25E36"
              stroke="#1C1B22"
              strokeWidth="2"
            />
            <ellipse
              cx="23"
              cy="23"
              rx="23"
              ry="19"
              fill="#E59866"
              stroke="#1C1B22"
              strokeWidth="2"
            />
            <ellipse
              cx="23"
              cy="23"
              rx="16"
              ry="13"
              fill="none"
              stroke="#1C1B22"
              strokeWidth="1.3"
            />
            <text
              x="23"
              y="28"
              textAnchor="middle"
              fill="#1C1B22"
              fontSize="16"
              fontWeight="800"
              fontFamily="monospace"
            >
              $
            </text>
          </g>

          {/* Lower Overlapping Coin */}
          <g transform="translate(414, 138) rotate(12)">
            <ellipse
              cx="26"
              cy="26"
              rx="24"
              ry="20"
              fill="#C25E36"
              stroke="#1C1B22"
              strokeWidth="2"
            />
            <ellipse
              cx="23"
              cy="23"
              rx="23"
              ry="19"
              fill="#E59866"
              stroke="#1C1B22"
              strokeWidth="2"
            />
            <ellipse
              cx="23"
              cy="23"
              rx="16"
              ry="13"
              fill="none"
              stroke="#1C1B22"
              strokeWidth="1.3"
            />
            <text
              x="23"
              y="28"
              textAnchor="middle"
              fill="#1C1B22"
              fontSize="16"
              fontWeight="800"
              fontFamily="monospace"
            >
              $
            </text>
          </g>
        </g>

        {/* ─── Right-Side Inventory Boxes ─── */}
        <g stroke="#1C1B22" strokeWidth="2" strokeLinejoin="round">
          {/* Back Box */}
          <g transform="translate(388, 178)">
            {/* Top */}
            <polygon points="0,22 38,0 76,22 38,44" fill="#E6CCB2" />
            {/* Left */}
            <polygon points="0,22 38,44 38,88 0,66" fill="#DDB892" />
            {/* Right */}
            <polygon points="38,44 76,22 76,66 38,88" fill="#C69C72" />
            {/* Tape */}
            <polygon points="15,13 25,7 63,29 53,35" fill="#7C887E" />
            <polygon points="15,13 25,19 25,38 15,32" fill="#5F6B61" />
          </g>

          {/* Front Box */}
          <g transform="translate(435, 208)">
            {/* Top */}
            <polygon points="0,24 44,0 88,24 44,48" fill="#E6CCB2" />
            {/* Left */}
            <polygon points="0,24 44,48 44,96 0,72" fill="#D5AB82" />
            {/* Right */}
            <polygon points="44,48 88,24 88,72 44,96" fill="#B88B61" />
            {/* Center seam + tape */}
            <line x1="22" y1="12" x2="66" y2="36" stroke="#1C1B22" strokeWidth="1.6" />
            <polygon points="58,31 68,26 68,48 58,53" fill="#DDB892" />
          </g>
        </g>

        {/* ─── Central Isometric POS Terminal ─── */}
        <g strokeLinejoin="round">
          {/* Terminal Monitor Back Casing */}
          <path
            d="M 164 176 L 318 86 Q 330 79 333 93 L 352 208 L 182 308 L 160 192 Q 158 180 164 176 Z"
            fill="#D88C56"
            stroke="#1C1B22"
            strokeWidth="2.4"
          />

          {/* Monitor Bezel (Sage Frame) */}
          <path
            d="M 172 184 L 326 94 Q 336 88 339 100 L 358 214 L 190 314 L 169 198 Q 167 188 172 184 Z"
            fill="#8D998F"
            stroke="#1C1B22"
            strokeWidth="2.4"
          />

          {/* Inner Display Screen (Cream Canvas) */}
          <polygon
            points="183,193 328,108 345,206 199,292"
            fill="#EBE6DC"
            stroke="#1C1B22"
            strokeWidth="2"
          />

          {/* Screen UI Content: Left Checkout Panel */}
          <polygon
            points="189,198 242,167 255,248 202,279"
            fill="url(#posScreenOrange)"
          />

          {/* Screen UI Content: Right Order Rows */}
          <g fill="#6E7870">
            <polygon points="252,162 292,138 295,152 254,176" />
            <polygon points="300,133 320,121 323,135 302,147" fill="#545E56" />

            <polygon points="256,184 316,149 318,158 258,193" />
            <polygon points="259,199 306,171 308,180 261,208" />
            <polygon points="262,214 318,181 320,190 264,223" />

            {/* Bottom Summary Pills */}
            <polygon points="266,232 298,213 300,221 268,240" fill="#8D998F" />
            <polygon points="268,244 292,230 294,238 270,252" fill="#8D998F" />
            <polygon points="310,206 326,196 328,204 312,214" fill="#6E7870" />
            <polygon points="312,218 328,208 330,216 314,226" fill="#6E7870" />
          </g>

          {/* ─── Thermal Receipt ("Tirilla") Emerging from Top-Left ─── */}
          <g>
            {/* Receipt back curl */}
            <path
              d="M 176 122 Q 190 102 208 110 L 222 146 L 190 165 Z"
              fill="#D6CFC2"
              stroke="#1C1B22"
              strokeWidth="2"
            />
            {/* Main receipt body */}
            <path
              d="M 176 122 C 186 135 196 160 202 184 L 240 162 C 234 138 222 114 208 104 L 198 112 L 192 108 L 186 116 L 180 113 Z"
              fill="#F7F4EE"
              stroke="#1C1B22"
              strokeWidth="2"
            />
            {/* Printed receipt lines */}
            <line x1="192" y1="132" x2="212" y2="120" stroke="#4A524C" strokeWidth="2.2" />
            <line x1="196" y1="143" x2="220" y2="129" stroke="#4A524C" strokeWidth="2.2" />
            <line x1="200" y1="154" x2="218" y2="143" stroke="#4A524C" strokeWidth="2.2" />
            <line x1="204" y1="165" x2="228" y2="151" stroke="#C25E36" strokeWidth="2.4" />
          </g>

          {/* ─── POS Keyboard / Base Deck ─── */}
          {/* Base thickness / bottom lip */}
          <path
            d="M 190 314 L 358 214 L 462 276 Q 470 282 462 288 L 302 386 Q 290 392 280 385 L 188 326 Z"
            fill="#D88C56"
            stroke="#1C1B22"
            strokeWidth="2.4"
          />
          {/* Base top deck (Sage) */}
          <path
            d="M 190 308 L 358 208 L 460 270 Q 466 274 458 280 L 300 376 Q 290 382 280 375 L 190 316 Z"
            fill="#8D998F"
            stroke="#1C1B22"
            strokeWidth="2.4"
          />
          {/* Inner cream keyboard surface */}
          <polygon
            points="206,309 355,220 444,274 295,364"
            fill="#EBE6DC"
            stroke="#1C1B22"
            strokeWidth="2"
          />

          {/* Left receipt/status slot on deck */}
          <line
            x1="226"
            y1="308"
            x2="254"
            y2="291"
            stroke="#1C1B22"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Touchpad on deck */}
          <polygon
            points="262,324 302,300 330,317 290,341"
            fill="#8D998F"
            stroke="#1C1B22"
            strokeWidth="1.8"
          />

          {/* Keypad Matrix on Right of Deck */}
          <g stroke="#1C1B22" strokeWidth="1.5">
            {/* Long Terracotta top bar key */}
            <polygon
              points="302,265 344,240 355,247 313,272"
              fill="#D88C56"
            />
            {/* Key Row 1 */}
            <polygon points="320,276 333,268 343,274 330,282" fill="#9AA59C" />
            <polygon points="337,266 350,258 360,264 347,272" fill="#9AA59C" />
            <polygon points="354,256 367,248 377,254 364,262" fill="#9AA59C" />

            {/* Key Row 2 */}
            <polygon points="335,286 348,278 358,284 345,292" fill="#9AA59C" />
            <polygon points="352,276 365,268 375,274 362,282" fill="#9AA59C" />
            <polygon points="369,266 382,258 392,264 379,272" fill="#9AA59C" />

            {/* Key Row 3 */}
            <polygon points="350,296 363,288 373,294 360,302" fill="#9AA59C" />
            <polygon points="367,286 380,278 390,284 377,292" fill="#9AA59C" />
            <polygon points="384,276 397,268 407,274 394,282" fill="#9AA59C" />

            {/* Bottom Enter Terracotta Key */}
            <polygon
              points="382,294 416,273 428,280 394,301"
              fill="#D88C56"
            />
          </g>
        </g>

        {/* ─── Handheld Barcode Scanner (Mid-Left) ─── */}
        <g transform="translate(86, 232)" stroke="#1C1B22" strokeWidth="2" strokeLinejoin="round">
          {/* Base shadow */}
          <ellipse cx="32" cy="86" rx="22" ry="10" fill="#1C1B22" fillOpacity="0.35" stroke="none" />
          {/* Stand base */}
          <ellipse cx="32" cy="82" rx="20" ry="9" fill="#8D998F" />
          {/* Handle / neck */}
          <path
            d="M 24 80 C 26 62 32 52 38 38 L 49 42 C 42 56 38 66 38 82 Z"
            fill="#EBE6DC"
          />
          {/* Scanner Head */}
          <path
            d="M 8 20 L 34 6 Q 48 0 54 12 L 58 24 Q 60 32 48 38 L 22 48 Z"
            fill="#EBE6DC"
          />
          {/* Scanner Front Terracotta Lens */}
          <polygon points="8,20 24,28 22,48 6,38" fill="#D88C56" />
          <polygon points="11,24 21,29 20,43 10,37" fill="#C25E36" />
        </g>

        {/* ─── Foreground Stacked Inventory Boxes (Bottom-Left) ─── */}
        <g transform="translate(94, 305)" stroke="#1C1B22" strokeWidth="2" strokeLinejoin="round">
          {/* Large Bottom Box */}
          <polygon points="0,34 56,2 112,34 56,66" fill="#E6CCB2" />
          <polygon points="0,34 56,66 56,118 0,86" fill="#D5AB82" />
          <polygon points="56,66 112,34 112,86 56,118" fill="#B88B61" />
          {/* Shipping label on left face */}
          <polygon points="10,64 26,73 26,87 10,78" fill="#EBE6DC" strokeWidth="1.4" />

          {/* Small Bottom-Right Side Box */}
          <g transform="translate(88, 66)">
            <polygon points="0,18 32,0 64,18 32,36" fill="#E6CCB2" />
            <polygon points="0,18 32,36 32,64 0,46" fill="#D5AB82" />
            <polygon points="32,36 64,18 64,46 32,64" fill="#B88B61" />
            {/* Barcode ticks on side */}
            <line x1="6" y1="30" x2="6" y2="42" stroke="#1C1B22" strokeWidth="1.5" />
            <line x1="11" y1="33" x2="11" y2="45" stroke="#1C1B22" strokeWidth="1.5" />
            <line x1="16" y1="36" x2="16" y2="48" stroke="#1C1B22" strokeWidth="1.5" />
            <line x1="21" y1="39" x2="21" y2="51" stroke="#1C1B22" strokeWidth="1.5" />
          </g>

          {/* Top Left Sage Box */}
          <g transform="translate(20, -14)">
            <polygon points="0,20 34,0 68,20 34,40" fill="#8D998F" />
            <polygon points="0,20 34,40 34,76 0,56" fill="#707C72" />
            <polygon points="34,40 68,20 68,56 34,76" fill="#58635A" />
            {/* Terracotta Tape */}
            <polygon points="13,12 22,7 56,27 47,32" fill="#D88C56" />
            <polygon points="13,12 22,17 22,35 13,30" fill="#C25E36" />
          </g>

          {/* Top Right Kraft Box */}
          <g transform="translate(64, 14)">
            <polygon points="0,20 34,0 68,20 34,40" fill="#E6CCB2" />
            <polygon points="0,20 34,40 34,78 0,58" fill="#D5AB82" />
            <polygon points="34,40 68,20 68,58 34,78" fill="#B88B61" />
            <line x1="17" y1="10" x2="51" y2="30" stroke="#1C1B22" strokeWidth="1.6" />
            <polygon points="44,26 52,21 52,40 44,45" fill="#EBE6DC" />
          </g>
        </g>

        {/* ─── Companion Tabby Cat ("Lucky") Sitting in Bottom-Right ─── */}
        <g transform="translate(476, 304)" stroke="#1C1B22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {/* Ground shadow */}
          <ellipse cx="48" cy="134" rx="38" ry="9" fill="#1C1B22" fillOpacity="0.35" stroke="none" />

          {/* Curled Striped Tail */}
          <path
            d="M 74 122 C 102 122 108 92 102 72 C 98 58 108 48 115 54 C 122 60 114 78 112 96 C 108 122 92 134 72 130 Z"
            fill="#E09F67"
          />
          {/* Tail stripes */}
          <path d="M 98 112 L 108 108" stroke="#9C5230" strokeWidth="3.5" />
          <path d="M 102 96 L 112 94" stroke="#9C5230" strokeWidth="3.5" />
          <path d="M 101 80 L 112 80" stroke="#9C5230" strokeWidth="3.5" />
          <path d="M 103 65 L 113 67" stroke="#9C5230" strokeWidth="3.5" />

          {/* Main Torso / Haunches */}
          <path
            d="M 24 54 C 16 78 14 106 20 130 L 76 130 C 86 112 82 80 64 54 Z"
            fill="#E09F67"
          />

          {/* Back / Side Tabby Stripes */}
          <path d="M 66 68 Q 54 72 50 78" stroke="#9C5230" strokeWidth="4" fill="none" />
          <path d="M 74 82 Q 58 86 52 94" stroke="#9C5230" strokeWidth="4" fill="none" />
          <path d="M 78 98 Q 62 102 58 110" stroke="#9C5230" strokeWidth="4" fill="none" />

          {/* Chest / Front Legs */}
          <path
            d="M 26 78 L 24 130 L 38 130 L 40 94 L 44 130 L 58 130 L 56 80"
            fill="#E09F67"
          />
          {/* Paws */}
          <ellipse cx="30" cy="130" rx="8" ry="4.5" fill="#E8B486" />
          <ellipse cx="51" cy="130" rx="8" ry="4.5" fill="#E8B486" />
          <ellipse cx="68" cy="129" rx="9" ry="4.5" fill="#D58952" />

          {/* Cat Head */}
          <path
            d="M 16 26 L 12 2 L 32 16 Q 44 13 56 16 L 74 2 L 70 26 C 78 38 74 56 44 58 C 14 56 10 38 16 26 Z"
            fill="#E09F67"
          />
          {/* Inner Ears */}
          <polygon points="16,22 15,8 27,18" fill="#C26D53" stroke="none" />
          <polygon points="70,22 71,8 59,18" fill="#C26D53" stroke="none" />

          {/* Forehead Tabby Stripes */}
          <line x1="44" y1="16" x2="44" y2="26" stroke="#9C5230" strokeWidth="3" />
          <line x1="37" y1="18" x2="39" y2="26" stroke="#9C5230" strokeWidth="2.5" />
          <line x1="51" y1="18" x2="49" y2="26" stroke="#9C5230" strokeWidth="2.5" />

          {/* Cheek Stripes */}
          <line x1="18" y1="38" x2="26" y2="40" stroke="#9C5230" strokeWidth="2.2" />
          <line x1="19" y1="44" x2="27" y2="45" stroke="#9C5230" strokeWidth="2.2" />
          <line x1="70" y1="38" x2="62" y2="40" stroke="#9C5230" strokeWidth="2.2" />
          <line x1="69" y1="44" x2="61" y2="45" stroke="#9C5230" strokeWidth="2.2" />

          {/* Eyes */}
          <circle cx="32" cy="34" r="3.2" fill="#1C1B22" stroke="none" />
          <circle cx="56" cy="34" r="3.2" fill="#1C1B22" stroke="none" />
          <circle cx="31" cy="33" r="1" fill="#FFFFFF" stroke="none" />
          <circle cx="55" cy="33" r="1" fill="#FFFFFF" stroke="none" />

          {/* Pink Nose & Smile */}
          <polygon points="41,40 47,40 44,44" fill="#C26D53" stroke="none" />
          <path d="M 39 46 Q 44 50 49 46" stroke="#1C1B22" strokeWidth="1.8" fill="none" />
        </g>
      </svg>
    </div>
  );
}
