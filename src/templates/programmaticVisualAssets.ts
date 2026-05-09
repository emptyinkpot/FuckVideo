export type ProgrammaticVisualAssetSource = {
  id: string;
  sourceUrl: string;
  localPath?: string;
  packageName?: string;
  license: string;
  bestFor: string[];
};

export const programmaticVisualAssetSources: ProgrammaticVisualAssetSource[] = [
  {
    id: "remotion-bits",
    sourceUrl: "https://github.com/av/remotion-bits",
    localPath: "asset-source/programmatic-visual-assets/remotion-bits",
    packageName: "remotion-bits",
    license: "MIT",
    bestFor: ["text_reveal", "camera_motion", "3d_scene", "particles"],
  },
  {
    id: "reactvideoeditor-remotion-templates",
    sourceUrl: "https://github.com/reactvideoeditor/remotion-templates",
    localPath:
      "asset-source/programmatic-visual-assets/reactvideoeditor-remotion-templates",
    license: "MIT",
    bestFor: [
      "noise_grain",
      "film_burn",
      "vignette",
      "text_highlight",
      "transitions",
    ],
  },
  {
    id: "remotion-official-resources",
    sourceUrl: "https://www.remotion.dev/docs/resources",
    localPath:
      "asset-source/programmatic-visual-assets/remotion-official/resources.html",
    license: "Reference only",
    bestFor: ["official_patterns", "implementation_reference"],
  },
  {
    id: "roughjs",
    sourceUrl: "https://github.com/rough-stuff/rough",
    packageName: "roughjs",
    license: "MIT",
    bestFor: ["hand_drawn_highlight", "rough_annotation", "stamp"],
  },
  {
    id: "framer-motion",
    sourceUrl: "https://github.com/motiondivision/motion",
    packageName: "framer-motion",
    license: "MIT",
    bestFor: ["motion_curve_reference", "interactive_react_motion"],
  },
];
