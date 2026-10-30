import * as THREE from 'three';
import type RAPIER_NAMESPACE from '@dimforge/rapier3d-compat';
import { BlockyAvatar } from './Avatar';
import { soundManager } from '../audio/SoundManager';

// Předalokované pomocné vektory (nulová alokace GC v herní smyčce)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _moveDir = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();

export interface PlatformDeltaProvider {
  getPlatformDeltaByColliderHandle(handle: number): THREE.Vector3 | null;
}

/**
 * Ovladač postavy 3. osoby:
 * - Rapier3D kapsle s uzamčenou rotací (body.lockRotations(true, true))
 * - Spolehlivý Raycast směrem dolů pro detekci země + Coyote Time (150 ms)
 * - Přenos pohybu z pohyblivých kinematických plošin (hráč se veze s plošinou)
 * - Orbitální kamera třetí osoby ovládaná tažením myší + plynulá interpolace
 */
export class PlayerController {
  public readonly avatar: BlockyAvatar;
  public body!: RAPIER_NAMESPACE.RigidBody;
  public collider!: RAPIER_NAMESPACE.Collider;

  private RAPIER: typeof RAPIER_NAMESPACE;
  private world: RAPIER_NAMESPACE.World;
  private camera: THREE.PerspectiveCamera;
  private domElement: HTMLElement;

  // Fyzikální rozměry kapsle: poloviční výška válce 0.65 + poloměr polokoulí 0.45 => celková výška = 2.20
  private readonly capsuleHalfHeight = 0.65;
  private readonly capsuleRadius = 0.45;
  private readonly centerOffsetY = 1.1; // vzdálenost od chodidel (Y=0) do středu kapsle

  // Stav pohybu a skoku
  private keys: Set<string> = new Set();
  private jumpQueued: boolean = false;
  private coyoteTimer: number = 0;
  private jumpCooldown: number = 0;
  private isGrounded: boolean = false;
  private groundedColliderHandle: number | null = null;
  private targetFacingAngle: number = 0;
  private currentFacingAngle: number = 0;
  private controlsDisabled: boolean = false;

  // Orbitální kamera (tažení myší)
  private camYaw: number = 0;
  private camPitch: number = 0.42;
  private camDistance: number = 8.5;
  private isDragging: boolean = false;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private smoothedCamPos = new THREE.Vector3(0, 5, 9);
  private smoothedLookAt = new THREE.Vector3(0, 1.5, 0);

  constructor(
    RAPIER: typeof RAPIER_NAMESPACE,
    world: RAPIER_NAMESPACE.World,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    avatar: BlockyAvatar,
  ) {
    this.RAPIER = RAPIER;
    this.world = world;
    this.camera = camera;
    this.domElement = domElement;
    this.avatar = avatar;

    scene.add(this.avatar.root);
    this.createPhysicsBody(new THREE.Vector3(0, 2, 0));
    this.bindInputEvents();
  }

  public createPhysicsBody(spawnPos: THREE.Vector3): void {
    const bodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawnPos.x, spawnPos.y + this.centerOffsetY, spawnPos.z)
      .setLinearDamping(0.6)
      .setCcdEnabled(true);

    this.body = this.world.createRigidBody(bodyDesc);
    // Uzamkneme rotaci tělesa, aby se postava nikdy nepřevracela
    this.body.lockRotations(true, true);

    const colliderDesc = this.RAPIER.ColliderDesc.capsule(
      this.capsuleHalfHeight,
      this.capsuleRadius,
    )
      .setFriction(0.1)
      .setRestitution(0.0);

    this.collider = this.world.createCollider(colliderDesc, this.body);
  }

  public teleportTo(pos: THREE.Vector3, facingYaw?: number): void {
    this.body.setTranslation(
      { x: pos.x, y: pos.y + this.centerOffsetY, z: pos.z },
      true,
    );
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    if (typeof facingYaw === 'number') {
      this.targetFacingAngle = facingYaw;
      this.currentFacingAngle = facingYaw;
      this.camYaw = facingYaw;
    }

    this.avatar.root.position.copy(pos);
    this.smoothedLookAt.set(pos.x, pos.y + 1.4, pos.z);
    this.smoothedCamPos.set(
      pos.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDistance,
      pos.y + 1.4 + Math.sin(this.camPitch) * this.camDistance,
      pos.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDistance,
    );
  }

  public getFootPosition(out: THREE.Vector3): THREE.Vector3 {
    const t = this.body.translation();
    return out.set(t.x, t.y - this.centerOffsetY, t.z);
  }

  public setControlsDisabled(disabled: boolean): void {
    this.controlsDisabled = disabled;
    if (disabled) {
      this.keys.clear();
      this.isDragging = false;
      // Uvolníme případný Pointer Lock, pokud by byl aktivní
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    }
  }

  public update(
    dt: number,
    elapsedTime: number,
    platformProvider: PlatformDeltaProvider,
  ): void {
    // 1. Raycast směrem dolů pro spolehlivou detekci země
    const t = this.body.translation();
    const rayOrigin = { x: t.x, y: t.y - this.capsuleHalfHeight, z: t.z };
    const rayDir = { x: 0, y: -1, z: 0 };
    const maxToi = this.capsuleRadius + 0.22;

    const hit = this.world.castRay(
      new this.RAPIER.Ray(rayOrigin, rayDir),
      maxToi,
      true,
      undefined,
      undefined,
      this.collider,
      this.body,
    );

    if (hit && hit.timeOfImpact <= maxToi) {
      this.isGrounded = true;
      this.coyoteTimer = 0.15; // 150ms coyote time
      this.groundedColliderHandle = hit.collider.handle;
    } else {
      this.isGrounded = false;
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      this.groundedColliderHandle = null;
    }

    if (this.jumpCooldown > 0) {
      this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    }

    // 2. Přenos pohybu z pohyblivé plošiny pod hráčem
    let platformVelX = 0;
    let platformVelZ = 0;
    if (this.isGrounded && this.groundedColliderHandle !== null && dt > 0.0001) {
      const delta = platformProvider.getPlatformDeltaByColliderHandle(
        this.groundedColliderHandle,
      );
      if (delta) {
        platformVelX = delta.x / dt;
        platformVelZ = delta.z / dt;
        if (Math.abs(delta.y) > 0.0001) {
          this.body.setTranslation(
            { x: t.x, y: t.y + delta.y, z: t.z },
            true,
          );
        }
      }
    }

    // 3. Výpočet směru pohybu z kláves WASD / Šipek relativně ke kameře
    _moveDir.set(0, 0, 0);
    if (!this.controlsDisabled) {
      const forwardInput =
        (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
        (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
      const rightInput =
        (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
        (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);

      if (forwardInput !== 0 || rightInput !== 0) {
        _forward.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)).normalize();
        _right.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)).normalize();

        _moveDir
          .addScaledVector(_forward, forwardInput)
          .addScaledVector(_right, rightInput);
        if (_moveDir.lengthSq() > 0.001) {
          _moveDir.normalize();
          this.targetFacingAngle = Math.atan2(_moveDir.x, _moveDir.z);
        }
      }
    }

    const moveSpeed = 7.4;
    const currentVel = this.body.linvel();
    let nextVelY = currentVel.y;

    // 4. Skok (povolen na zemi nebo během krátkého coyote time)
    const wantsJump =
      !this.controlsDisabled &&
      (this.jumpQueued || this.keys.has('Space'));
    this.jumpQueued = false;

    if (wantsJump && this.coyoteTimer > 0 && this.jumpCooldown <= 0) {
      nextVelY = 10.6;
      this.coyoteTimer = 0;
      this.jumpCooldown = 0.24;
      this.isGrounded = false;
      soundManager.playJump();
    }

    const desiredVelX = _moveDir.x * moveSpeed + platformVelX;
    const desiredVelZ = _moveDir.z * moveSpeed + platformVelZ;

    // Plynulá akcelerace na zemi i ve vzduchu
    const accelLambda = this.isGrounded ? 18 : 10;
    const finalVelX = THREE.MathUtils.damp(currentVel.x, desiredVelX, accelLambda, dt);
    const finalVelZ = THREE.MathUtils.damp(currentVel.z, desiredVelZ, accelLambda, dt);

    this.body.setLinvel({ x: finalVelX, y: nextVelY, z: finalVelZ }, true);

    // 5. Synchronizace 3D modelu postavy s fyzikálním tělesem
    const updatedTrans = this.body.translation();
    const footX = updatedTrans.x;
    const footY = updatedTrans.y - this.centerOffsetY;
    const footZ = updatedTrans.z;

    this.avatar.root.position.set(footX, footY, footZ);

    // Plynulé otáčení postavy za směrem běhu (nejkratší úhlovou cestou)
    let angleDiff = this.targetFacingAngle - this.currentFacingAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.currentFacingAngle += angleDiff * (1 - Math.exp(-14 * dt));
    this.avatar.root.rotation.y = this.currentFacingAngle;

    const relSpeed = Math.hypot(
      finalVelX - platformVelX,
      finalVelZ - platformVelZ,
    );
    this.avatar.updateAnimation(dt, relSpeed, this.isGrounded, elapsedTime);

    // 6. Aktualizace orbitální kamery třetí osoby s plynulou interpolací (damp/lerp)
    _camTarget.set(footX, footY + 1.45, footZ);
    this.smoothedLookAt.x = THREE.MathUtils.damp(
      this.smoothedLookAt.x,
      _camTarget.x,
      14,
      dt,
    );
    this.smoothedLookAt.y = THREE.MathUtils.damp(
      this.smoothedLookAt.y,
      _camTarget.y,
      12,
      dt,
    );
    this.smoothedLookAt.z = THREE.MathUtils.damp(
      this.smoothedLookAt.z,
      _camTarget.z,
      14,
      dt,
    );

    _desiredCamPos.set(
      this.smoothedLookAt.x +
        Math.sin(this.camYaw) * Math.cos(this.camPitch) * this.camDistance,
      this.smoothedLookAt.y + Math.sin(this.camPitch) * this.camDistance,
      this.smoothedLookAt.z +
        Math.cos(this.camYaw) * Math.cos(this.camPitch) * this.camDistance,
    );

    this.smoothedCamPos.x = THREE.MathUtils.damp(
      this.smoothedCamPos.x,
      _desiredCamPos.x,
      14,
      dt,
    );
    this.smoothedCamPos.y = THREE.MathUtils.damp(
      this.smoothedCamPos.y,
      _desiredCamPos.y,
      14,
      dt,
    );
    this.smoothedCamPos.z = THREE.MathUtils.damp(
      this.smoothedCamPos.z,
      _desiredCamPos.z,
      14,
      dt,
    );

    this.camera.position.copy(this.smoothedCamPos);
    this.camera.lookAt(this.smoothedLookAt);
  }

  private bindInputEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: true });
    this.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel);
    this.domElement.removeEventListener('contextmenu', this.onContextMenu);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.controlsDisabled) return;
    if (
      e.code === 'Space' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight'
    ) {
      e.preventDefault();
    }
    if (e.code === 'Space' && !this.keys.has('Space')) {
      this.jumpQueued = true;
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.controlsDisabled) return;
    this.isDragging = true;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.isDragging || this.controlsDisabled) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    const sensitivity = 0.0065;
    this.camYaw -= dx * sensitivity;
    this.camPitch = THREE.MathUtils.clamp(
      this.camPitch + dy * sensitivity,
      0.12,
      1.18,
    );
  };

  private onPointerUp = (): void => {
    this.isDragging = false;
  };

  private onWheel = (e: WheelEvent): void => {
    if (this.controlsDisabled) return;
    this.camDistance = THREE.MathUtils.clamp(
      this.camDistance + e.deltaY * 0.005,
      4.5,
      14.5,
    );
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };
}
