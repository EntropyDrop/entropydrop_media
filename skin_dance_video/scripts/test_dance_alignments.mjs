import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { createDanceRotationCorrections } from '../src/danceAlignments.ts';

const corrections = createDanceRotationCorrections();
const tolerance = 1e-5;
const down = new THREE.Vector3(0, -1, 0);
const width = new THREE.Vector3(1, 0, 0);
const front = new THREE.Vector3(0, 0, 1);
const oldCorrection = new THREE.Quaternion().setFromAxisAngle(front, Math.PI).invert();
const near = (actual, expected, label) => {
    assert.ok(actual.distanceTo(expected) < tolerance, `${label}: ${actual.toArray()} != ${expected.toArray()}`);
};

for (const side of ['left', 'right']) {
    const correction = corrections[`${side}_arm`];
    near(down.clone().applyQuaternion(correction), new THREE.Vector3(0, 1, 0), `${side} limb length axis`);
    near(width.clone().applyQuaternion(correction), new THREE.Vector3(0, 0, side === 'left' ? -1 : 1), `${side} width / elbow hinge axis`);
    near(front.clone().applyQuaternion(correction), new THREE.Vector3(side === 'left' ? -1 : 1, 0, 0), `${side} depth axis`);

    const bend = new THREE.Quaternion().setFromAxisAngle(front, side === 'left' ? 0.7 : -0.7);
    const localBend = correction.clone().invert().multiply(bend).multiply(correction);
    near(down.clone().applyQuaternion(localBend), new THREE.Vector3(0, -Math.cos(0.7), Math.sin(0.7)), `${side} elbow flexes forward`);
}

// Exercise the real dance across its full cycle: changing the cross-section
// orientation must not change any upper-arm or forearm centerline.
const bytes = fs.readFileSync(new URL('../public/fbx/Breakdance Uprock Var 2.fbx', import.meta.url));
const fbx = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const mixer = new THREE.AnimationMixer(fbx);
mixer.clipAction(fbx.animations[0]).play();
for (let time = 0; time < fbx.animations[0].duration; time += 0.1) {
    mixer.setTime(time);
    fbx.updateMatrixWorld(true);
    for (const side of ['left', 'right']) {
        for (const segment of ['up', 'low']) {
            const bone = fbx.getObjectByName(`${side}_${segment}_arm`);
            assert.ok(bone, 'FBX arm bone exists');
            const world = bone.getWorldQuaternion(new THREE.Quaternion());
            const mapped = world.clone().multiply(corrections[`${side}_${segment === 'low' ? 'low_' : ''}arm`]);
            const previous = world.clone().multiply(oldCorrection);
            near(down.clone().applyQuaternion(mapped), down.clone().applyQuaternion(previous), `${time} ${bone.name} centerline`);
            assert.ok(Math.abs(width.clone().applyQuaternion(mapped).dot(front.clone().applyQuaternion(previous))) > 1 - tolerance, 'arm width follows the old hinge axis, not old depth');
        }
    }
}
console.log('PASS: mirrored arm width/depth, forward elbow flexion, and unchanged full-cycle centerlines');
