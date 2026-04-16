import React, { CSSProperties, useId } from "react";

type FoxMood = "idle" | "thinking" | "talking" | "happy" | "wave" | "giggle";

export interface ForestFoxProps {
  mood?: FoxMood;
  size?: number;
  onClick?: () => void;
}

/**
 * ForestFox — A cute fox mascot for the Enchanted Forest theme.
 * Maintains same mood interface as original UliCharacter.
 * Hand-crafted SVG with organic, storybook illustration feel.
 */
const ForestFox: React.FC<ForestFoxProps> = ({
  mood = "idle",
  size = 120,
  onClick,
}) => {
  const id = useId().replace(/:/g, "");
  const bodyGradId = `fox-body-${id}`;
  const bellyGradId = `fox-belly-${id}`;
  const earInnerId = `fox-ear-inner-${id}`;
  const blushId = `fox-blush-${id}`;
  const tailGradId = `fox-tail-${id}`;

  const wrapperStyle: CSSProperties = {
    width: size,
    height: size,
    cursor: onClick ? "pointer" : "default",
  };

  return (
    <div
      className={`fox-container mood-${mood}`}
      style={wrapperStyle}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-label="Uli fox character"
      {...(onClick ? { "data-clickable": true } : {})}
    >
      <svg
        className="fox-svg"
        viewBox="0 0 140 160"
        width={size}
        height={size}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={bodyGradId} cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#E88B5A" />
            <stop offset="60%" stopColor="#D4723C" />
            <stop offset="100%" stopColor="#B85A2A" />
          </radialGradient>

          <radialGradient id={bellyGradId} cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#FFF8E7" />
            <stop offset="100%" stopColor="#F5E6CC" />
          </radialGradient>

          <radialGradient id={earInnerId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F5B041" />
            <stop offset="100%" stopColor="#D4881C" />
          </radialGradient>

          <filter id={blushId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>

          <linearGradient id={tailGradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#D4723C" />
            <stop offset="70%" stopColor="#E88B5A" />
            <stop offset="100%" stopColor="#FFF8E7" />
          </linearGradient>
        </defs>

        <g className="fox-core">
          {/* Tail */}
          <g className="fox-tail" style={{ transformOrigin: "105px 105px" }}>
            <path
              d="M105 100
                 C120 88, 130 75, 128 60
                 C126 48, 118 42, 112 48
                 C106 54, 100 68, 98 82
                 C96 92, 100 98, 105 100 Z"
              fill={`url(#${tailGradId})`}
              stroke="rgba(184,90,42,0.3)"
              strokeWidth={1.5}
            />
            {/* Tail white tip */}
            <path
              d="M126 58
                 C124 50, 119 45, 115 49
                 C111 53, 113 58, 118 57
                 C122 56, 125 55, 126 58 Z"
              fill="#FFF8E7"
              opacity={0.8}
            />
          </g>

          {/* Left ear */}
          <g className="fox-ear left">
            <path
              d="M42 58 L32 22 L58 48 Z"
              fill={`url(#${bodyGradId})`}
              stroke="rgba(184,90,42,0.2)"
              strokeWidth={1}
            />
            <path
              d="M44 52 L37 30 L54 47 Z"
              fill={`url(#${earInnerId})`}
              opacity={0.6}
            />
          </g>

          {/* Right ear */}
          <g className="fox-ear right">
            <path
              d="M98 58 L108 22 L82 48 Z"
              fill={`url(#${bodyGradId})`}
              stroke="rgba(184,90,42,0.2)"
              strokeWidth={1}
            />
            <path
              d="M96 52 L103 30 L86 47 Z"
              fill={`url(#${earInnerId})`}
              opacity={0.6}
            />
          </g>

          {/* Body */}
          <path
            className="fox-body"
            d="M70 52
               C46 52, 28 68, 26 92
               C24 112, 32 132, 50 142
               C62 148, 82 148, 94 140
               C110 130, 116 112, 114 92
               C112 68, 94 52, 70 52 Z"
            fill={`url(#${bodyGradId})`}
          />

          {/* Belly */}
          <path
            className="fox-belly"
            d="M70 76
               C52 76, 40 90, 40 108
               C40 126, 50 136, 68 138
               C86 140, 100 128, 100 108
               C100 88, 88 76, 70 76 Z"
            fill={`url(#${bellyGradId})`}
          />

          {/* Cheek blushes */}
          <g className="fox-blush">
            <ellipse
              cx="40"
              cy="90"
              rx="10"
              ry="6"
              fill="#E86C5A"
              opacity={0.2}
              filter={`url(#${blushId})`}
            />
            <ellipse
              cx="100"
              cy="90"
              rx="10"
              ry="6"
              fill="#E86C5A"
              opacity={0.2}
              filter={`url(#${blushId})`}
            />
          </g>

          {/* Left eye */}
          <g className="fox-eye left">
            <ellipse cx="52" cy="78" rx="10" ry="11" fill="#FFFDF5" />
            <ellipse cx="53" cy="80" rx="6.5" ry="7.5" fill="#3C2415" />
            <circle cx="50" cy="76" r="2.2" fill="#FFFFFF" />
            <circle cx="55" cy="79" r="1.2" fill="#FFFFFF" opacity={0.7} />
            {/* Eyelid for blink/close */}
            <path
              className="fox-eye-lid"
              d="M42 78 Q52 67 62 78"
              fill="none"
              stroke="#B85A2A"
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0}
            />
          </g>

          {/* Right eye */}
          <g className="fox-eye right">
            <ellipse cx="88" cy="78" rx="10" ry="11" fill="#FFFDF5" />
            <ellipse cx="87" cy="80" rx="6.5" ry="7.5" fill="#3C2415" />
            <circle cx="84" cy="76" r="2.2" fill="#FFFFFF" />
            <circle cx="89" cy="79" r="1.2" fill="#FFFFFF" opacity={0.7} />
            <path
              className="fox-eye-lid"
              d="M78 78 Q88 67 98 78"
              fill="none"
              stroke="#B85A2A"
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0}
            />
          </g>

          {/* Nose */}
          <ellipse cx="70" cy="90" rx="4.5" ry="3" fill="#3C2415" />
          {/* Nose highlight */}
          <ellipse cx="69" cy="89" rx="1.5" ry="1" fill="#FFFDF5" opacity={0.4} />

          {/* Mouth */}
          <path
            className="fox-mouth fox-mouth-smile"
            d="M62 95 Q70 102 78 95"
            fill="none"
            stroke="#3C2415"
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          {/* Whiskers */}
          <g className="fox-whiskers" opacity={0.35} stroke="#3C2415" strokeWidth={1.2}>
            <line x1="32" y1="86" x2="44" y2="88" strokeLinecap="round" />
            <line x1="30" y1="92" x2="43" y2="92" strokeLinecap="round" />
            <line x1="96" y1="88" x2="108" y2="86" strokeLinecap="round" />
            <line x1="97" y1="92" x2="110" y2="92" strokeLinecap="round" />
          </g>

          {/* Paw feet */}
          <g className="fox-paws">
            <ellipse cx="46" cy="144" rx="12" ry="6" fill="#B85A2A" />
            <ellipse cx="94" cy="144" rx="12" ry="6" fill="#B85A2A" />
            {/* Toe lines */}
            <line x1="40" y1="143" x2="40" y2="148" stroke="#8B4513" strokeWidth={1} opacity={0.3} />
            <line x1="46" y1="143" x2="46" y2="149" stroke="#8B4513" strokeWidth={1} opacity={0.3} />
            <line x1="52" y1="143" x2="52" y2="148" stroke="#8B4513" strokeWidth={1} opacity={0.3} />
            <line x1="88" y1="143" x2="88" y2="148" stroke="#8B4513" strokeWidth={1} opacity={0.3} />
            <line x1="94" y1="143" x2="94" y2="149" stroke="#8B4513" strokeWidth={1} opacity={0.3} />
            <line x1="100" y1="143" x2="100" y2="148" stroke="#8B4513" strokeWidth={1} opacity={0.3} />
          </g>
        </g>

        {/* Thinking dots */}
        <g className="fox-thinking-dots" opacity={0}>
          <circle cx="55" cy="58" r="3" fill="#F5B041" />
          <circle cx="70" cy="52" r="4" fill="#F5B041" />
          <circle cx="85" cy="58" r="3" fill="#F5B041" />
        </g>

        <style>{`
          .fox-container { transition: transform 200ms ease; }

          /* Idle — gentle sway */
          .mood-idle .fox-core {
            animation: float-gentle 5s ease-in-out infinite;
            transform-origin: 70px 100px;
          }
          .mood-idle .fox-tail {
            animation: fox-tail 2.5s ease-in-out infinite;
          }

          /* Thinking — tilted, dots visible */
          .mood-thinking .fox-core {
            animation: float-gentle 2s ease-in-out infinite;
            transform-origin: 70px 100px;
          }
          .mood-thinking .fox-svg {
            transform: rotate(-5deg);
            transform-origin: 70px 80px;
          }
          .mood-thinking .fox-thinking-dots {
            animation: breathe 1.2s ease-in-out infinite;
          }
          .mood-thinking .fox-eye { transform: scaleY(0.6); transform-origin: center; }

          /* Talking — mouth movement */
          .mood-talking .fox-core {
            animation: float-gentle 3s ease-in-out infinite;
            transform-origin: 70px 100px;
          }
          .mood-talking .fox-mouth {
            animation: breathe 0.4s ease-in-out infinite;
            transform-origin: 70px 96px;
          }

          /* Happy — bounce + big smile */
          .mood-happy .fox-core {
            animation: pop-in 600ms cubic-bezier(0.34,1.56,0.64,1) both;
            transform-origin: 70px 100px;
          }
          .mood-happy .fox-blush ellipse { opacity: 0.4 !important; }
          .mood-happy .fox-eye { animation: breathe 0.8s ease-in-out infinite; }

          /* Wave — one ear waves */
          .mood-wave .fox-core {
            animation: wiggle 0.6s ease-in-out 2;
            transform-origin: 70px 100px;
          }
          .mood-wave .fox-ear.right {
            animation: leaf-sway 0.4s ease-in-out 3;
            transform-origin: 98px 48px;
          }

          /* Giggle — shake */
          .mood-giggle .fox-core {
            animation: wiggle 0.3s ease-in-out 4;
            transform-origin: 70px 100px;
          }
          .mood-giggle .fox-blush ellipse { opacity: 0.45 !important; }
          .mood-giggle .fox-eye { transform: scaleY(0.7); transform-origin: center; }
        `}</style>
      </svg>
    </div>
  );
};

export default ForestFox;
