import { useState } from 'react';
import { session } from './lib/api';
import { usePath } from './lib/router';
import { Atmosphere } from './components/Chrome';
import { TimeMachine } from './components/TimeMachine';
import { HowItWorks } from './pages/HowItWorks';
import { Keepsake } from './pages/Keepsake';
import { Landing } from './pages/Landing';
import { Open } from './pages/Open';
import { Vigil } from './pages/Vigil';
import { Witness } from './pages/Witness';
import { Write } from './pages/Write';

function Route({ path, hash }: { path: string; hash: string }) {
  const [, setLost] = useState(0);
  const witness = path.match(/^\/witness\/([A-Za-z0-9_-]+)$/);
  if (witness) return <Witness token={witness[1]!} />;
  const open = path.match(/^\/open\/([A-Za-z0-9_-]+)$/);
  if (open) return <Open token={open[1]!} hash={hash} />;
  const keepsake = path.match(/^\/keepsake\/([A-Za-z0-9_-]+)$/);
  if (keepsake) return <Keepsake letterId={keepsake[1]!} hash={hash} />;
  if (path === '/how-it-works') return <HowItWorks />;
  if (session.token()) {
    if (path === '/write') return <Write />;
    return <Vigil onLost={() => setLost((n) => n + 1)} />;
  }
  return <Landing />;
}

export function App() {
  const { path, hash } = usePath();
  return (
    <>
      <Atmosphere />
      <Route key={path} path={path} hash={hash} />
      <TimeMachine />
    </>
  );
}
