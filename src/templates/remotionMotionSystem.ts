import { Easing, interpolate, spring } from "remotion";

export const motionEase = {
  standard: Easing.bezier(0.22, 1, 0.36, 1),
  emphasis: Easing.bezier(0.16, 1, 0.3, 1),
  measured: Easing.bezier(0.2, 0, 0, 1),
};

export const motionDuration = {
  fast: 18,
  normal: 32,
  slow: 52,
  camera: 90,
};

export const springPreset = {
  soft: { damping: 24, stiffness: 92 },
  firm: { damping: 28, stiffness: 130 },
  stamp: { damping: 13, stiffness: 170 },
};

export const timedProgress = (
  frame: number,
  start: number,
  duration = motionDuration.normal,
  easing = motionEase.standard,
) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

export const softSpring = ({
  frame,
  fps,
  delay = 0,
}: {
  frame: number;
  fps: number;
  delay?: number;
}) =>
  spring({
    frame: frame - delay,
    fps,
    config: springPreset.soft,
  });

export const stampSpring = ({
  frame,
  fps,
  delay = 0,
}: {
  frame: number;
  fps: number;
  delay?: number;
}) =>
  spring({
    frame: frame - delay,
    fps,
    config: springPreset.stamp,
  });

export const yEnter = (
  progress: number,
  distance = 34,
  fromScale = 0.985,
) => ({
  opacity: progress,
  transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px) scale(${interpolate(
    progress,
    [0, 1],
    [fromScale, 1],
  )})`,
});

export const xEnter = (
  progress: number,
  distance = -32,
  fromScale = 0.99,
) => ({
  opacity: progress,
  transform: `translateX(${interpolate(progress, [0, 1], [distance, 0])}px) scale(${interpolate(
    progress,
    [0, 1],
    [fromScale, 1],
  )})`,
});

export const cameraPush = (
  frame: number,
  start = 80,
  duration = motionDuration.camera,
  amount = 0.055,
) =>
  interpolate(frame, [start, start + duration], [1, 1 + amount], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: motionEase.standard,
  });
