#!/usr/bin/env node
import { existsSync } from "node:fs";
import { buildEstimatedCaptionsFromText } from "./subtitle-aligner.mjs";
import { planScenesFromCaptions } from "./scene-planner.mjs";
import { projectToMultiSceneProps, repairProjectTimeline } from "./project-store.mjs";
import { validateAnimationContracts } from "./animation-contracts.mjs";

const text =
  "《朴茨茅斯和约》把关东州租借地与南满铁路转让给日本。旅顺港和大连港成为新的地理支点。";

const captions = buildEstimatedCaptionsFromText(text, 12, { maxChars: 22 });
const scenes = planScenesFromCaptions(captions, {
  fps: 30,
  sourceText: text,
  maxChars: 80,
  assets: [],
});

const project = {
  id: "smoke-minimal",
  title: "最小可靠路径烟测",
  audioSrc: "",
  captions,
  captionStyle: "typewriter",
  progressStyle: "gradient",
  scenes: scenes.map((scene, index) => ({
    id: scene.id,
    index,
    voiceText: scene.narrationText || scene.text,
    subtitle: scene.subtitleText || scene.text,
    sceneType: scene.sceneType,
    visualIntent: scene.visualIntent,
    visualIntentData: scene.visualIntentData,
    semanticCard: scene.semanticCard,
    visualContract: scene.visualContract,
    visualGrounding: scene.visualGrounding,
    visualCandidates: scene.visualCandidates || [],
    decisionTrace: scene.decisionTrace || {},
    visualProviderId: scene.visualProviderId,
    providerType: scene.providerType,
    templateId: scene.templateId,
    category: scene.category,
    startMs: scene.audioStartMs,
    endMs: scene.audioEndMs,
    captionIndex: scene.captionIndex,
    parentCaptionId: scene.parentCaptionId,
    parentCaptionIndex: scene.parentCaptionIndex,
    keywords: scene.keywords || [],
    visualLayer: scene.visualLayer,
    props: scene.props || {},
  })),
  source: { text, createdAt: Date.now() },
};

const timeline = repairProjectTimeline(project, { strict: true });
if (!timeline.ok) {
  fail(`timeline invalid: ${timeline.diagnostics.join("; ")}`);
}

const props = projectToMultiSceneProps(timeline.project);
if (!Array.isArray(props.scenes) || props.scenes.length < 2) {
  fail("expected at least two planned scenes");
}

const templateIds = new Set(props.scenes.map((scene) => scene.templateId));
for (const required of ["DocumentReveal", "MapRouteFlyover"]) {
  if (!templateIds.has(required)) {
    fail(`missing required template in minimal path: ${required}`);
  }
}

for (const scene of props.scenes) {
  if (!scene.durationInFrames || scene.durationInFrames <= 0) {
    fail(`scene has invalid duration: ${scene.id}`);
  }
  if (!scene.props?.title && !scene.props?.body) {
    fail(`scene lacks editable Remotion props: ${scene.id}`);
  }
}

const contracts = validateAnimationContracts();
if (!contracts.ok) {
  fail(`animation contract errors: ${contracts.issues.filter((issue) => issue.level === "error").length}`);
}

if (!existsSync("src/generated/currentMultiSceneDefaultProps.ts")) {
  fail("missing Studio generated props bridge");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      goal: "script -> captions -> semantic scenes -> visual providers -> editable Remotion props",
      captionCount: captions.length,
      sceneCount: props.scenes.length,
      templates: [...templateIds],
      contractWarnings: contracts.issues.filter((issue) => issue.level === "warn").length,
    },
    null,
    2,
  ),
);

function fail(message) {
  console.error(`SMOKE_MINIMAL_FAILED ${message}`);
  process.exit(1);
}
