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
          <circle cx="445" cy="336" r="3" fill="#C25E36" />
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
        <g
          transform="translate(472, 294)"
          stroke="#1C1B22"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Soft ground shadow */}
          <ellipse
            cx="54"
            cy="146"
            rx="44"
            ry="10"
            fill="#1C1B22"
            fillOpacity="0.4"
            stroke="none"
          />

          {/* Fluffy Striped Tail curving gracefully */}
          <path
            d="M 80 132 C 110 132 122 104 116 78 C 113 64 123 56 129 62 C 135 68 128 88 125 106 C 120 132 102 144 78 140 Z"
            fill="#E59859"
          />
          {/* Tail ring stripes */}
          <path d="M 106 122 C 111 119 116 119 120 121" stroke="#9C4A24" strokeWidth="3.5" fill="none" />
          <path d="M 113 105 C 118 103 122 103 126 105" stroke="#9C4A24" strokeWidth="3.5" fill="none" />
          <path d="M 115 88 C 120 87 124 88 128 90" stroke="#9C4A24" strokeWidth="3.5" fill="none" />
          <path d="M 118 72 C 122 71 126 72 130 75" stroke="#9C4A24" strokeWidth="3.2" fill="none" />

          {/* Main Seated Body & Haunch (Three-quarter warm orange silhouette) */}
          <path
            d="M 28 60 C 16 84 14 114 22 142 L 84 142 C 96 124 94 88 72 60 Z"
            fill="#E59859"
          />
          {/* Warm shading on right haunch */}
          <path
            d="M 68 64 C 86 90 88 122 78 140 L 84 142 C 96 124 94 88 72 60 Z"
            fill="#CC7739"
            stroke="none"
          />

          {/* Organic Tabby Back Stripes */}
          <path d="M 68 74 C 58 76 52 81 48 87" stroke="#9C4A24" strokeWidth="3.8" fill="none" />
          <path d="M 76 90 C 64 93 56 99 52 106" stroke="#9C4A24" strokeWidth="3.8" fill="none" />
          <path d="M 80 107 C 68 110 61 116 57 123" stroke="#9C4A24" strokeWidth="3.8" fill="none" />

          {/* Cream Chest Ruff (Soft fur bib) */}
          <path
            d="M 31 66 C 28 80 33 95 45 99 C 57 95 62 80 59 66 Z"
            fill="#F6E9D7"
            stroke="#1C1B22"
            strokeWidth="1.6"
          />
          {/* Subtle chest fur tuft */}
          <path d="M 41 84 L 45 89 L 49 84" stroke="#D5BC9D" strokeWidth="1.5" fill="none" />

          {/* Front Legs & Paws */}
          <path
            d="M 29 88 L 27 142 L 42 142 L 44 102 L 48 142 L 63 142 L 61 88"
            fill="#E59859"
          />
          {/* Cream Paws with toe lines */}
          <ellipse cx="34" cy="142" rx="9" ry="5" fill="#F6E9D7" />
          <line x1="31" y1="140" x2="31" y2="145" stroke="#1C1B22" strokeWidth="1.3" />
          <line x1="36" y1="140" x2="36" y2="145" stroke="#1C1B22" strokeWidth="1.3" />

          <ellipse cx="56" cy="142" rx="9" ry="5" fill="#F6E9D7" />
          <line x1="53" y1="140" x2="53" y2="145" stroke="#1C1B22" strokeWidth="1.3" />
          <line x1="58" y1="140" x2="58" y2="145" stroke="#1C1B22" strokeWidth="1.3" />

          {/* Back Hind Paw */}
          <ellipse cx="76" cy="141" rx="9.5" ry="5" fill="#D98548" />

          {/* ─── Lucky's Signature Bandana (Yellow Collar + Red Tied Knot) ─── */}
          <path
            d="M 23 58 C 34 66 58 66 69 58 L 66 66 C 54 73 36 73 25 66 Z"
            fill="#F4C430"
            stroke="#1C1B22"
            strokeWidth="1.8"
          />
          {/* Red Bandana Tails & Knot */}
          <path
            d="M 38 66 L 26 74 L 33 78 L 43 69 Z"
            fill="#D63B2F"
            stroke="#1C1B22"
            strokeWidth="1.6"
          />
          <path
            d="M 45 67 L 43 81 L 51 79 L 50 67 Z"
            fill="#C22F24"
            stroke="#1C1B22"
            strokeWidth="1.6"
          />
          <circle
            cx="44"
            cy="67"
            r="4.2"
            fill="#E04336"
            stroke="#1C1B22"
            strokeWidth="1.7"
          />

          {/* ─── Expressive Feline Head & Ears ─── */}
          <path
            d="M 16 28 L 10 3 C 18 3 27 9 33 16 Q 46 13 59 16 C 65 9 74 3 82 3 L 76 28 C 86 41 80 60 46 62 C 12 60 6 41 16 28 Z"
            fill="#E59859"
          />

          {/* Inner Ears (Warm terracotta-pink + ear tufts) */}
          <path d="M 17 25 L 14 9 L 29 18 Z" fill="#D98274" stroke="none" />
          <path d="M 75 25 L 78 9 L 63 18 Z" fill="#D98274" stroke="none" />
          <path d="M 18 24 L 24 21" stroke="#F6E9D7" strokeWidth="1.6" />
          <path d="M 74 24 L 68 21" stroke="#F6E9D7" strokeWidth="1.6" />

          {/* Classic Tabby "M" Forehead Markings */}
          <path
            d="M 34 26 L 38 18 L 46 24 L 54 18 L 58 26"
            stroke="#9C4A24"
            strokeWidth="2.4"
            fill="none"
          />

          {/* Cheek Tabby Stripes */}
          <path d="M 15 41 Q 21 42 25 44" stroke="#9C4A24" strokeWidth="2.2" fill="none" />
          <path d="M 16 47 Q 22 48 26 49" stroke="#9C4A24" strokeWidth="2.2" fill="none" />
          <path d="M 77 41 Q 71 42 67 44" stroke="#9C4A24" strokeWidth="2.2" fill="none" />
          <path d="M 76 47 Q 70 48 66 49" stroke="#9C4A24" strokeWidth="2.2" fill="none" />

          {/* Expressive Almond Green-Amber Feline Eyes */}
          <g>
            {/* Left Eye */}
            <ellipse
              cx="33"
              cy="36"
              rx="6.2"
              ry="5.4"
              transform="rotate(-8 33 36)"
              fill="#C8D655"
              stroke="#1C1B22"
              strokeWidth="1.8"
            />
            <ellipse cx="33.5" cy="36" rx="2.2" ry="4.2" fill="#1C1B22" stroke="none" />
            <circle cx="31.5" cy="34" r="1.5" fill="#FFFFFF" stroke="none" />

            {/* Right Eye */}
            <ellipse
              cx="59"
              cy="36"
              rx="6.2"
              ry="5.4"
              transform="rotate(8 59 36)"
              fill="#C8D655"
              stroke="#1C1B22"
              strokeWidth="1.8"
            />
            <ellipse cx="58.5" cy="36" rx="2.2" ry="4.2" fill="#1C1B22" stroke="none" />
            <circle cx="56.5" cy="34" r="1.5" fill="#FFFFFF" stroke="none" />
          </g>

          {/* Soft Cream Muzzle Pads */}
          <path
            d="M 35 46 C 35 41 42 40 46 43 C 50 40 57 41 57 46 C 57 51 50 53 46 49 C 42 53 35 51 35 46 Z"
            fill="#F6E9D7"
            stroke="none"
          />

          {/* Pink Nose & Gentle Cat Mouth */}
          <polygon
            points="42.5,42 49.5,42 46,46.5"
            fill="#DF7A72"
            stroke="#1C1B22"
            strokeWidth="1.5"
          />
          <path
            d="M 38 49 Q 42 52.5 46 48.5 Q 50 52.5 54 49"
            stroke="#1C1B22"
            strokeWidth="1.7"
            fill="none"
          />

          {/* Delicate Whiskers */}
          <g stroke="#F6E9D7" strokeOpacity="0.85" strokeWidth="1.2">
            <path d="M 34 46 Q 18 44 6 46" fill="none" />
            <path d="M 34 49 Q 18 50 8 53" fill="none" />
            <path d="M 58 46 Q 74 44 86 46" fill="none" />
            <path d="M 58 49 Q 74 50 84 53" fill="none" />
          </g>
        </g>
      </svg>
    </div>
  );
}
