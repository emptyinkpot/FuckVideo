// Stage 1 placeholder — real huasheng-style homepage lands in Task #17.
// For now this just confirms the Next dev server boots.

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-bold">huasheng-clone</h1>
      <p className="text-sm text-neutral-500">
        Stage 1 scaffold · web (3000) + api (3001) + worker (3002)
      </p>
      <p className="text-xs text-neutral-400">
        Real homepage UI ships with Task #17.
      </p>
    </main>
  );
}
