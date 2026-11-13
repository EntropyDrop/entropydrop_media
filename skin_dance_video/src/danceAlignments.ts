import * as THREE from 'three';

export function createDanceRotationCorrections(): Record<string, THREE.Quaternion> {
    // FBX limbs extend along +Y; Minecraft limbs extend along -Y.
    const flipY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
    // This rig bends its mirrored elbows around FBX Z. Minecraft arm width
    // must follow that hinge axis (local X), not the front/back depth axis.
    // Roll both arm segments together so their length and elbow positions
    // stay unchanged while the 3x4 Slim cross-section and UVs face correctly.
    const leftArm = flipY.clone().multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    );
    const rightArm = flipY.clone().multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
    );

    return {
        head: new THREE.Quaternion(),
        body: new THREE.Quaternion(),
        left_arm: leftArm,
        left_low_arm: leftArm,
        right_arm: rightArm,
        right_low_arm: rightArm,
        left_leg: flipY,
        left_low_leg: flipY,
        right_leg: flipY,
        right_low_leg: flipY,
    };
}
