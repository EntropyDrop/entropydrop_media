import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { THREE, World, ContraptionManager, ContraptionPhysics, portableEntityToRuntime } from '@entropydrop/space-engine';
import { buildPhysicsBlueprints, buildPropellerBlades } from '../../04_physics_entity/scripts/nature_physics_models.mjs';
import { buildFlightAircraft } from './aircraft_07.mjs';
import { measureAircraftGeometry, countAircraftCollisionWork } from './measure_aircraft_07.mjs';

const tickSeconds = 0.05;
const tickMs = tickSeconds * 1000;
const poseSize = 10;
const propellerSize = 14;
const propellerRpm = 128;
const propellerRate = propellerRpm * Math.PI / 30;
const origin = [5412, 132, 844];
const xAxis = new THREE.Vector3(1, 0, 0);
const yAxis = new THREE.Vector3(0, 1, 0);
const trackRadius = 30;
const turnRate = 0.32;
const measureWorkload = process.env.SPACE_BENCH_WORKLOAD === '1';
const terrainMode = process.env.SPACE_BENCH_TERRAIN ?? 'world';
assert.ok(terrainMode === 'world' || terrainMode === 'legacy', 'Use world or legacy terrain mode');

function planeBlueprint() {
  const quaternion = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)).toArray();
  return buildFlightAircraft(quaternion, buildPhysicsBlueprints, buildPropellerBlades);
}

function route(player, t, position, velocity) {
  const pair = Math.floor(player / 2);
  const side = player % 2 ? 1 : -1;
  const initialAngle = 1.68 + (pair % 4) * 0.14;
  const angle = initialAngle + t * turnRate;
  // Lane separation closes gradually on selected pairs. The remaining
  // pairs keep a different altitude while following the same circuit.
  const closeTime = Math.max(0, Math.min(1, (t - 1.2 - pair % 4) / 4));
  const separation = 13 - 12.8 * closeTime ** 2 * (3 - 2 * closeTime);
  const radius = trackRadius + side * separation;
  position.set(origin[0] + (pair % 8 - 3.5) * 142 + radius * Math.cos(angle),
    origin[1] + (Math.floor(pair / 8) - 1.5) * 11 + (side > 0 && pair % 3 ? 8 : 0),
    origin[2] + (Math.floor(pair / 8) - 1.5) * 137 + radius * Math.sin(angle));
  velocity.set(-radius * turnRate * Math.sin(angle), 0, radius * turnRate * Math.cos(angle));
}

function flightRotation(velocity, out) {
  return out.setFromAxisAngle(yAxis, Math.atan2(-velocity.z, velocity.x))
    .multiply(new THREE.Quaternion().setFromAxisAngle(xAxis, -0.19));
}

function writePose(buffer, player, entity) {
  const offset = player * poseSize;
  entity.position.toArray(buffer, offset);
  entity.quaternion.toArray(buffer, offset + 3);
  entity.velocity.toArray(buffer, offset + 7);
}

function writePropeller(buffer, player, entity, phase) {
  const offset = player * propellerSize;
  const hub = entity.getRigidBody('hub');
  hub.position.toArray(buffer, offset);
  hub.quaternion.toArray(buffer, offset + 3);
  hub.velocity.toArray(buffer, offset + 7);
  hub.angularVelocity.toArray(buffer, offset + 10);
  buffer[offset + 13] = phase;
}

function setPropeller(entity, phase) {
  const hub = entity.getEntityNode('hub');
  hub.localQuaternion.setFromAxisAngle(xAxis, phase);
  hub.group.quaternion.copy(hub.localQuaternion);
  entity.invalidateCollisionPoseCache();
}

function runPilot({ player, buffers, propellerBuffers }) {
  const poses = buffers.map(buffer => new Float64Array(buffer));
  const propellers = propellerBuffers.map(buffer => new Float64Array(buffer));
  const scene = new THREE.Scene();
  // Use the runtime's terrain queries with no chunks loaded: the workload is
  // airborne physics. Legacy reproduces the original empty adapter and its
  // more expensive per-shape terrain fallback.
  const air = terrainMode === 'world'
    ? new World(scene, 20260827, null, 1, true)
    : {
      terrainVersion: 0,
      getBlock: () => 0,
      getMicroBlocksInAABB: () => [],
      raycast: () => ({ hit: false }),
      raycastMicro: () => ({ hit: false }),
    };
  const manager = new ContraptionManager(scene, air, null, null);
  manager.entityPersistenceMode = 'none';
  manager.syncContraptionsToLoadedChunks = () => {};
  const physics = new ContraptionPhysics(air);
  manager.setPhysics(physics);
  let contact = false;
  const reportContact = physics.recordEntityPairContact.bind(physics);
  physics.recordEntityPairContact = (...args) => {
    contact = true;
    return reportContact(...args);
  };

  const model = planeBlueprint();
  const position = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  let phase = player * 0.37;
  const attitude = new THREE.Quaternion();
  const spawn = (id, active) => {
    const definition = portableEntityToRuntime({
      ...model,
      root: { ...model.root, body: { ...model.root.body, type: active ? 'dynamic' : 'kinematic',
        collisionEnabled: true, useGravity: false, restitution: 0.12 } },
    });
    definition.blocks = definition.blocks.map(block => ({ ...block,
      localX: block.dx + (block.mx ?? 0) / 8,
      localY: block.dy + (block.my ?? 0) / 8,
      localZ: block.dz + (block.mz ?? 0) / 8,
      size: block.mx == null ? 1 : 0.125 }));
    route(id, 0, position, velocity);
    const entity = manager.buildFromSlot(definition, position.clone(), null, false);
    assert.ok(entity, 'The Space engine could not build the chapter 04 aircraft');
    flightRotation(velocity, entity.quaternion);
    entity.position.copy(position).add(entity.localCenter.clone().applyQuaternion(entity.quaternion));
    entity.velocity.copy(velocity);
    setPropeller(entity, id * 0.37);
    entity.syncAllBodyTransforms();
    entity.syncKinematicBodies(0);
    entity.setPhysicsSimulationEnabled(active);
    assert.ok(physics.physicsBoxes(entity).every(box =>
      [box.minX, box.minY, box.minZ, box.maxX, box.maxY, box.maxZ].every(Number.isFinite)),
    'Aircraft has non-finite collision bounds');
    return entity;
  };
  const peer = player ^ 1;
  const aircraft = spawn(player, true);
  const replica = spawn(peer, false);
  const acceleration = new THREE.Vector3();
  const target = new THREE.Vector3();
  // Apply the virtual pilot's output after the engine clears inactive scripts.
  const update = aircraft.update.bind(aircraft);
  aircraft.update = (...args) => {
    update(...args);
    aircraft.applyForce(acceleration.toArray());
  };
  const updateParts = aircraft.updateChildEntities.bind(aircraft);
  aircraft.updateChildEntities = dt => {
    updateParts(dt);
    setPropeller(aircraft, phase);
  };
  writePose(poses[0], player, aircraft);
  writePropeller(propellers[0], player, aircraft, phase);
  const hub = model.root.children[0];
  const modelStats = {
    voxels: model.root.blocks.length + hub.blocks.length,
    decorations: model.root.decorations.length + hub.decorations.length,
    bodies: 2,
    propellerRpm,
  };
  const collisionWork = measureWorkload ? countAircraftCollisionWork(physics) : null;
  const geometry = measureWorkload && player === 0 ? measureAircraftGeometry(aircraft) : null;
  parentPort.postMessage({ ready: true, model: modelStats, geometry });

  parentPort.on('message', tick => {
    const start = performance.now();
    const input = poses[tick % 2];
    const output = poses[(tick + 1) % 2];
    const offset = peer * poseSize;
    replica.position.fromArray(input, offset);
    replica.quaternion.fromArray(input, offset + 3);
    replica.velocity.fromArray(input, offset + 7);
    setPropeller(replica, propellers[tick % 2][peer * propellerSize + 13]);
    replica.syncAllBodyTransforms();
    replica.syncKinematicBodies(tickSeconds);
    phase = player * 0.37 + (tick + 1) * tickSeconds * propellerRate;

    route(player, (tick + 1) * tickSeconds, position, velocity);
    flightRotation(velocity, attitude);
    aircraft.quaternion.slerp(attitude, 0.27);
    target.copy(position).add(aircraft.localCenter.clone().applyQuaternion(attitude));
    acceleration.copy(target).sub(aircraft.position).multiplyScalar(1.35);
    acceleration.addScaledVector(velocity.sub(aircraft.velocity), 2);
    acceleration.clampLength(0, 17);
    acceleration.multiplyScalar(1200);
    contact = false;
    manager.update(tickSeconds, null);
    assert.ok(Number.isFinite(aircraft.position.x), 'Non-finite aircraft state');
    writePose(output, player, aircraft);
    writePropeller(propellers[(tick + 1) % 2], player, aircraft, phase);
    parentPort.postMessage({ ms: performance.now() - start, contact, workload: collisionWork?.() });
  });
}

function hostCpuSeconds() {
  try {
    const stats = readFileSync('/sys/fs/cgroup/cpu.stat', 'utf8');
    return Number(stats.match(/^usage_usec (\d+)$/m)[1]) / 1e6;
  } catch {
    return null;
  }
}

function percentile(samples, fraction) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

async function benchmark(players, seconds) {
  assert.ok(players >= 2 && players <= 64 && players % 2 === 0);
  assert.ok(seconds > 0 && seconds <= 90);
  const cores = os.availableParallelism();
  const buffers = Array.from({ length: 2 }, () => new SharedArrayBuffer(players * poseSize * 8));
  const poses = buffers.map(buffer => new Float64Array(buffer));
  const propellerBuffers = Array.from({ length: 2 }, () => new SharedArrayBuffer(players * propellerSize * 8));
  const propellers = propellerBuffers.map(buffer => new Float64Array(buffer));
  const pilots = Array.from({ length: players }, (_, player) => new Worker(new URL(import.meta.url),
    { workerData: { player, buffers, propellerBuffers }, resourceLimits: { maxOldGenerationSizeMb: 512 } }));
  let failure;
  for (const worker of pilots) worker.on('error', error => { failure = error; });
  const next = worker => new Promise((resolve, reject) => {
    const receive = data => { worker.off('error', reject); resolve(data); };
    worker.once('message', receive);
    worker.once('error', reject);
  });
  try {
    const ready = await Promise.all(pilots.map(next));
    assert.ok(ready.every(x => x.ready));
    console.error(`Ready: ${players} virtual pilots, ${cores} available cores`);

    const baselineBefore = hostCpuSeconds();
    const baselineStart = performance.now();
    await sleep(3500);
    const baselineAfter = hostCpuSeconds();
    const baselineSeconds = (performance.now() - baselineStart) / 1000;
    const cpuInitial = hostCpuSeconds();
    const started = performance.now();
    const trace = [];
    const cpu = [];
    const stepTimes = [];
    const workloadTicks = measureWorkload ? [] : null;
    const pilotTimes = [];
    const eventTimes = [];
    let contactPairTicks = 0;
    let previousContacts = new Set();
    let previousCpu = cpuInitial;
    let previousAt = started;
    const steps = Math.round(seconds / tickSeconds);
    for (let tick = 0; tick < steps; tick++) {
      if (failure) throw failure;
      const deadline = started + tick * tickMs;
      const remaining = deadline - performance.now();
      if (remaining > 0) await sleep(remaining);
      const jobs = pilots.map(next);
      const stepStarted = performance.now();
      for (const pilot of pilots) pilot.postMessage(tick);
      const reports = await Promise.all(jobs);
      const stepElapsed = performance.now() - stepStarted;
      stepTimes.push(stepElapsed);
      if (workloadTicks) {
        workloadTicks.push({
          tick: tick + 1,
          exactPairs: reports.reduce((sum, report) => sum + report.workload.exactPairs, 0),
          sweptPairs: reports.reduce((sum, report) => sum + report.workload.sweptPairs, 0),
        });
      }
      pilotTimes.push(...reports.map(report => report.ms));
      const hits = new Set();
      for (const [idx, report] of reports.entries()) if (report.contact) hits.add(Math.floor(idx / 2));
      contactPairTicks += hits.size;
      for (const pair of hits) if (!previousContacts.has(pair)) eventTimes.push({ pair, tick: tick + 1 });
      previousContacts = hits;
      // Preserve the parent trajectory and the separate rotating body's pose.
      const roundPose = value => Math.round(value * 10000) / 10000;
      trace.push({
        tick: tick + 1,
        poses: Array.from(poses[(tick + 1) % 2], roundPose),
        propellers: Array.from(propellers[(tick + 1) % 2], roundPose),
        contacts: [...hits],
      });
      const now = performance.now();
      if (now - previousAt >= 990 || tick + 1 === steps) {
        const currentCpu = hostCpuSeconds();
        if (currentCpu !== null && previousCpu !== null) {
          const usedCores = (currentCpu - previousCpu) * 1000 / (now - previousAt);
          cpu.push({ t: Math.round((now - started) / 10) / 100,
            cpuPct: usedCores * 100 / cores, usedCores, tick: tick + 1 });
        }
        previousCpu = currentCpu;
        previousAt = now;
      }
      if ((tick + 1) % 100 === 0 || tick + 1 === steps) console.error(`Completed ${tick + 1}/${steps} ticks`);
    }
    const settle = started + steps * tickMs - performance.now();
    if (settle > 0) await sleep(settle);
    const wallSeconds = (performance.now() - started) / 1000;
    const cpuEnd = hostCpuSeconds();
    const averageUsedCores = cpuEnd === null || cpuInitial === null ? null : (cpuEnd - cpuInitial) / wallSeconds;
    return {
      summary: { players, cores, terrainMode, topology: 'one Space engine worker per virtual pilot, separated two-plane flight areas',
        simulatedSeconds: steps * tickSeconds, wallSeconds, tickHzTarget: 20, realizedHz: steps / wallSeconds,
        model: ready[0].model, contactEvents: eventTimes.length, contactPairTicks, pairsWithContact: new Set(eventTimes.map(event => event.pair)).size,
        tickWallP50Ms: percentile(stepTimes, .5), tickWallP95Ms: percentile(stepTimes, .95),
        pilotStepP95Ms: percentile(pilotTimes, .95), ticksOverBudget: stepTimes.filter(elapsed => elapsed > tickMs).length,
        baselineCoreEquivalents: baselineAfter === null || baselineBefore === null ? null : (baselineAfter - baselineBefore) / baselineSeconds,
        averageUsedCores, averageCpuPct: averageUsedCores === null ? null : averageUsedCores * 100 / cores,
        oneSecondPeakCpuPct: cpu.length ? Math.max(...cpu.filter((_,i) => i < cpu.length - 1 || cpu.length===1).map(sample => sample.cpuPct)) : null },
      cpu, eventTimes, trace,
      ...(workloadTicks ? { workload: { geometry: ready[0].geometry, ticks: workloadTicks } } : {}),
    };
  } finally {
    await Promise.all(pilots.map(pilot => pilot.terminate()));
  }
}

if (isMainThread) {
  const players = Number(process.argv[2] || 50);
  const seconds = Number(process.argv[3] || 25);
  process.stdout.write(JSON.stringify(await benchmark(players, seconds)) + '\n');
} else {
  runPilot(workerData);
}
