import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const particles = Array.from({ length: 54 }, (_, index) => ({
  angle: index * 0.62,
  orbit: 150 + (index % 9) * 31,
  size: 3 + (index % 5),
  speed: 0.55 + (index % 7) * 0.08,
  hue: index % 3 === 0 ? "#66f7ff" : index % 3 === 1 ? "#ff4fd8" : "#fff36b",
}));

const rings = Array.from({ length: 8 }, (_, index) => ({
  size: 170 + index * 64,
  delay: index * 9,
  color: index % 2 === 0 ? "rgba(102, 247, 255, 0.55)" : "rgba(255, 79, 216, 0.45)",
}));

export const MyComposition = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({ frame, fps, config: { damping: 90, mass: 0.8 } });
  const drift = interpolate(frame, [0, 240], [0, 1]);
  const pulse = Math.sin(frame / 7) * 0.5 + 0.5;
  const cameraScale = interpolate(frame, [0, 210], [1.08, 0.94]);
  const titleOpacity = interpolate(frame, [22, 52, 190, 225], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at 50% 47%, #17345a 0%, #07111f 42%, #02030a 100%)",
        color: "white",
        fontFamily: "Inter, Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      <AbsoluteFill
        style={{
          transform: `scale(${cameraScale}) rotate(${drift * -1.6}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -100,
            backgroundImage:
              "linear-gradient(rgba(102, 247, 255, 0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 79, 216, 0.13) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            transform: `perspective(520px) rotateX(64deg) translateY(${frame * 3.2}px)`,
            transformOrigin: "50% 70%",
            opacity: 0.55,
          }}
        />

        {rings.map((ring, index) => {
          const ringPulse =
            interpolate((frame + ring.delay) % 90, [0, 90], [0.65, 1.35]) *
            entrance;

          return (
            <div
              key={ring.size}
              style={{
                position: "absolute",
                left: 640 - ring.size / 2,
                top: 360 - ring.size / 2,
                width: ring.size,
                height: ring.size,
                borderRadius: "50%",
                border: `2px solid ${ring.color}`,
                boxShadow: `0 0 ${24 + index * 6}px ${ring.color}`,
                opacity: interpolate(ringPulse, [0.65, 1.35], [0.95, 0.05]),
                transform: `scale(${ringPulse}) rotate(${frame * (0.9 + index * 0.18)}deg)`,
              }}
            />
          );
        })}

        {particles.map((particle, index) => {
          const angle = particle.angle + frame * 0.018 * particle.speed;
          const x = 640 + Math.cos(angle) * particle.orbit;
          const y = 360 + Math.sin(angle) * particle.orbit * 0.48;
          const glow = 14 + pulse * 18;

          return (
            <div
              key={`${particle.angle}-${particle.orbit}`}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: particle.size,
                height: particle.size,
                borderRadius: "50%",
                background: particle.hue,
                boxShadow: `0 0 ${glow}px ${particle.hue}`,
                opacity: 0.65 + ((index + frame) % 20) / 70,
                transform: `translate(-50%, -50%) scale(${entrance})`,
              }}
            />
          );
        })}

        <div
          style={{
            position: "absolute",
            left: 440,
            top: 168,
            width: 400,
            height: 400,
            borderRadius: "50%",
            background:
              "conic-gradient(from 90deg, transparent 0deg, #66f7ff 52deg, transparent 86deg, #ff4fd8 176deg, transparent 218deg, #fff36b 290deg, transparent 330deg)",
            filter: "blur(0.4px)",
            opacity: 0.9,
            transform: `rotate(${frame * 2.8}deg) scale(${0.78 + entrance * 0.22})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 505,
            top: 233,
            width: 270,
            height: 270,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.96) 0%, rgba(102,247,255,0.86) 18%, rgba(255,79,216,0.42) 42%, transparent 70%)",
            boxShadow: `0 0 ${80 + pulse * 50}px rgba(102, 247, 255, 0.75)`,
            transform: `scale(${0.88 + pulse * 0.08})`,
          }}
        />
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(255,79,216,0.16), transparent 22%, transparent 78%, rgba(102,247,255,0.18))",
          mixBlendMode: "screen",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 282,
          textAlign: "center",
          opacity: titleOpacity,
          transform: `translateY(${interpolate(entrance, [0, 1], [44, 0])}px)`,
          textShadow: "0 0 28px rgba(102,247,255,0.9), 0 0 52px rgba(255,79,216,0.55)",
        }}
      >
        <div
          style={{
            fontSize: 86,
            fontWeight: 900,
            letterSpacing: 0,
            lineHeight: 1,
          }}
        >
          REMOTION CORE
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 28,
            fontWeight: 700,
            color: "#b9faff",
            textTransform: "uppercase",
          }}
        >
          procedural motion system online
        </div>
      </div>
    </AbsoluteFill>
  );
};
