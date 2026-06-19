// Stage 1 placeholder Root for the Remotion studio / bundler.
// Compositions are registered here once Task #11 ports them from remotion-project.

import { Composition } from 'remotion';
import React from 'react';

// Throw-away placeholder so `remotion preview` doesn't crash on an empty Root.
const PlaceholderComposition: React.FC = () => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      color: '#fff',
      fontSize: 48,
    }}
  >
    huasheng-clone · compositions pending Task #11
  </div>
);

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Placeholder"
      component={PlaceholderComposition}
      durationInFrames={60}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
