import { Component, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useThree } from '@react-three/fiber';
import { Stage, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { MinecraftCharacter } from '@frontend/components/MC';

type Params = {
  skin: string;
  mode: 'plane' | 'voxel' | 'cute';
  background: string;
  yaw: number;
  scale: number;
  camY: number;
  targetY: number;
};
type FrameResult = { png: string; time: number; yaw: number; clockTime: number };
declare global {
  interface Window {
    __skinWalkError?: string;
    __skinWalkVideo?: {
      skin: string;
      renderFrame: (time: number, turn: number) => FrameResult;
    };
  }
}

const query = new URLSearchParams(location.search);
const params: Params = {
  skin: query.get('skin') || '',
  mode: query.get('mode') as Params['mode'] || 'plane',
  background: query.get('background') || '#1a1a1a',
  yaw: Number(query.get('yaw') || 0),
  scale: Number(query.get('scale') || 0.82),
  camY: Number(query.get('cam-y') || 18),
  targetY: Number(query.get('target-y') || -0.75),
};
const transparent = params.background === 'transparent';

window.addEventListener('error', event => { window.__skinWalkError = event.message; });
window.addEventListener('unhandledrejection', event => {
  window.__skinWalkError = String(event.reason);
});

class RenderErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { window.__skinWalkError = error.message; }
  render() { return this.state.failed ? null : this.props.children; }
}

function CharacterScene() {
  const texture = useTexture(params.skin);
  const group = useRef<THREE.Group>(null);
  const { advance, gl, clock } = useThree();

  useEffect(() => {
    // frameloop="never" keeps THREE.Clock stopped. advance(seconds) sets the
    // same clock that the frontend Walk implementation already reads. The CLI
    // wraps this time through integer gait cycles to make the output periodic.
    window.__skinWalkVideo = {
      skin: params.skin,
      renderFrame(time, turn) {
        if (!group.current) throw new Error('Character is not mounted');
        const yaw = params.yaw + turn;
        group.current.rotation.y = THREE.MathUtils.degToRad(((yaw % 360) + 360) % 360);
        advance(time, true);
        // ContactShadows subscribes before the child Walk animation. A second
        // pass at the same timestamp captures shadows for the updated pose.
        advance(time, true);
        gl.getContext().finish();
        return { png: gl.domElement.toDataURL('image/png').split(',')[1], time, yaw, clockTime: clock.elapsedTime };
      },
    };
    return () => { delete window.__skinWalkVideo; };
  }, [advance, gl, clock]);

  return (
    <Stage
      environment={null}
      intensity={0.5}
      shadows={transparent ? false : { type: 'contact', opacity: 0.6, blur: 1.5, frames: Infinity }}
      adjustCamera={false}
    >
      <group ref={group} position={[0, -0.5, 0]} scale={params.scale}>
        <MinecraftCharacter texture={texture} mode={params.mode} action="walk" showOverlay />
      </group>
    </Stage>
  );
}

createRoot(document.getElementById('root')!).render(
  <RenderErrorBoundary>
    <Canvas
      frameloop="never"
      dpr={1}
      camera={{ position: [35, params.camY, 35], fov: 40 }}
      shadows={!transparent}
      gl={{ alpha: true, preserveDrawingBuffer: true }}
      onCreated={({ camera, gl }) => {
        camera.lookAt(0, params.targetY, 0);
        if (transparent) gl.setClearColor(0x000000, 0);
      }}
    >
      {!transparent && <color attach="background" args={[params.background]} />}
      <ambientLight intensity={0.6} />
      <spotLight position={[10, 20, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow={!transparent} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} />
      <Suspense fallback={null}><CharacterScene /></Suspense>
    </Canvas>
  </RenderErrorBoundary>,
);
