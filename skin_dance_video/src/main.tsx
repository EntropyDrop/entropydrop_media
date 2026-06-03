import React from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stage } from '@react-three/drei';
import * as THREE from 'three';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { MinecraftCharacter } from './MC';
import './style.css';

const DEFAULT_SKIN = '/generated/placeholder_skin.svg';
const DEFAULT_DANCE = '/fbx/Breakdance 1990.fbx';

type RenderParams = {
  skin: string;
  action: 'dance' | 'walking';
  dance: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  warmup: number;
  mode: 'voxel' | 'plane';
  background: string;
  transparent: boolean;
  yaw: number;
  spin: boolean;
  scale: number;
  camY: number;
  record: boolean;
  upload: string;
};

declare global {
  interface Window {
    __skinDanceStatus?: string;
    __skinDanceError?: string;
  }
}

function boolParam(value: string | null, fallback = false) {
  if (value == null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function numberParam(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getParams(): RenderParams {
  const params = new URLSearchParams(window.location.search);
  const background = params.get('background') || '#12151f';
  const transparent = background === 'transparent' || boolParam(params.get('transparent'));
  return {
    skin: params.get('skin') || DEFAULT_SKIN,
    action: (params.get('action') === 'walking' || boolParam(params.get('walk'))) ? 'walking' : 'dance',
    dance: params.get('dance') || DEFAULT_DANCE,
    duration: Math.max(0.25, numberParam(params.get('duration'), 6)),
    fps: Math.max(1, Math.round(numberParam(params.get('fps'), 30))),
    width: Math.max(1, Math.round(numberParam(params.get('width'), 1080))),
    height: Math.max(1, Math.round(numberParam(params.get('height'), 1920))),
    warmup: Math.max(0, Math.round(numberParam(params.get('warmup'), 1500))),
    mode: params.get('mode') === 'plane' ? 'plane' : 'voxel',
    background: transparent ? 'transparent' : background,
    transparent,
    yaw: THREE.MathUtils.degToRad(numberParam(params.get('yaw'), -18)),
    spin: boolParam(params.get('spin'), false),
    scale: numberParam(params.get('scale'), 1),
    camY: numberParam(params.get('cam-y') || params.get('camY') || params.get('cam_y'), 24),
    record: boolParam(params.get('record'), false),
    upload: params.get('upload') || '',
  };
}

function Recorder({ params }: { params: RenderParams }) {
  const [status, setStatus] = useState(params.record ? 'warming up' : 'preview');

  useEffect(() => {
    window.__skinDanceStatus = status;
  }, [status]);

  useEffect(() => {
    if (!params.record) return;

    let recorder: MediaRecorder | null = null;
    let timeoutId = 0;
    let frameTimer = 0;
    let stopped = false;

    async function record() {
      try {
        setStatus('recording');
        const canvas = document.querySelector('canvas');
        if (!canvas) throw new Error('Canvas not found');

        const stream = canvas.captureStream(params.fps);
        const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
        const preferredTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
        ];
        const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type)) || '';
        const chunks: BlobPart[] = [];

        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = async () => {
          if (stopped) return;
          stopped = true;
          try {
            const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
            if (blob.size === 0) throw new Error('MediaRecorder produced an empty video');
            setStatus('uploading');
            if (!params.upload) throw new Error('Upload URL missing');
            const response = await fetch(params.upload, {
              method: 'POST',
              headers: { 'Content-Type': blob.type || 'video/webm' },
              body: blob,
            });
            if (!response.ok) throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            setStatus('done');
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            window.__skinDanceError = message;
            setStatus(`error: ${message}`);
            if (params.upload) {
              fetch(params.upload, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: message }),
              }).catch(() => undefined);
            }
          }
        };

        recorder.start(100);
        if (track && 'requestFrame' in track) {
          frameTimer = window.setInterval(() => track.requestFrame(), Math.max(16, Math.floor(1000 / params.fps)));
        }
        window.setTimeout(() => {
          if (recorder && recorder.state !== 'inactive') {
            if (frameTimer) window.clearInterval(frameTimer);
            track?.requestFrame?.();
            recorder.requestData();
            recorder.stop();
          }
        }, params.duration * 1000);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        window.__skinDanceError = message;
        setStatus(`error: ${message}`);
        if (params.upload) {
          fetch(params.upload, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: message }),
          }).catch(() => undefined);
        }
      }
    }

    timeoutId = window.setTimeout(record, params.warmup);
    return () => {
      window.clearTimeout(timeoutId);
      if (frameTimer) window.clearInterval(frameTimer);
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    };
  }, [params]);

  return <div className="status">{status}</div>;
}

function CharacterScene({ params }: { params: RenderParams }) {
  const groupRef = useRef<THREE.Group | null>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = params.yaw + (params.spin ? clock.getElapsedTime() * 0.45 : 0);
  });

  return (
    <Stage environment={null} intensity={0.5} shadows={params.transparent ? false : 'contact'} adjustCamera={false}>
      <group ref={groupRef} position={[0, -0.5, 0]} scale={params.scale}>
        <MinecraftCharacter
          textureUrl={params.skin}
          mode={params.mode}
          action={params.action}
          fbxUrl={params.action === 'dance' ? params.dance : undefined}
          showOverlay
        />
      </group>
    </Stage>
  );
}

function App() {
  const params = useMemo(getParams, []);

  useEffect(() => {
    document.documentElement.style.width = `${params.width}px`;
    document.documentElement.style.height = `${params.height}px`;
    document.body.style.width = `${params.width}px`;
    document.body.style.height = `${params.height}px`;
    document.body.style.background = params.transparent ? 'transparent' : params.background;
  }, [params]);

  return (
    <div className="page" style={{ width: params.width, height: params.height }}>
      <Canvas
        camera={{ position: [32, params.camY, 44], fov: 34 }}
        shadows={!params.transparent}
        gl={{ alpha: params.transparent, preserveDrawingBuffer: true, antialias: false }}
        resize={{ offsetSize: true }}
      >
        {!params.transparent && <color attach="background" args={[params.background]} />}
        <ambientLight intensity={0.65} />
        <spotLight position={[12, 22, 12]} angle={0.24} penumbra={0.8} intensity={1.6} castShadow={!params.transparent} />
        <pointLight position={[-14, 8, -12]} intensity={0.45} />
        <Suspense fallback={null}>
          <CharacterScene params={params} />
        </Suspense>
        <OrbitControls makeDefault enableDamping={false} enableZoom={false} enablePan={false} target={[0, 1.5, 0]} />
      </Canvas>
      <Recorder params={params} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <App />
);
