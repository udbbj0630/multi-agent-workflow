import React, { CSSProperties, useId } from "react";

type UliMood = "idle" | "thinking" | "talking" | "happy" | "wave" | "giggle";

export interface UliCharacterProps {
  mood?: UliMood;
  size?: number;
  onClick?: () => void;
}

const UliCharacter: React.FC<UliCharacterProps> = ({
  mood = "idle",
  size = 120,
  onClick,
}) => {
  const id = useId().replace(/:/g, "");
  const bodyGradientId = `uli-body-grad-${id}`;
  const bellyGradientId = `uli-belly-grad-${id}`;
  const irisGradientLeftId = `uli-iris-left-${id}`;
  const irisGradientRightId = `uli-iris-right-${id}`;
  const cheekGlowId = `uli-cheek-glow-${id}`;
  const thinkingGlowId = `uli-thinking-glow-${id}`;

  const wrapperStyle: CSSProperties = {
    width: size,
    height: size,
    cursor: onClick ? "pointer" : "default",
  };

  return (
    <div
      className={`uli-container uli-character mood-${mood}`}
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
      aria-label="Uli character"
    >
      <svg
        className="uli-svg"
        viewBox="0 0 140 160"
        width={size}
        height={size}
        aria-hidden="true"
      >
        <defs>
          <radialGradient
            id={bodyGradientId}
            cx="36%"
            cy="28%"
            r="78%"
          >
            <stop offset="0%" stopColor="#8E6BD4" />
            <stop offset="48%" stopColor="#6D49B7" />
            <stop offset="100%" stopColor="#422776" />
          </radialGradient>

          <radialGradient
            id={bellyGradientId}
            cx="50%"
            cy="35%"
            r="80%"
          >
            <stop offset="0%" stopColor="rgba(255,255,255,0.34)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
          </radialGradient>

          <radialGradient id={irisGradientLeftId} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#7BE7FF" />
            <stop offset="55%" stopColor="#6A92FF" />
            <stop offset="100%" stopColor="#2E3D7A" />
          </radialGradient>

          <radialGradient id={irisGradientRightId} cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#7BE7FF" />
            <stop offset="55%" stopColor="#6A92FF" />
            <stop offset="100%" stopColor="#2E3D7A" />
          </radialGradient>

          <filter id={cheekGlowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" />
          </filter>

          <filter id={thinkingGlowId} x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        <g className="uli-character-core">
          <g className="uli-thought-glow" opacity={0}>
            <ellipse
              cx="47"
              cy="14"
              rx="10"
              ry="7"
              fill="#F9E2AF"
              filter={`url(#${thinkingGlowId})`}
            />
            <ellipse
              cx="95"
              cy="13"
              rx="10"
              ry="7"
              fill="#F9E2AF"
              filter={`url(#${thinkingGlowId})`}
            />
          </g>

          <path
            className="uli-antenna-stem"
            d="M50 42 C45 24, 42 16, 47 9"
            fill="none"
            stroke="#81C784"
            strokeWidth={4.4}
            strokeLinecap="round"
          />
          <path
            className="uli-antenna-stem"
            d="M90 42 C95 24, 98 16, 93 9"
            fill="none"
            stroke="#81C784"
            strokeWidth={4.4}
            strokeLinecap="round"
          />

          <path
            className="uli-antenna-leaf"
            d="M44 10
               C35 10, 33 19, 40 23
               C47 25, 53 18, 50 12
               C48 10, 46 9, 44 10 Z"
            fill="#81C784"
          />
          <path
            className="uli-antenna-leaf"
            d="M96 10
               C105 10, 107 19, 100 23
               C93 25, 87 18, 90 12
               C92 10, 94 9, 96 10 Z"
            fill="#81C784"
          />

          <path
            className="uli-arm left"
            d="M34 92
               C20 97, 14 107, 18 120
               C20 126, 28 127, 32 120
               C34 114, 34 103, 39 97"
            fill={`url(#${bodyGradientId})`}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            className="uli-arm right"
            d="M106 90
               C121 94, 127 104, 123 118
               C121 125, 112 126, 108 119
               C105 113, 105 101, 100 95"
            fill={`url(#${bodyGradientId})`}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            className="uli-body"
            d="M70 36
               C44 36, 27 52, 24 79
               C22 102, 29 132, 50 144
               C64 152, 87 151, 101 142
               C118 131, 121 105, 117 81
               C112 54, 99 36, 70 36 Z"
            fill={`url(#${bodyGradientId})`}
          />

          <path
            className="uli-belly"
            d="M69 72
               C51 72, 41 86, 41 106
               C41 126, 50 136, 68 138
               C86 140, 99 130, 99 109
               C99 88, 88 72, 69 72 Z"
            fill={`url(#${bellyGradientId})`}
          />

          <ellipse
            className="uli-blush-glow"
            cx="45"
            cy="87"
            rx="11"
            ry="7"
            fill="#FF7E67"
            opacity={0.18}
            filter={`url(#${cheekGlowId})`}
          />
          <ellipse
            className="uli-blush-glow"
            cx="95"
            cy="87"
            rx="11"
            ry="7"
            fill="#FF7E67"
            opacity={0.18}
            filter={`url(#${cheekGlowId})`}
          />

          <ellipse
            className="uli-cheek"
            cx="45"
            cy="87"
            rx="8"
            ry="5.5"
            fill="#FF7E67"
            opacity={0.5}
            filter={`url(#${cheekGlowId})`}
          />
          <ellipse
            className="uli-cheek"
            cx="95"
            cy="87"
            rx="8"
            ry="5.5"
            fill="#FF7E67"
            opacity={0.5}
            filter={`url(#${cheekGlowId})`}
          />

          <g className="uli-eye left">
            <ellipse
              className="uli-eye-sclera"
              cx="54"
              cy="74"
              rx="12"
              ry="13"
              fill="#FFFDF9"
            />
            <ellipse
              className="uli-eye-iris"
              cx="54"
              cy="76"
              rx="7.2"
              ry="8.2"
              fill={`url(#${irisGradientLeftId})`}
            />
            <ellipse
              className="uli-eye-pupil"
              cx="54"
              cy="77"
              rx="3.5"
              ry="4.3"
              fill="#1A103C"
            />
            <circle className="uli-eye-highlight" cx="51" cy="72" r="1.9" fill="#FFFFFF" />
            <circle className="uli-eye-highlight" cx="56.5" cy="75" r="1.1" fill="#FFFFFF" opacity={0.85} />
            <path
              className="uli-eye-lid"
              d="M43 74 Q54 63 65 74"
              fill="none"
              stroke="#1A103C"
              strokeWidth={3.2}
              strokeLinecap="round"
              opacity={0}
            />
          </g>

          <g className="uli-eye right">
            <ellipse
              className="uli-eye-sclera"
              cx="86"
              cy="74"
              rx="12"
              ry="13"
              fill="#FFFDF9"
            />
            <ellipse
              className="uli-eye-iris"
              cx="86"
              cy="76"
              rx="7.2"
              ry="8.2"
              fill={`url(#${irisGradientRightId})`}
            />
            <ellipse
              className="uli-eye-pupil"
              cx="86"
              cy="77"
              rx="3.5"
              ry="4.3"
              fill="#1A103C"
            />
            <circle className="uli-eye-highlight" cx="83" cy="72" r="1.9" fill="#FFFFFF" />
            <circle className="uli-eye-highlight" cx="88.5" cy="75" r="1.1" fill="#FFFFFF" opacity={0.85} />
            <path
              className="uli-eye-lid"
              d="M75 74 Q86 63 97 74"
              fill="none"
              stroke="#1A103C"
              strokeWidth={3.2}
              strokeLinecap="round"
              opacity={0}
            />
          </g>

          <path
            className="uli-mouth uli-mouth-smile"
            d="M58 98 Q70 108 82 98"
            fill="none"
            stroke="#1A103C"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
};

export default UliCharacter;