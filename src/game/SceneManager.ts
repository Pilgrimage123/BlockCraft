import * as THREE from 'three';
import type RAPIER_NAMESPACE from '@dimforge/rapier3d-compat';
import { SceneId } from '../types/game';
import { PlayerController, PlatformDeltaProvider } from './PlayerController';
import {
  createPlasticMaterial,
  createSignTexture,
  createStudTexture,
} from './materials';
import { soundManager } from '../audio/SoundManager';

const _playerFootPos = new THREE.Vector3();
const _tempQuat = new THREE.Quaternion();
const _tempEuler = new THREE.Euler();

interface KinematicPlatformItem {
  body: RAPIER_NAMESPACE.RigidBody;
  colliderHandle: number;
  mesh: THREE.Object3D;
  origin: THREE.Vector3;
  amplitude: THREE.Vector3;
  speed: number;
  phase: number;
  lastPos: THREE.Vector3;
  deltaPos: THREE.Vector3;
}

interface RotatingSpinnerItem {
  body: RAPIER_NAMESPACE.RigidBody;
  mesh: THREE.Object3D;
  center: THREE.Vector3;
  angularSpeed: number;
  currentAngle: number;
}

interface BlinkingBlockItem {
  body: RAPIER_NAMESPACE.RigidBody;
  collider: RAPIER_NAMESPACE.Collider;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  baseColor: THREE.Color;
  warnColor: THREE.Color;
  cycleDuration: number;
  phaseOffset: number;
}

interface CheckpointPadItem {
  index: number;
  position: THREE.Vector3;
  respawnPoint: THREE.Vector3;
  padMat: THREE.MeshStandardMaterial;
  ringMat: THREE.MeshStandardMaterial;
  activated: boolean;
}

export interface SceneCallbacks {
  onSceneChanged: (sceneId: SceneId) => void;
  onWardrobeZoneEnterChange: (inZone: boolean) => void;
  onCheckpointReached: (checkpointIndex: number, totalCheckpoints: number) => void;
  onObbyVictory: () => void;
}

/**
 * Modulární správce scén (Hub a Obby Parkour) se 100% vyčištěním paměti Three.js i Rapier3D těles.
 */
export class SceneManager implements PlatformDeltaProvider {
  public currentScene: SceneId = 'hub';

  private RAPIER: typeof RAPIER_NAMESPACE;
  private world: RAPIER_NAMESPACE.World;
  private scene: THREE.Scene;
  private player: PlayerController;
  private callbacks: SceneCallbacks;
  private maxAnisotropy: number;

  // Kontejner všech objektů a fyzikálních těles aktuální scény (pro kompletní dispose)
  private sceneRoot: THREE.Group;
  private sceneBodies: RAPIER_NAMESPACE.RigidBody[] = [];

  // Interaktivní prvky v Hubu
  private wardrobeCenter = new THREE.Vector3(-9.5, 0, -4.5);
  private wardrobeRingMesh: THREE.Mesh | null = null;
  private wasInWardrobeZone: boolean = false;

  private portalCenter = new THREE.Vector3(9.5, 0, -6.5);
  private portalOuterRing: THREE.Mesh | null = null;
  private portalInnerRing: THREE.Mesh | null = null;
  private portalCoreMat: THREE.MeshStandardMaterial | null = null;
  private floatingSigns: { mesh: THREE.Object3D; baseY: number }[] = [];

  // Interaktivní prvky v Obby
  private kinematicPlatforms: KinematicPlatformItem[] = [];
  private rotatingSpinners: RotatingSpinnerItem[] = [];
  private blinkingBlocks: BlinkingBlockItem[] = [];
  private checkpoints: CheckpointPadItem[] = [];
  private activeCheckpointPos = new THREE.Vector3(0, 1.5, 0);
  private lavaMesh: THREE.Mesh | null = null;
  private lavaMat: THREE.MeshStandardMaterial | null = null;

  // Cílová zlatá truhla
  private chestCenter = new THREE.Vector3(0, 7.2, -194);
  private chestLidPivot: THREE.Group | null = null;
  private chestOpened: boolean = false;
  private victoryTimeoutId: number | null = null;

  constructor(
    RAPIER: typeof RAPIER_NAMESPACE,
    world: RAPIER_NAMESPACE.World,
    scene: THREE.Scene,
    player: PlayerController,
    callbacks: SceneCallbacks,
    maxAnisotropy: number = 4,
  ) {
    this.RAPIER = RAPIER;
    this.world = world;
    this.scene = scene;
    this.player = player;
    this.callbacks = callbacks;
    this.maxAnisotropy = maxAnisotropy;

    this.sceneRoot = new THREE.Group();
    this.scene.add(this.sceneRoot);
  }

  /**
   * Kompletně vymaže Three.js geometrie, materiály, textury a Rapier fyzikální tělesa
   * před načtením nové scény, aby nikde nezůstávaly „duchové" kolizí.
   */
  public clearCurrentScene(): void {
    if (this.victoryTimeoutId !== null) {
      window.clearTimeout(this.victoryTimeoutId);
      this.victoryTimeoutId = null;
    }

    // 1. Odstranění všech Rapier RigidBody (tím se v Rapieru automaticky odstraní i jejich Collidery)
    for (const body of this.sceneBodies) {
      if (this.world.bodies.contains(body.handle)) {
        this.world.removeRigidBody(body);
      }
    }
    this.sceneBodies = [];

    // 2. Uvolnění Three.js geometrií, materiálů a procedurálních textur
    this.sceneRoot.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        const disposeMaterial = (mat: THREE.Material) => {
          const stdMat = mat as THREE.MeshStandardMaterial;
          if (stdMat.map) stdMat.map.dispose();
          mat.dispose();
        };
        if (Array.isArray(obj.material)) {
          obj.material.forEach(disposeMaterial);
        } else if (obj.material) {
          disposeMaterial(obj.material);
        }
      }
    });

    this.sceneRoot.clear();

    // 3. Reset polí dynamických prvků
    this.wardrobeRingMesh = null;
    this.portalOuterRing = null;
    this.portalInnerRing = null;
    this.portalCoreMat = null;
    this.floatingSigns = [];
    this.kinematicPlatforms = [];
    this.rotatingSpinners = [];
    this.blinkingBlocks = [];
    this.checkpoints = [];
    this.lavaMesh = null;
    this.lavaMat = null;
    this.chestLidPivot = null;
    this.chestOpened = false;

    if (this.wasInWardrobeZone) {
      this.wasInWardrobeZone = false;
      this.callbacks.onWardrobeZoneEnterChange(false);
    }
  }

  public loadScene(sceneId: SceneId): void {
    this.clearCurrentScene();
    this.currentScene = sceneId;

    if (sceneId === 'hub') {
      this.buildHubScene();
      this.player.teleportTo(new THREE.Vector3(0, 1.2, 6), 0);
    } else {
      this.buildObbyScene();
      this.activeCheckpointPos.set(0, 1.5, 0);
      this.player.teleportTo(this.activeCheckpointPos, 0);
      this.callbacks.onCheckpointReached(1, this.checkpoints.length);
    }

    this.callbacks.onSceneChanged(sceneId);
  }

  public getPlatformDeltaByColliderHandle(handle: number): THREE.Vector3 | null {
    for (const plat of this.kinematicPlatforms) {
      if (plat.colliderHandle === handle) {
        return plat.deltaPos;
      }
    }
    return null;
  }

  // ============================================================================
  // SCÉNA 1: HLAVNÍ HUB (Náměstíčko, Domeček, Stromy, Zóna Šatny, 3D Portál)
  // ============================================================================
  private buildHubScene(): void {
    // Příjemná modrá obloha a horizontální mlha
    const skyColor = new THREE.Color('#7DD3FC');
    this.scene.background = skyColor;
    this.scene.fog = new THREE.Fog('#7DD3FC', 38, 115);

    // Dekorativní moře kolem ostrova
    const waterGeo = new THREE.PlaneGeometry(260, 260);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = createPlasticMaterial('#38BDF8', {
      roughness: 0.15,
      metalness: 0.15,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(0, -1.2, 0);
    waterMesh.receiveShadow = true;
    this.sceneRoot.add(waterMesh);

    // Hlavní travnatý ostrov (36 x 2 x 36) se stavebnicovou „stud" texturou
    const grassTex = createStudTexture(
      '#22C55E',
      '#16A34A',
      18,
      18,
      this.maxAnisotropy,
    );
    this.createStaticBox(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(38, 2, 38),
      '#FFFFFF',
      { map: grassTex, roughness: 0.32 },
    );

    // Pískový břeh pod ostrovem
    this.createStaticBox(
      new THREE.Vector3(0, -1.6, 0),
      new THREE.Vector3(41, 1.2, 41),
      '#FDE047',
      { roughness: 0.45 },
    );

    // Dlážděné centrální náměstíčko (zvýšené o 0.04 nad trávou proti Z-fightingu)
    const plazaTex = createStudTexture(
      '#E2E8F0',
      '#CBD5E1',
      8,
      8,
      this.maxAnisotropy,
    );
    this.createStaticBox(
      new THREE.Vector3(0, 0.02, 1),
      new THREE.Vector3(16, 0.08, 16),
      '#FFFFFF',
      { map: plazaTex, roughness: 0.25 },
    );

    // 1. Barevný patrový domeček v severní části náměstí (Z = -11)
    this.buildColorfulHouse(new THREE.Vector3(0, 0, -11.5));

    // 2. Zvýrazněná kruhová zóna „ŠATNA" vlevo (X = -9.5, Z = -4.5)
    this.buildWardrobeZone(this.wardrobeCenter);

    // 3. Svítící 3D Portál „Obby Parkour" vpravo (X = 9.5, Z = -6.5)
    this.buildPortalZone(this.portalCenter);

    // 4. Geometrické stromy a přírodní kameny po obvodu ostrova
    const treeCoords: [number, number, number][] = [
      [-14, -12, 1.1],
      [-15, 4, 0.95],
      [-12, 12, 1.05],
      [14, -13, 1.15],
      [15, 3, 1.0],
      [12, 12, 0.9],
      [-6, -15, 0.85],
      [7, -15, 1.05],
    ];
    for (const [tx, tz, scale] of treeCoords) {
      this.buildGeometricTree(new THREE.Vector3(tx, 0, tz), scale);
    }

    // Přírodní kameny a lavičky na náměstíčku
    this.buildRockCluster(new THREE.Vector3(-16, 0, -4));
    this.buildRockCluster(new THREE.Vector3(16, 0, -3));
    this.buildParkBench(new THREE.Vector3(-5.2, 0, 2.5), Math.PI / 2);
    this.buildParkBench(new THREE.Vector3(5.2, 0, 2.5), -Math.PI / 2);
  }

  private buildColorfulHouse(pos: THREE.Vector3): void {
    const houseGroup = new THREE.Group();
    houseGroup.position.copy(pos);
    this.sceneRoot.add(houseGroup);

    // Základní podezdívka
    this.createStaticBox(
      new THREE.Vector3(pos.x, 0.25, pos.z),
      new THREE.Vector3(8.6, 0.5, 6.6),
      '#94A3B8',
      { roughness: 0.45 },
    );

    // Hlavní stěny domečku (veselá krémově žlutá)
    this.createStaticBox(
      new THREE.Vector3(pos.x, 2.5, pos.z),
      new THREE.Vector3(8.0, 4.0, 6.0),
      '#FEF08A',
      { roughness: 0.25 },
    );

    // Šikmá červená střecha (čtyřboký jehlan - ConeGeometry se 4 stěnami)
    const roofGeo = new THREE.ConeGeometry(6.8, 3.0, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roofMat = createPlasticMaterial('#EF4444', {
      roughness: 0.22,
      metalness: 0.12,
    });
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.set(0, 6.0, 0);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    houseGroup.add(roofMesh);

    // Komín na střeše
    const chimneyGeo = new THREE.BoxGeometry(0.9, 2.2, 0.9);
    const chimneyMat = createPlasticMaterial('#B91C1C', { roughness: 0.5 });
    const chimneyMesh = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimneyMesh.position.set(2.2, 6.1, -1.0);
    chimneyMesh.castShadow = true;
    houseGroup.add(chimneyMesh);

    const chimneyRimGeo = new THREE.BoxGeometry(1.1, 0.22, 1.1);
    const chimneyRim = new THREE.Mesh(chimneyRimGeo, chimneyMat);
    chimneyRim.position.set(2.2, 7.2, -1.0);
    chimneyRim.castShadow = true;
    houseGroup.add(chimneyRim);

    // Dřevěné dveře + zlatá klika + stříška nad vchodem
    const doorGeo = new THREE.BoxGeometry(1.5, 2.4, 0.16);
    const doorMat = createPlasticMaterial('#92400E', { roughness: 0.45 });
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(0, 1.7, 3.02);
    doorMesh.castShadow = true;
    houseGroup.add(doorMesh);

    const knobGeo = new THREE.SphereGeometry(0.11, 16, 16);
    const knobMat = createPlasticMaterial('#FACC15', {
      roughness: 0.15,
      metalness: 0.7,
    });
    const knobMesh = new THREE.Mesh(knobGeo, knobMat);
    knobMesh.position.set(0.48, 1.65, 3.14);
    houseGroup.add(knobMesh);

    const awningGeo = new THREE.BoxGeometry(2.4, 0.24, 1.0);
    const awningMat = createPlasticMaterial('#3B82F6', { roughness: 0.25 });
    const awningMesh = new THREE.Mesh(awningGeo, awningMat);
    awningMesh.position.set(0, 3.05, 3.4);
    awningMesh.castShadow = true;
    houseGroup.add(awningMesh);

    // Dvě veselá okna s modrým sklem a bílým rámem
    const windowPositions = [-2.4, 2.4];
    for (const wx of windowPositions) {
      const frameGeo = new THREE.BoxGeometry(1.4, 1.4, 0.14);
      const frameMat = createPlasticMaterial('#FFFFFF', { roughness: 0.2 });
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.set(wx, 2.4, 3.01);
      houseGroup.add(frameMesh);

      const paneGeo = new THREE.BoxGeometry(1.1, 1.1, 0.18);
      const paneMat = createPlasticMaterial('#38BDF8', {
        roughness: 0.1,
        metalness: 0.3,
        emissive: '#0284C7',
        emissiveIntensity: 0.2,
      });
      const paneMesh = new THREE.Mesh(paneGeo, paneMat);
      paneMesh.position.set(wx, 2.4, 3.01);
      houseGroup.add(paneMesh);
    }
  }

  private buildWardrobeZone(center: THREE.Vector3): void {
    const group = new THREE.Group();
    group.position.copy(center);
    this.sceneRoot.add(group);

    // Fyzikální kruhová podstava šatny
    const baseBodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(
      center.x,
      0.15,
      center.z,
    );
    const baseBody = this.world.createRigidBody(baseBodyDesc);
    this.sceneBodies.push(baseBody);
    this.world.createCollider(
      this.RAPIER.ColliderDesc.cylinder(0.15, 3.1),
      baseBody,
    );

    const padGeo = new THREE.CylinderGeometry(3.1, 3.3, 0.3, 36);
    const padMat = createPlasticMaterial('#A855F7', {
      roughness: 0.22,
      metalness: 0.15,
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.set(0, 0.15, 0);
    padMesh.castShadow = true;
    padMesh.receiveShadow = true;
    group.add(padMesh);

    const innerPadGeo = new THREE.CylinderGeometry(2.5, 2.5, 0.34, 36);
    const innerPadMat = createPlasticMaterial('#F3E8FF', {
      roughness: 0.2,
      metalness: 0.1,
    });
    const innerPadMesh = new THREE.Mesh(innerPadGeo, innerPadMat);
    innerPadMesh.position.set(0, 0.16, 0);
    innerPadMesh.receiveShadow = true;
    group.add(innerPadMesh);

    // Svítící prstenec kolem šatny
    const ringGeo = new THREE.TorusGeometry(2.9, 0.12, 16, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = createPlasticMaterial('#FACC15', {
      roughness: 0.2,
      metalness: 0.4,
      emissive: '#EAB308',
      emissiveIntensity: 0.6,
    });
    this.wardrobeRingMesh = new THREE.Mesh(ringGeo, ringMat);
    this.wardrobeRingMesh.position.set(0, 0.35, 0);
    group.add(this.wardrobeRingMesh);

    // Dekorativní stojan na oblečení v pozadí zóny
    const archGeo = new THREE.TorusGeometry(2.2, 0.15, 12, 32, Math.PI);
    const archMat = createPlasticMaterial('#EC4899', { roughness: 0.25 });
    const archMesh = new THREE.Mesh(archGeo, archMat);
    archMesh.position.set(0, 1.8, -1.6);
    archMesh.castShadow = true;
    group.add(archMesh);

    // Plovoucí nápis „ŠATNA & OBCHOD"
    const signTex = createSignTexture(
      'ŠATNA & BARVY',
      'Vstup do kruhu pro úpravu postavy',
      '#7E22CE',
      '#FACC15',
      this.maxAnisotropy,
    );
    const signGeo = new THREE.BoxGeometry(4.4, 1.65, 0.18);
    const signSideMat = createPlasticMaterial('#581C87', { roughness: 0.3 });
    const signFaceMat = createPlasticMaterial('#FFFFFF', {
      map: signTex,
      roughness: 0.2,
    });
    const signMesh = new THREE.Mesh(signGeo, [
      signSideMat,
      signSideMat,
      signSideMat,
      signSideMat,
      signFaceMat,
      signFaceMat,
    ]);
    signMesh.position.set(0, 4.3, -1.2);
    signMesh.castShadow = true;
    group.add(signMesh);
    this.floatingSigns.push({ mesh: signMesh, baseY: 4.3 });
  }

  private buildPortalZone(center: THREE.Vector3): void {
    const group = new THREE.Group();
    group.position.copy(center);
    this.sceneRoot.add(group);

    // Podstavec portálu
    this.createStaticBox(
      new THREE.Vector3(center.x, 0.25, center.z),
      new THREE.Vector3(5.6, 0.5, 4.0),
      '#1E293B',
      { roughness: 0.35, metalness: 0.25 },
    );

    // Dva boční sloupy portálu
    this.createStaticBox(
      new THREE.Vector3(center.x - 2.3, 2.6, center.z),
      new THREE.Vector3(0.7, 4.6, 0.7),
      '#0284C7',
      { roughness: 0.25, metalness: 0.2 },
    );
    this.createStaticBox(
      new THREE.Vector3(center.x + 2.3, 2.6, center.z),
      new THREE.Vector3(0.7, 4.6, 0.7),
      '#0284C7',
      { roughness: 0.25, metalness: 0.2 },
    );

    // Rotující vnější prstenec portálu
    const outerRingGeo = new THREE.TorusGeometry(2.15, 0.22, 16, 48);
    const outerRingMat = createPlasticMaterial('#38BDF8', {
      roughness: 0.15,
      metalness: 0.3,
      emissive: '#0284C7',
      emissiveIntensity: 0.75,
    });
    this.portalOuterRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    this.portalOuterRing.position.set(0, 2.8, 0);
    this.portalOuterRing.castShadow = true;
    group.add(this.portalOuterRing);

    // Rotující vnitřní čtvercový/osmiúhelníkový prstenec
    const innerRingGeo = new THREE.TorusGeometry(1.65, 0.14, 12, 8);
    const innerRingMat = createPlasticMaterial('#FACC15', {
      roughness: 0.2,
      metalness: 0.5,
      emissive: '#EAB308',
      emissiveIntensity: 0.8,
    });
    this.portalInnerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    this.portalInnerRing.position.set(0, 2.8, 0);
    group.add(this.portalInnerRing);

    // Svítící energetický střed portálu
    const coreGeo = new THREE.CylinderGeometry(1.75, 1.75, 0.12, 32);
    coreGeo.rotateX(Math.PI / 2);
    this.portalCoreMat = createPlasticMaterial('#67E8F9', {
      roughness: 0.1,
      metalness: 0.1,
      emissive: '#06B6D4',
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.82,
    });
    const coreMesh = new THREE.Mesh(coreGeo, this.portalCoreMat);
    coreMesh.position.set(0, 2.8, 0);
    group.add(coreMesh);

    // Plovoucí nápis „Obby Parkour"
    const signTex = createSignTexture(
      'OBBY PARKOUR',
      'Proskoč portálem do minihry (+50 ★)',
      '#0369A1',
      '#38BDF8',
      this.maxAnisotropy,
    );
    const signGeo = new THREE.BoxGeometry(4.8, 1.75, 0.2);
    const signSideMat = createPlasticMaterial('#0C4A6E', { roughness: 0.3 });
    const signFaceMat = createPlasticMaterial('#FFFFFF', {
      map: signTex,
      roughness: 0.2,
    });
    const signMesh = new THREE.Mesh(signGeo, [
      signSideMat,
      signSideMat,
      signSideMat,
      signSideMat,
      signFaceMat,
      signFaceMat,
    ]);
    signMesh.position.set(0, 5.75, 0);
    signMesh.castShadow = true;
    group.add(signMesh);
    this.floatingSigns.push({ mesh: signMesh, baseY: 5.75 });
  }

  private buildGeometricTree(pos: THREE.Vector3, scale: number = 1): void {
    const treeGroup = new THREE.Group();
    treeGroup.position.copy(pos);
    treeGroup.scale.setScalar(scale);
    this.sceneRoot.add(treeGroup);

    // Fyzikální kolize kmene
    const trunkBody = this.world.createRigidBody(
      this.RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, 1.2 * scale, pos.z),
    );
    this.sceneBodies.push(trunkBody);
    this.world.createCollider(
      this.RAPIER.ColliderDesc.cylinder(1.2 * scale, 0.42 * scale),
      trunkBody,
    );

    // Kmen (CylinderGeometry)
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.48, 2.2, 12);
    const trunkMat = createPlasticMaterial('#854D0E', { roughness: 0.55 });
    const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
    trunkMesh.position.set(0, 1.1, 0);
    trunkMesh.castShadow = true;
    trunkMesh.receiveShadow = true;
    treeGroup.add(trunkMesh);

    // 3 patra koruny stromu s odlišným odstínem a drsností
    const crownColors = ['#15803D', '#16A34A', '#22C55E'];
    const sizes = [
      { r: 1.75, h: 1.8, y: 2.6 },
      { r: 1.4, h: 1.6, y: 3.7 },
      { r: 0.95, h: 1.3, y: 4.65 },
    ];
    sizes.forEach((layer, idx) => {
      const coneGeo = new THREE.ConeGeometry(layer.r, layer.h, 8);
      const coneMat = createPlasticMaterial(crownColors[idx], {
        roughness: 0.25 + idx * 0.05,
        metalness: 0.08,
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.set(0, layer.y, 0);
      coneMesh.castShadow = true;
      coneMesh.receiveShadow = true;
      treeGroup.add(coneMesh);
    });
  }

  private buildRockCluster(pos: THREE.Vector3): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    this.sceneRoot.add(group);

    const offsets = [
      { x: 0, y: 0.55, z: 0, sx: 1.4, sy: 1.1, sz: 1.2 },
      { x: 0.9, y: 0.35, z: 0.6, sx: 0.9, sy: 0.7, sz: 0.8 },
      { x: -0.8, y: 0.4, z: 0.4, sx: 0.85, sy: 0.8, sz: 0.9 },
    ];
    for (const o of offsets) {
      const geo = new THREE.DodecahedronGeometry(0.75, 0);
      const mat = createPlasticMaterial('#64748B', { roughness: 0.55, metalness: 0.1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(o.x, o.y, o.z);
      mesh.scale.set(o.sx, o.sy, o.sz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  private buildParkBench(pos: THREE.Vector3, rotY: number): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.y = rotY;
    this.sceneRoot.add(group);

    const woodMat = createPlasticMaterial('#B45309', { roughness: 0.4 });
    const legMat = createPlasticMaterial('#334155', { roughness: 0.5, metalness: 0.3 });

    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 0.75), woodMat);
    seat.position.set(0, 0.55, 0);
    seat.castShadow = true;
    group.add(seat);

    const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 0.14), woodMat);
    back.position.set(0, 0.95, -0.32);
    back.castShadow = true;
    group.add(back);

    for (const lx of [-0.95, 0.95]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.65), legMat);
      leg.position.set(lx, 0.275, 0);
      leg.castShadow = true;
      group.add(leg);
    }
  }

  // ============================================================================
  // SCÉNA 2: MINIHRA „OBBY" (Parkour nad lávou s 5 sekcemi, Checkpointy a Truhlou)
  // ============================================================================
  private buildObbyScene(): void {
    // Světle modrá obloha s jemnou mlhou v dálce
    this.scene.background = new THREE.Color('#7DD3FC');
    this.scene.fog = new THREE.Fog('#7DD3FC', 45, 165);

    // Svítící oranžovo-červená láva pod celým levelem (emissive materiál)
    const lavaTex = createStudTexture(
      '#EA580C',
      '#DC2626',
      40,
      80,
      this.maxAnisotropy,
    );
    const lavaGeo = new THREE.PlaneGeometry(180, 320);
    lavaGeo.rotateX(-Math.PI / 2);
    this.lavaMat = createPlasticMaterial('#FF4500', {
      map: lavaTex,
      roughness: 0.2,
      metalness: 0.05,
      emissive: '#FF2200',
      emissiveIntensity: 0.85,
    });
    this.lavaMesh = new THREE.Mesh(lavaGeo, this.lavaMat);
    this.lavaMesh.position.set(0, -3.5, -100);
    this.sceneRoot.add(this.lavaMesh);

    // --- START A CHECKPOINT 1 (Z = 0) ---
    this.createStaticBox(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(9, 1.2, 9),
      '#3B82F6',
    );
    this.createCheckpointPad(1, new THREE.Vector3(0, 0.6, 0), true);

    // --- SEKCE 1: Statické skákací bloky v různých výškách (Z = -8 až -33) ---
    const sec1Blocks: { pos: [number, number, number]; color: string }[] = [
      { pos: [0, 0.5, -8.5], color: '#FACC15' },
      { pos: [-2.2, 1.0, -14.5], color: '#EC4899' },
      { pos: [2.0, 1.5, -20.5], color: '#22C55E' },
      { pos: [-1.8, 2.0, -26.5], color: '#A855F7' },
      { pos: [0, 2.3, -32.5], color: '#06B6D4' },
    ];
    for (const b of sec1Blocks) {
      this.createStaticBox(
        new THREE.Vector3(b.pos[0], b.pos[1], b.pos[2]),
        new THREE.Vector3(3.8, 0.9, 3.8),
        b.color,
      );
    }

    // --- CHECKPOINT 2 (Z = -39, Y = 2.4) ---
    this.createStaticBox(
      new THREE.Vector3(0, 2.0, -39),
      new THREE.Vector3(7.5, 1.0, 6.5),
      '#475569',
    );
    this.createCheckpointPad(2, new THREE.Vector3(0, 2.5, -39), false);

    // --- SEKCE 2: Pohyblivé plošiny unášející hráče (Z = -47 až -71) ---
    this.createKinematicPlatform(
      new THREE.Vector3(0, 2.2, -47.5),
      new THREE.Vector3(4.6, 0.8, 4.2),
      new THREE.Vector3(4.2, 0, 0),
      1.6,
      0,
      '#F97316',
    );
    this.createKinematicPlatform(
      new THREE.Vector3(0, 2.8, -56.5),
      new THREE.Vector3(4.6, 0.8, 4.2),
      new THREE.Vector3(-4.2, 0.9, 0),
      1.5,
      Math.PI * 0.5,
      '#06B6D4',
    );
    this.createKinematicPlatform(
      new THREE.Vector3(0, 3.2, -65.5),
      new THREE.Vector3(4.6, 0.8, 4.6),
      new THREE.Vector3(3.8, 0, 1.8),
      1.7,
      Math.PI,
      '#EC4899',
    );

    // --- CHECKPOINT 3 (Z = -75, Y = 3.2) ---
    this.createStaticBox(
      new THREE.Vector3(0, 2.7, -75),
      new THREE.Vector3(7.5, 1.0, 6.5),
      '#475569',
    );
    this.createCheckpointPad(3, new THREE.Vector3(0, 3.2, -75), false);

    // --- SEKCE 3: Rotující překážka (Kladina/Tyč, kterou musí hráč přeskočit, Z = -84 až -105) ---
    this.createStaticBox(
      new THREE.Vector3(0, 2.7, -86),
      new THREE.Vector3(7.2, 1.0, 11.0),
      '#3B82F6',
    );
    this.createRotatingSpinner(
      new THREE.Vector3(0, 3.85, -86),
      8.2,
      1.85,
      '#EF4444',
    );

    this.createStaticBox(
      new THREE.Vector3(0, 2.7, -100),
      new THREE.Vector3(7.2, 1.0, 11.0),
      '#8B5CF6',
    );
    this.createRotatingSpinner(
      new THREE.Vector3(0, 3.85, -100),
      8.2,
      -2.15,
      '#FACC15',
    );

    // --- CHECKPOINT 4 (Z = -112, Y = 3.2) ---
    this.createStaticBox(
      new THREE.Vector3(0, 2.7, -112),
      new THREE.Vector3(7.5, 1.0, 6.5),
      '#475569',
    );
    this.createCheckpointPad(4, new THREE.Vector3(0, 3.2, -112), false);

    // --- SEKCE 4: Mizící / blikající bloky s časovačem (Z = -120 až -142) ---
    // Vždy je z dvojice (levý/pravý) alespoň jeden blok pevný, nebo hráč běží ve správném rytmu
    this.createBlinkingBlock(
      new THREE.Vector3(-2.4, 2.7, -120),
      new THREE.Vector3(3.8, 0.8, 4.2),
      '#14B8A6',
      4.4,
      0.0,
    );
    this.createBlinkingBlock(
      new THREE.Vector3(2.4, 2.7, -120),
      new THREE.Vector3(3.8, 0.8, 4.2),
      '#EC4899',
      4.4,
      2.2,
    );

    this.createStaticBox(
      new THREE.Vector3(0, 2.7, -127.5),
      new THREE.Vector3(4.5, 0.9, 4.0),
      '#FACC15',
    );

    this.createBlinkingBlock(
      new THREE.Vector3(-2.4, 2.7, -135),
      new THREE.Vector3(3.8, 0.8, 4.2),
      '#EC4899',
      4.4,
      2.2,
    );
    this.createBlinkingBlock(
      new THREE.Vector3(2.4, 2.7, -135),
      new THREE.Vector3(3.8, 0.8, 4.2),
      '#14B8A6',
      4.4,
      0.0,
    );

    this.createStaticBox(
      new THREE.Vector3(0, 2.7, -142.5),
      new THREE.Vector3(4.5, 0.9, 4.0),
      '#38BDF8',
    );

    // --- CHECKPOINT 5 (Z = -150, Y = 3.2) ---
    this.createStaticBox(
      new THREE.Vector3(0, 2.7, -150),
      new THREE.Vector3(7.5, 1.0, 6.5),
      '#475569',
    );
    this.createCheckpointPad(5, new THREE.Vector3(0, 3.2, -150), false);

    // --- SEKCE 5: Závěrečné duhové schodiště k cílové zlaté truhle (Z = -157 až -194) ---
    const rainbowColors = [
      '#EF4444',
      '#F97316',
      '#FACC15',
      '#22C55E',
      '#06B6D4',
      '#3B82F6',
      '#8B5CF6',
      '#EC4899',
    ];
    for (let i = 0; i < 8; i++) {
      const stepY = 3.1 + i * 0.5;
      const stepZ = -157.5 - i * 3.8;
      this.createStaticBox(
        new THREE.Vector3(0, stepY, stepZ),
        new THREE.Vector3(5.6, 0.7, 3.0),
        rainbowColors[i % rainbowColors.length],
      );
    }

    // Vítězná plošina s cílovou zlatou truhlou (Z = -193, Y = 6.7)
    const finishTex = createStudTexture(
      '#FDE047',
      '#EAB308',
      6,
      6,
      this.maxAnisotropy,
    );
    this.createStaticBox(
      new THREE.Vector3(0, 6.6, -193),
      new THREE.Vector3(11, 1.2, 11),
      '#FFFFFF',
      { map: finishTex, roughness: 0.2 },
    );

    this.buildGoldenTreasureChest(this.chestCenter);
  }

  private createStaticBox(
    pos: THREE.Vector3,
    size: THREE.Vector3,
    color: string,
    matOptions: {
      roughness?: number;
      metalness?: number;
      map?: THREE.Texture;
    } = {},
  ): THREE.Mesh {
    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(
      pos.x,
      pos.y,
      pos.z,
    );
    const body = this.world.createRigidBody(bodyDesc);
    this.sceneBodies.push(body);

    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2,
    ).setFriction(0.6);
    this.world.createCollider(colliderDesc, body);

    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = createPlasticMaterial(color, {
      roughness: matOptions.roughness ?? 0.25,
      metalness: matOptions.metalness ?? 0.1,
      map: matOptions.map ?? null,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.sceneRoot.add(mesh);

    return mesh;
  }

  private createKinematicPlatform(
    origin: THREE.Vector3,
    size: THREE.Vector3,
    amplitude: THREE.Vector3,
    speed: number,
    phase: number,
    color: string,
  ): void {
    const bodyDesc =
      this.RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        origin.x,
        origin.y,
        origin.z,
      );
    const body = this.world.createRigidBody(bodyDesc);
    this.sceneBodies.push(body);

    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2,
    ).setFriction(0.9);
    const collider = this.world.createCollider(colliderDesc, body);

    const group = new THREE.Group();
    group.position.copy(origin);
    this.sceneRoot.add(group);

    const mainGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mainMat = createPlasticMaterial(color, {
      roughness: 0.22,
      metalness: 0.12,
    });
    const mainMesh = new THREE.Mesh(mainGeo, mainMat);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    group.add(mainMesh);

    // Kontrastní boční lem na pohyblivé plošině
    const rimGeo = new THREE.BoxGeometry(
      size.x + 0.14,
      size.y * 0.35,
      size.z + 0.14,
    );
    const rimMat = createPlasticMaterial('#FFFFFF', {
      roughness: 0.5,
      metalness: 0.15,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.castShadow = true;
    group.add(rimMesh);

    this.kinematicPlatforms.push({
      body,
      colliderHandle: collider.handle,
      mesh: group,
      origin: origin.clone(),
      amplitude: amplitude.clone(),
      speed,
      phase,
      lastPos: origin.clone(),
      deltaPos: new THREE.Vector3(),
    });
  }

  private createRotatingSpinner(
    center: THREE.Vector3,
    length: number,
    angularSpeed: number,
    color: string,
  ): void {
    // Středový sloupek kladiny
    const hubGeo = new THREE.CylinderGeometry(0.65, 0.75, 1.2, 20);
    const hubMat = createPlasticMaterial('#1E293B', {
      roughness: 0.45,
      metalness: 0.3,
    });
    const hubMesh = new THREE.Mesh(hubGeo, hubMat);
    hubMesh.position.copy(center);
    hubMesh.castShadow = true;
    this.sceneRoot.add(hubMesh);

    const bodyDesc =
      this.RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        center.x,
        center.y,
        center.z,
      );
    const body = this.world.createRigidBody(bodyDesc);
    this.sceneBodies.push(body);

    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(
      length / 2,
      0.28,
      0.32,
    ).setRestitution(0.4);
    this.world.createCollider(colliderDesc, body);

    const barGroup = new THREE.Group();
    barGroup.position.copy(center);
    this.sceneRoot.add(barGroup);

    const barGeo = new THREE.BoxGeometry(length, 0.52, 0.6);
    const barMat = createPlasticMaterial(color, {
      roughness: 0.2,
      metalness: 0.15,
      emissive: color,
      emissiveIntensity: 0.18,
    });
    const barMesh = new THREE.Mesh(barGeo, barMat);
    barMesh.castShadow = true;
    barMesh.receiveShadow = true;
    barGroup.add(barMesh);

    // Koncové žluto-černé krytky tyče
    const capGeo = new THREE.BoxGeometry(0.6, 0.6, 0.7);
    const capMat = createPlasticMaterial('#FACC15', { roughness: 0.4 });
    for (const side of [-1, 1]) {
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(side * (length / 2 - 0.25), 0, 0);
      cap.castShadow = true;
      barGroup.add(cap);
    }

    this.rotatingSpinners.push({
      body,
      mesh: barGroup,
      center: center.clone(),
      angularSpeed,
      currentAngle: 0,
    });
  }

  private createBlinkingBlock(
    pos: THREE.Vector3,
    size: THREE.Vector3,
    hexColor: string,
    cycleDuration: number,
    phaseOffset: number,
  ): void {
    const bodyDesc = this.RAPIER.RigidBodyDesc.fixed().setTranslation(
      pos.x,
      pos.y,
      pos.z,
    );
    const body = this.world.createRigidBody(bodyDesc);
    this.sceneBodies.push(body);

    const colliderDesc = this.RAPIER.ColliderDesc.cuboid(
      size.x / 2,
      size.y / 2,
      size.z / 2,
    );
    const collider = this.world.createCollider(colliderDesc, body);

    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = createPlasticMaterial(hexColor, {
      roughness: 0.22,
      metalness: 0.1,
      transparent: true,
      opacity: 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.sceneRoot.add(mesh);

    this.blinkingBlocks.push({
      body,
      collider,
      mesh,
      mat,
      baseColor: new THREE.Color(hexColor),
      warnColor: new THREE.Color('#F97316'),
      cycleDuration,
      phaseOffset,
    });
  }

  private createCheckpointPad(
    index: number,
    pos: THREE.Vector3,
    initiallyActive: boolean,
  ): void {
    const initialColor = initiallyActive ? '#22C55E' : '#F59E0B';
    const initialEmissive = initiallyActive ? '#16A34A' : '#D97706';

    const padGeo = new THREE.CylinderGeometry(1.9, 2.05, 0.24, 28);
    const padMat = createPlasticMaterial(initialColor, {
      roughness: 0.2,
      metalness: 0.15,
      emissive: initialEmissive,
      emissiveIntensity: 0.45,
    });
    const padMesh = new THREE.Mesh(padGeo, padMat);
    padMesh.position.set(pos.x, pos.y + 0.12, pos.z);
    padMesh.castShadow = true;
    padMesh.receiveShadow = true;
    this.sceneRoot.add(padMesh);

    const ringGeo = new THREE.TorusGeometry(1.95, 0.09, 12, 32);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = createPlasticMaterial(
      initiallyActive ? '#86EFAC' : '#FDE047',
      {
        roughness: 0.2,
        metalness: 0.3,
        emissive: initialEmissive,
        emissiveIntensity: 0.6,
      },
    );
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.set(pos.x, pos.y + 0.24, pos.z);
    this.sceneRoot.add(ringMesh);

    this.checkpoints.push({
      index,
      position: pos.clone(),
      respawnPoint: new THREE.Vector3(pos.x, pos.y + 0.8, pos.z),
      padMat,
      ringMat,
      activated: initiallyActive,
    });
  }

  private buildGoldenTreasureChest(pos: THREE.Vector3): void {
    const chestGroup = new THREE.Group();
    chestGroup.position.copy(pos);
    this.sceneRoot.add(chestGroup);

    const goldMat = createPlasticMaterial('#FACC15', {
      roughness: 0.18,
      metalness: 0.65,
      emissive: '#CA8A04',
      emissiveIntensity: 0.35,
    });
    const woodMat = createPlasticMaterial('#B45309', {
      roughness: 0.42,
      metalness: 0.15,
    });
    const glowMat = createPlasticMaterial('#FEF08A', {
      roughness: 0.1,
      emissive: '#FACC15',
      emissiveIntensity: 1.2,
    });

    // Spodní část truhly
    const baseGeo = new THREE.BoxGeometry(2.4, 1.2, 1.6);
    const baseMesh = new THREE.Mesh(baseGeo, woodMat);
    baseMesh.position.set(0, 0.6, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    chestGroup.add(baseMesh);

    // Zlaté kování na spodní části
    const bandGeo = new THREE.BoxGeometry(2.48, 1.24, 0.25);
    for (const bx of [-0.95, 0.95]) {
      const band = new THREE.Mesh(bandGeo, goldMat);
      band.position.set(bx, 0.6, 0);
      band.rotateY(Math.PI / 2);
      chestGroup.add(band);
    }

    const trimGeo = new THREE.BoxGeometry(2.5, 0.2, 1.68);
    const trimMesh = new THREE.Mesh(trimGeo, goldMat);
    trimMesh.position.set(0, 1.15, 0);
    chestGroup.add(trimMesh);

    // Vnitřní zářící poklad
    const treasureGeo = new THREE.BoxGeometry(2.1, 0.3, 1.3);
    const treasureMesh = new THREE.Mesh(treasureGeo, glowMat);
    treasureMesh.position.set(0, 1.18, 0);
    chestGroup.add(treasureMesh);

    // Odklápěcí víko truhly (s pivotem na zadní hraně)
    this.chestLidPivot = new THREE.Group();
    this.chestLidPivot.position.set(0, 1.2, -0.8);
    chestGroup.add(this.chestLidPivot);

    const lidGeo = new THREE.CylinderGeometry(
      0.8,
      0.8,
      2.4,
      20,
      1,
      false,
      0,
      Math.PI,
    );
    lidGeo.rotateZ(Math.PI / 2);
    const lidMesh = new THREE.Mesh(lidGeo, goldMat);
    lidMesh.position.set(0, 0, 0.8);
    lidMesh.castShadow = true;
    this.chestLidPivot.add(lidMesh);

    // Zlatý zámek vpředu
    const lockGeo = new THREE.BoxGeometry(0.42, 0.52, 0.2);
    const lockMesh = new THREE.Mesh(lockGeo, goldMat);
    lockMesh.position.set(0, -0.05, 1.62);
    this.chestLidPivot.add(lockMesh);

    // Plovoucí nápis nad truhlou
    const signTex = createSignTexture(
      'ZLATÁ TRUHLA',
      'Dotkni se truhly pro odměnu +50 ★',
      '#CA8A04',
      '#FEF08A',
      this.maxAnisotropy,
    );
    const signGeo = new THREE.BoxGeometry(4.4, 1.6, 0.18);
    const signSideMat = createPlasticMaterial('#854D0E', { roughness: 0.3 });
    const signFaceMat = createPlasticMaterial('#FFFFFF', {
      map: signTex,
      roughness: 0.2,
    });
    const signMesh = new THREE.Mesh(signGeo, [
      signSideMat,
      signSideMat,
      signSideMat,
      signSideMat,
      signFaceMat,
      signFaceMat,
    ]);
    signMesh.position.set(pos.x, pos.y + 3.6, pos.z);
    this.sceneRoot.add(signMesh);
    this.floatingSigns.push({ mesh: signMesh, baseY: pos.y + 3.6 });
  }

  // ============================================================================
  // HERNÍ SMYČKA SCÉNY (Kinematika, Kolizní zóny, Láva, Checkpointy, Truhla)
  // ============================================================================
  public update(dt: number, elapsedTime: number): void {
    this.player.getFootPosition(_playerFootPos);

    // Plovoucí 3D cedule
    for (const item of this.floatingSigns) {
      item.mesh.position.y = item.baseY + Math.sin(elapsedTime * 2.4) * 0.16;
    }

    if (this.currentScene === 'hub') {
      // Animace prstence šatny a portálu
      if (this.wardrobeRingMesh) {
        this.wardrobeRingMesh.rotation.z = elapsedTime * 0.8;
      }
      if (this.portalOuterRing && this.portalInnerRing && this.portalCoreMat) {
        this.portalOuterRing.rotation.z = elapsedTime * 1.4;
        this.portalInnerRing.rotation.z = -elapsedTime * 2.1;
        this.portalCoreMat.emissiveIntensity =
          0.95 + Math.sin(elapsedTime * 4.0) * 0.25;
      }

      // 1. Detekce vstupu do kruhové zóny Šatny
      const distToWardrobe = Math.hypot(
        _playerFootPos.x - this.wardrobeCenter.x,
        _playerFootPos.z - this.wardrobeCenter.z,
      );
      const inWardrobe = distToWardrobe < 2.95 && Math.abs(_playerFootPos.y) < 2.0;
      if (inWardrobe !== this.wasInWardrobeZone) {
        this.wasInWardrobeZone = inWardrobe;
        this.callbacks.onWardrobeZoneEnterChange(inWardrobe);
      }

      // 2. Detekce průchodu 3D Portálem do minihry Obby
      const distToPortal = Math.hypot(
        _playerFootPos.x - this.portalCenter.x,
        _playerFootPos.z - this.portalCenter.z,
      );
      if (distToPortal < 2.15 && _playerFootPos.y < 4.5) {
        soundManager.playCheckpoint();
        this.loadScene('obby');
        return;
      }

      // Pojistka při přepadnutí přes okraj ostrova v Hubu
      if (_playerFootPos.y < -3.0) {
        this.player.teleportTo(new THREE.Vector3(0, 1.2, 6), 0);
      }
    } else if (this.currentScene === 'obby') {
      // 1. Pohyblivé kinematické plošiny
      for (const plat of this.kinematicPlatforms) {
        const s = Math.sin(elapsedTime * plat.speed + plat.phase);
        const nx = plat.origin.x + plat.amplitude.x * s;
        const ny = plat.origin.y + plat.amplitude.y * s;
        const nz = plat.origin.z + plat.amplitude.z * s;

        plat.deltaPos.set(
          nx - plat.lastPos.x,
          ny - plat.lastPos.y,
          nz - plat.lastPos.z,
        );
        plat.lastPos.set(nx, ny, nz);

        plat.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
        plat.mesh.position.set(nx, ny, nz);
      }

      // 2. Rotující překážky (Kladina)
      for (const spinner of this.rotatingSpinners) {
        spinner.currentAngle += spinner.angularSpeed * dt;
        _tempEuler.set(0, spinner.currentAngle, 0);
        _tempQuat.setFromEuler(_tempEuler);

        spinner.body.setNextKinematicRotation({
          x: _tempQuat.x,
          y: _tempQuat.y,
          z: _tempQuat.z,
          w: _tempQuat.w,
        });
        spinner.mesh.quaternion.copy(_tempQuat);
      }

      // 3. Mizící / blikající bloky
      for (const block of this.blinkingBlocks) {
        const t = (elapsedTime + block.phaseOffset) % block.cycleDuration;
        const activeWindow = block.cycleDuration * 0.62;
        const warnWindow = block.cycleDuration * 0.45;

        if (t < warnWindow) {
          if (!block.collider.isEnabled()) block.collider.setEnabled(true);
          block.mesh.visible = true;
          block.mat.opacity = 1.0;
          block.mat.color.copy(block.baseColor);
        } else if (t < activeWindow) {
          // Blikající varování před zmizením
          if (!block.collider.isEnabled()) block.collider.setEnabled(true);
          block.mesh.visible = true;
          const flash = Math.sin(elapsedTime * 22) > 0;
          block.mat.color.copy(flash ? block.warnColor : block.baseColor);
          block.mat.opacity = 0.78;
        } else {
          // Dočasně zmizelý blok
          if (block.collider.isEnabled()) block.collider.setEnabled(false);
          block.mesh.visible = false;
        }
      }

      // 4. Animace svítící lávy a detekce pádu do lávy
      if (this.lavaMat && this.lavaMat.map) {
        this.lavaMat.map.offset.y = elapsedTime * 0.08;
        this.lavaMat.emissiveIntensity =
          0.8 + Math.sin(elapsedTime * 3.0) * 0.18;
      }

      if (_playerFootPos.y < -2.3) {
        soundManager.playLava();
        this.player.teleportTo(this.activeCheckpointPos);
        return;
      }

      // 5. Detekce Checkpointů
      for (const cp of this.checkpoints) {
        if (!cp.activated) {
          const dist = Math.hypot(
            _playerFootPos.x - cp.position.x,
            _playerFootPos.z - cp.position.z,
          );
          if (dist < 2.25 && Math.abs(_playerFootPos.y - cp.position.y) < 1.6) {
            cp.activated = true;
            cp.padMat.color.set('#22C55E');
            cp.padMat.emissive.set('#16A34A');
            cp.ringMat.color.set('#86EFAC');
            cp.ringMat.emissive.set('#16A34A');

            this.activeCheckpointPos.copy(cp.respawnPoint);
            soundManager.playCheckpoint();
            this.callbacks.onCheckpointReached(cp.index, this.checkpoints.length);
          }
        }
      }

      // 6. Detekce otevření Cílové zlaté truhly
      if (!this.chestOpened) {
        const distToChest = Math.hypot(
          _playerFootPos.x - this.chestCenter.x,
          _playerFootPos.z - this.chestCenter.z,
        );
        if (
          distToChest < 2.4 &&
          Math.abs(_playerFootPos.y - this.chestCenter.y) < 2.2
        ) {
          this.chestOpened = true;
          soundManager.playChestVictory();
          this.callbacks.onObbyVictory();

          this.victoryTimeoutId = window.setTimeout(() => {
            this.loadScene('hub');
          }, 2000);
        }
      } else if (this.chestLidPivot) {
        // Plynulé odklopení víka zlaté truhly
        this.chestLidPivot.rotation.x = THREE.MathUtils.damp(
          this.chestLidPivot.rotation.x,
          -1.35,
          8,
          dt,
        );
      }
    }
  }
}
