import { Easing, interpolate } from "remotion";
import type { WarEvent } from "../data/sino-japanese-war.timeline";

export type CameraState = {
  lon: number;
  lat: number;
  zoom: number;
};

export const smooth01 = (value: number) => Easing.bezier(0.4, 0, 0.2, 1)(value);

export const interpolateNumber = (from: number, to: number, progress: number) =>
  from + (to - from) * smooth01(progress);

export const interpolateLonLat = (
  from: [number, number],
  to: [number, number],
  progress: number,
): [number, number] => [
  interpolateNumber(from[0], to[0], progress),
  interpolateNumber(from[1], to[1], progress),
];

export const getTimelineScene = (
  frame: number,
  events: WarEvent[],
  sceneFrames: number,
) => {
  const index = Math.min(Math.floor(frame / sceneFrames), events.length - 1);
  const current = events[index];
  const next = events[index + 1] ?? current;
  const localFrame = frame - index * sceneFrames;
  const rawProgress = interpolate(localFrame, [0, sceneFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return { current, next, progress: smooth01(rawProgress), rawProgress, localFrame, index };
};

export const getCameraState = (
  current: WarEvent,
  next: WarEvent,
  progress: number,
): CameraState => {
  const focus = interpolateLonLat(current.focus, next.focus, progress);

  return {
    lon: focus[0],
    lat: focus[1],
    zoom: interpolateNumber(current.zoom, next.zoom, progress),
  };
};
