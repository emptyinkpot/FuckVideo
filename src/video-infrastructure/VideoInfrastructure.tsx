import {useCurrentFrame, useVideoConfig} from "remotion";
import {activeCaptionAt, CaptionOverlay} from "./caption-overlays";
import {VideoProgressBar} from "./progress-bars";
import type {CaptionLayout, CaptionStyle, ProgressLayout, ProgressSegment, ProgressStyle, VideoInfrastructureProps} from "./types";

export const VideoInfrastructure = ({
  captions = [],
  captionStyle = "typewriter",
  progressStyle = "gradient",
  progressSegments = [],
  captionLayout,
  progressLayout,
}: VideoInfrastructureProps) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const timeMs = (frame / fps) * 1000;
  const caption = activeCaptionAt(captions, timeMs);
  const defaultCaptionBottom = 34;
  const resolvedCaptionLayout = {
    ...captionLayout,
    bottom: captionLayout?.bottom ?? defaultCaptionBottom,
  };

  return (
    <>
      <CaptionOverlay
        caption={caption}
        frame={frame}
        timeMs={timeMs}
        style={captionStyle}
        layout={resolvedCaptionLayout}
      />
      <VideoProgressBar
        frame={frame}
        style={progressStyle}
        segments={progressSegments}
        layout={progressLayout}
      />
    </>
  );
};

export {activeCaptionAt, CaptionOverlay, VideoProgressBar};
export type {CaptionLayout, CaptionStyle, ProgressLayout, ProgressSegment, ProgressStyle, VideoInfrastructureProps};
