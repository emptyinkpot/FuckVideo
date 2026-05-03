import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

const roads = [
  "M60 420 C180 360 210 240 360 220 C520 198 590 120 760 150 C910 178 970 310 1210 280",
  "M110 150 C260 210 330 315 455 332 C610 354 680 250 830 250 C990 250 1050 390 1190 430",
  "M180 620 C300 510 410 500 520 540 C650 588 745 494 820 410 C910 310 1040 230 1200 160",
  "M40 310 C220 330 320 410 420 480 C560 580 720 650 910 610 C1040 582 1110 520 1240 550",
  "M250 80 C290 220 275 350 350 500 C430 660 590 690 735 610 C880 530 930 385 1010 220",
  "M700 70 C650 195 662 310 735 424 C810 540 934 600 1100 660",
];

const districts = [
  { x: 170, y: 120, w: 240, h: 150, color: "#dbeafe" },
  { x: 486, y: 96, w: 210, h: 140, color: "#dcfce7" },
  { x: 830, y: 115, w: 280, h: 160, color: "#fee2e2" },
  { x: 130, y: 445, w: 300, h: 155, color: "#fef3c7" },
  { x: 520, y: 420, w: 260, h: 170, color: "#ede9fe" },
  { x: 910, y: 430, w: 250, h: 145, color: "#cffafe" },
];

const pins = [
  { x: 210, y: 424, label: "起点", delay: 15 },
  { x: 510, y: 332, label: "枢纽", delay: 66 },
  { x: 820, y: 252, label: "北线", delay: 108 },
  { x: 1080, y: 388, label: "终点", delay: 150 },
];

export type MapRouteFlyoverProps = {
  title?: string;
  subtitle?: string;
  backgroundColor?: string;
  routeColor?: string;
  glowColor?: string;
};

export const MapRouteFlyover = ({
  title = "路线飞越",
  subtitle = "地图导航风格动画",
  backgroundColor = "#09111f",
  routeColor = "#06b6d4",
  glowColor = "#0891b2",
}: MapRouteFlyoverProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = spring({ frame, fps, config: { damping: 90, stiffness: 120 } });
  const routeProgress = interpolate(frame, [32, 180], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const zoom = interpolate(frame, [0, 210], [1.16, 0.96], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panX = interpolate(frame, [0, 210], [-54, 28], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panY = interpolate(frame, [0, 210], [34, -16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: backgroundColor,
        overflow: "hidden",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -90,
          background:
            "radial-gradient(circle at 50% 45%, rgba(56,189,248,0.22), transparent 42%), linear-gradient(135deg, #0f766e, #172554 52%, #111827)",
        }}
      />
      <svg
        viewBox="0 0 1280 720"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          transform: `perspective(900px) rotateX(50deg) rotateZ(-7deg) translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "50% 58%",
          opacity: interpolate(intro, [0, 1], [0, 1]),
        }}
      >
        <defs>
          <filter id="mapGlow">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x="0" y="0" width="1280" height="720" fill="#d9eee7" />
        {districts.map((district) => (
          <rect
            key={`${district.x}-${district.y}`}
            x={district.x}
            y={district.y}
            width={district.w}
            height={district.h}
            rx="26"
            fill={district.color}
            opacity="0.72"
          />
        ))}
        {roads.map((road) => (
          <path
            key={road}
            d={road}
            fill="none"
            stroke="#f8fafc"
            strokeWidth="34"
            strokeLinecap="round"
            opacity="0.82"
          />
        ))}
        {roads.map((road) => (
          <path
            key={`${road}-line`}
            d={road}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="3"
            strokeDasharray="12 16"
            strokeLinecap="round"
            opacity="0.56"
          />
        ))}
        <path
          d="M210 424 C320 382 400 332 510 332 C640 332 698 252 820 252 C960 252 1008 340 1080 388"
          fill="none"
          stroke={glowColor}
          strokeWidth="48"
          strokeLinecap="round"
          opacity="0.2"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - routeProgress}
        />
        <path
          d="M210 424 C320 382 400 332 510 332 C640 332 698 252 820 252 C960 252 1008 340 1080 388"
          fill="none"
          stroke={routeColor}
          strokeWidth="14"
          strokeLinecap="round"
          filter="url(#mapGlow)"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - routeProgress}
        />
        {pins.map((pin) => {
          const pop = spring({ frame: frame - pin.delay, fps, config: { damping: 11, stiffness: 160 } });
          const pulse = 1 + Math.sin(frame / 8 + pin.delay) * 0.08;

          return (
            <g key={pin.label} transform={`translate(${pin.x} ${pin.y}) scale(${pop * pulse})`}>
              <circle r="34" fill="#ef4444" opacity="0.18" />
              <circle r="15" fill="#ef4444" stroke="#ffffff" strokeWidth="5" />
              <text
                x="0"
                y="-34"
                textAnchor="middle"
                fontSize="24"
                fontWeight="800"
                fill="#0f172a"
              >
                {pin.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          left: 76,
          top: 64,
          color: "white",
          transform: `translateY(${interpolate(intro, [0, 1], [26, 0])}px)`,
          opacity: intro,
        }}
      >
        <div style={{ fontSize: 58, fontWeight: 900, lineHeight: 1 }}>{title}</div>
        <div style={{ marginTop: 14, fontSize: 24, color: "#bae6fd", fontWeight: 700 }}>
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export type AtlasMapFlyoverProps = {
  title?: string;
  subtitle?: string;
  textureSrc?: string;
  routeColor?: string;
  overlayOpacity?: number;
};

export const AtlasMapFlyover = ({
  title = "世界地图飞越",
  subtitle = "Natural Earth 真实地图纹理",
  textureSrc = "maps/natural-earth-world-4096.jpg",
  routeColor = "#f97316",
  overlayOpacity = 0.86,
}: AtlasMapFlyoverProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const intro = spring({ frame, fps, config: { damping: 90, stiffness: 120 } });
  const zoom = interpolate(frame, [0, 240], [1.38, 1.02], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panX = interpolate(frame, [0, 240], [-170, 80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const panY = interpolate(frame, [0, 240], [52, -24], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const routeProgress = interpolate(frame, [42, 190], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "#07111f",
        overflow: "hidden",
        fontFamily: "Inter, Arial, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: -150,
          transform: `perspective(1000px) rotateX(38deg) rotateZ(-5deg) translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: "50% 55%",
          opacity: intro,
        }}
      >
        <Img
          src={staticFile(textureSrc)}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "saturate(1.18) contrast(1.05)",
          }}
        />
        <svg viewBox="0 0 1280 720" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <filter id="atlasGlow">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M278 330 C400 300 530 284 640 312 C770 344 855 288 982 260"
            fill="none"
            stroke="#ffffff"
            strokeWidth="34"
            strokeLinecap="round"
            opacity="0.25"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - routeProgress}
          />
          <path
            d="M278 330 C400 300 530 284 640 312 C770 344 855 288 982 260"
            fill="none"
            stroke={routeColor}
            strokeWidth="12"
            strokeLinecap="round"
            filter="url(#atlasGlow)"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - routeProgress}
          />
          {[
            { x: 278, y: 330, label: "北美", delay: 34 },
            { x: 640, y: 312, label: "大西洋", delay: 92 },
            { x: 982, y: 260, label: "欧洲", delay: 150 },
          ].map((pin) => {
            const pop = spring({ frame: frame - pin.delay, fps, config: { damping: 12, stiffness: 160 } });

            return (
              <g key={pin.label} transform={`translate(${pin.x} ${pin.y}) scale(${pop})`}>
                <circle r="28" fill={routeColor} opacity="0.22" />
                <circle r="11" fill={routeColor} stroke="#fff7ed" strokeWidth="4" />
                <text
                  x="0"
                  y="-30"
                  textAnchor="middle"
                  fontSize="20"
                  fontWeight="900"
                  fill="#ffffff"
                  stroke="#0f172a"
                  strokeWidth="4"
                  paintOrder="stroke"
                >
                  {pin.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            `linear-gradient(90deg, rgba(7,17,31,${overlayOpacity}), transparent 35%, transparent 70%, rgba(7,17,31,0.62))`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 58,
          color: "white",
          opacity: intro,
          textShadow: "0 0 26px rgba(0,0,0,0.55)",
        }}
      >
        <div style={{ fontSize: 58, fontWeight: 900, lineHeight: 1 }}>{title}</div>
        <div style={{ marginTop: 14, fontSize: 24, color: "#fed7aa", fontWeight: 800 }}>
          {subtitle}
        </div>
      </div>
    </AbsoluteFill>
  );
};
