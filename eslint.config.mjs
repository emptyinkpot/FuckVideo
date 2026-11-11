import { config } from "@remotion/eslint-config-flat";

// Upgrade guard: our code may only use Remotion's public API, so `npx remotion upgrade`
// stays a version bump. Internal entry points change without notice between releases.
const publicRemotionApiOnly = {
  files: ["src/**/*.{ts,tsx}", "videolab/overlay/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["remotion/*", "@remotion/*/*", "!@remotion/cli/config"],
            message: "只用 Remotion 的公开入口（remotion、@remotion/<包名>），不要引用内部路径。",
          },
        ],
        paths: [
          { name: "@remotion/studio", importNames: ["StudioInternals"], message: "StudioInternals 是内部接口。" },
          { name: "remotion", importNames: ["Internals"], message: "Internals 是内部接口。" },
        ],
      },
    ],
  },
};

export default [
  ...(Array.isArray(config) ? config : [config]),
  publicRemotionApiOnly,
];
