import type {NarratedCaption} from "../templates/NarratedVideo";

export type CaptionStyle = "typewriter" | "classic" | "none";

export type ProgressStyle = "gradient" | "thin" | "none";

export type ProgressSegment = {
  id: string;
  title: string;
  startMs: number;
  endMs: number;
  color?: string;
};

export type CaptionLayout = {
  left?: number;
  right?: number;
  bottom?: number;
  minHeight?: number;
  paddingX?: number;
  paddingY?: number;
  fontSize?: number;
  borderRadius?: number;
  textColor?: string;
  backgroundColor?: string;
  fontWeight?: number;
  lineHeight?: number;
};

export type ProgressLayout = {
  left?: number;
  right?: number;
  bottom?: number;
  height?: number;
  gap?: number;
  paddingX?: number;
  labelFontSize?: number;
  minSegmentWidth?: number;
};

export type VideoInfrastructureProps = {
  captions?: NarratedCaption[];
  captionStyle?: CaptionStyle;
  progressStyle?: ProgressStyle;
  progressSegments?: ProgressSegment[];
  captionLayout?: CaptionLayout;
  progressLayout?: ProgressLayout;
};
