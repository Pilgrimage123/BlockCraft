import * as THREE from 'three';
import { AvatarColors } from '../types/game';
import { createPlasticMaterial, createRobloxFaceTexture } from './materials';

/**
 * Hierarchický 3D model „Blocky" postavy ve stylu Robloxu.
 * Skládá se z více částí s posunutými pivot body v ramenech a kyčlích pro plynulé kmitání končetin.
 * Celková výška postavy je ~2.3 jednotky, spodní střed (chodidla) leží v Y = 0.
 */
export class BlockyAvatar {
  public readonly root: THREE.Group;
  private readonly bodyWrap: THREE.Group;

  // Pivoty končetin v ramenech a kyčlích
  private readonly headGroup: THREE.Group;
  private readonly leftArmPivot: THREE.Group;
  private readonly rightArmPivot: THREE.Group;
  private readonly leftLegPivot: THREE.Group;
  private readonly rightLegPivot: THREE.Group;

  // Materiály jednotlivých částí těla pro okamžitou změnu barev v šatně
  private headCylinderMat: THREE.MeshStandardMaterial;
  private headCapMat: THREE.MeshStandardMaterial;
  private torsoMat: THREE.MeshStandardMaterial;
  private leftArmMat: THREE.MeshStandardMaterial;
  private rightArmMat: THREE.MeshStandardMaterial;
  private leftLegMat: THREE.MeshStandardMaterial;
  private rightLegMat: THREE.MeshStandardMaterial;

  private faceTexture: THREE.CanvasTexture;
  private maxAnisotropy: number;
  private currentHeadColor: string = '';
  private walkTime: number = 0;

  constructor(initialColors: AvatarColors, maxAnisotropy: number = 4) {
    this.maxAnisotropy = maxAnisotropy;
    this.root = new THREE.Group();
    this.bodyWrap = new THREE.Group();
    this.root.add(this.bodyWrap);

    this.currentHeadColor = initialColors.head;
    this.faceTexture = createRobloxFaceTexture(initialColors.head, maxAnisotropy);

    // 1. Materiály částí těla (plastový vzhled: roughness 0.25, metalness 0.1)
    this.headCylinderMat = createPlasticMaterial('#FFFFFF', {
      roughness: 0.22,
      metalness: 0.08,
      map: this.faceTexture,
    });
    this.headCapMat = createPlasticMaterial(initialColors.head, {
      roughness: 0.22,
      metalness: 0.08,
    });
    this.torsoMat = createPlasticMaterial(initialColors.torso, {
      roughness: 0.25,
      metalness: 0.1,
    });
    this.leftArmMat = createPlasticMaterial(initialColors.leftArm, {
      roughness: 0.25,
      metalness: 0.1,
    });
    this.rightArmMat = createPlasticMaterial(initialColors.rightArm, {
      roughness: 0.25,
      metalness: 0.1,
    });
    this.leftLegMat = createPlasticMaterial(initialColors.leftLeg, {
      roughness: 0.28,
      metalness: 0.1,
    });
    this.rightLegMat = createPlasticMaterial(initialColors.rightLeg, {
      roughness: 0.28,
      metalness: 0.1,
    });

    // Doplňkové materiály s odlišnou drsností (>= 0.25 rozdíl pro kontrast detailů)
    const trimMat = createPlasticMaterial('#1E293B', {
      roughness: 0.55,
      metalness: 0.2,
    });
    const buckleMat = createPlasticMaterial('#FACC15', {
      roughness: 0.18,
      metalness: 0.65,
    });

    // --- TRUP (Torso) ---
    // Výška nohou = 0.85, trup je od Y=0.85 do Y=1.70 (střed v Y=1.275)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.set(0, 1.275, 0);
    this.bodyWrap.add(torsoGroup);

    const torsoGeo = new THREE.BoxGeometry(0.92, 0.86, 0.48);
    const torsoMesh = new THREE.Mesh(torsoGeo, this.torsoMat);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    torsoGroup.add(torsoMesh);

    // Opasek a přezka na trupu
    const beltGeo = new THREE.BoxGeometry(0.95, 0.11, 0.51);
    const beltMesh = new THREE.Mesh(beltGeo, trimMat);
    beltMesh.position.set(0, -0.36, 0);
    beltMesh.castShadow = true;
    torsoGroup.add(beltMesh);

    const buckleGeo = new THREE.BoxGeometry(0.22, 0.14, 0.54);
    const buckleMesh = new THREE.Mesh(buckleGeo, buckleMat);
    buckleMesh.position.set(0, -0.36, 0.01);
    buckleMesh.castShadow = true;
    torsoGroup.add(buckleMesh);

    // Límeček u krku
    const collarGeo = new THREE.CylinderGeometry(0.26, 0.29, 0.08, 20);
    const collarMesh = new THREE.Mesh(collarGeo, trimMat);
    collarMesh.position.set(0, 0.45, 0);
    collarMesh.castShadow = true;
    torsoGroup.add(collarMesh);

    // --- HLAVA (Typický „Roblox" válec se zaobleným lemem a procedurálním obličejem) ---
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 2.02, 0);
    this.bodyWrap.add(this.headGroup);

    // CylinderGeometry má 3 materiálové skupiny: [0] plášť, [1] horní podstava, [2] dolní podstava
    const headCylinderGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.52, 32);
    // Otočíme válec tak, aby střed textury (U=0.5) mířil dopředu (+Z)
    headCylinderGeo.rotateY(Math.PI);
    const headMesh = new THREE.Mesh(headCylinderGeo, [
      this.headCylinderMat,
      this.headCapMat,
      this.headCapMat,
    ]);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.headGroup.add(headMesh);

    // Zaoblený horní a spodní lem hlavy + charakteristický horní výstupek (stud)
    const headTopBevelGeo = new THREE.CylinderGeometry(0.32, 0.38, 0.07, 32);
    const headTopBevel = new THREE.Mesh(headTopBevelGeo, this.headCapMat);
    headTopBevel.position.set(0, 0.29, 0);
    headTopBevel.castShadow = true;
    this.headGroup.add(headTopBevel);

    const headBottomBevelGeo = new THREE.CylinderGeometry(0.38, 0.31, 0.06, 32);
    const headBottomBevel = new THREE.Mesh(headBottomBevelGeo, this.headCapMat);
    headBottomBevel.position.set(0, -0.29, 0);
    headBottomBevel.castShadow = true;
    this.headGroup.add(headBottomBevel);

    const headStudGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20);
    const headStud = new THREE.Mesh(headStudGeo, this.headCapMat);
    headStud.position.set(0, 0.34, 0);
    headStud.castShadow = true;
    this.headGroup.add(headStud);

    // --- LEVÁ A PRAVÁ RUKA (Pivot v rameni Y = 1.64) ---
    const armHeight = 0.78;
    const armGeo = new THREE.BoxGeometry(0.34, armHeight, 0.36);
    const cuffGeo = new THREE.BoxGeometry(0.36, 0.1, 0.38);

    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.66, 1.64, 0);
    this.bodyWrap.add(this.leftArmPivot);

    const leftArmMesh = new THREE.Mesh(armGeo, this.leftArmMat);
    leftArmMesh.position.set(0, -armHeight / 2, 0);
    leftArmMesh.castShadow = true;
    leftArmMesh.receiveShadow = true;
    this.leftArmPivot.add(leftArmMesh);

    const leftCuff = new THREE.Mesh(cuffGeo, trimMat);
    leftCuff.position.set(0, -armHeight + 0.12, 0);
    leftCuff.castShadow = true;
    this.leftArmPivot.add(leftCuff);

    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.66, 1.64, 0);
    this.bodyWrap.add(this.rightArmPivot);

    const rightArmMesh = new THREE.Mesh(armGeo, this.rightArmMat);
    rightArmMesh.position.set(0, -armHeight / 2, 0);
    rightArmMesh.castShadow = true;
    rightArmMesh.receiveShadow = true;
    this.rightArmPivot.add(rightArmMesh);

    const rightCuff = new THREE.Mesh(cuffGeo, trimMat);
    rightCuff.position.set(0, -armHeight + 0.12, 0);
    rightCuff.castShadow = true;
    this.rightArmPivot.add(rightCuff);

    // --- LEVÁ A PRAVÁ NOHA (Pivot v kyčli Y = 0.85) ---
    const legHeight = 0.85;
    const legGeo = new THREE.BoxGeometry(0.41, legHeight, 0.44);
    const soleGeo = new THREE.BoxGeometry(0.43, 0.11, 0.48);

    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.24, 0.85, 0);
    this.bodyWrap.add(this.leftLegPivot);

    const leftLegMesh = new THREE.Mesh(legGeo, this.leftLegMat);
    leftLegMesh.position.set(0, -legHeight / 2, 0);
    leftLegMesh.castShadow = true;
    leftLegMesh.receiveShadow = true;
    this.leftLegPivot.add(leftLegMesh);

    const leftSole = new THREE.Mesh(soleGeo, trimMat);
    leftSole.position.set(0, -legHeight + 0.055, 0.02);
    leftSole.castShadow = true;
    this.leftLegPivot.add(leftSole);

    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.24, 0.85, 0);
    this.bodyWrap.add(this.rightLegPivot);

    const rightLegMesh = new THREE.Mesh(legGeo, this.rightLegMat);
    rightLegMesh.position.set(0, -legHeight / 2, 0);
    rightLegMesh.castShadow = true;
    rightLegMesh.receiveShadow = true;
    this.rightLegPivot.add(rightLegMesh);

    const rightSole = new THREE.Mesh(soleGeo, trimMat);
    rightSole.position.set(0, -legHeight + 0.055, 0.02);
    rightSole.castShadow = true;
    this.rightLegPivot.add(rightSole);
  }

  /**
   * Okamžitě propíše nové barvy z 2D Šatny na 3D postavu.
   */
  public setColors(colors: AvatarColors): void {
    if (colors.head !== this.currentHeadColor) {
      this.currentHeadColor = colors.head;
      const oldTex = this.faceTexture;
      this.faceTexture = createRobloxFaceTexture(colors.head, this.maxAnisotropy);
      this.headCylinderMat.map = this.faceTexture;
      this.headCylinderMat.needsUpdate = true;
      this.headCapMat.color.set(colors.head);
      oldTex.dispose();
    }

    this.torsoMat.color.set(colors.torso);
    this.leftArmMat.color.set(colors.leftArm);
    this.rightArmMat.color.set(colors.rightArm);
    this.leftLegMat.color.set(colors.leftLeg);
    this.rightLegMat.color.set(colors.rightLeg);
  }

  /**
   * Plynulá procedurální animace chůze, dýchání a skoku pomocí Math.sin(time * speed).
   */
  public updateAnimation(
    dt: number,
    horizontalSpeed: number,
    isGrounded: boolean,
    elapsedTime: number,
  ): void {
    const isMoving = horizontalSpeed > 0.35;

    if (!isGrounded) {
      // Ve výskoku zvedneme ruce radostně nahoru a mírně pokrčíme nohy
      this.leftArmPivot.rotation.x = THREE.MathUtils.damp(
        this.leftArmPivot.rotation.x,
        -2.55,
        12,
        dt,
      );
      this.rightArmPivot.rotation.x = THREE.MathUtils.damp(
        this.rightArmPivot.rotation.x,
        -2.55,
        12,
        dt,
      );
      this.leftLegPivot.rotation.x = THREE.MathUtils.damp(
        this.leftLegPivot.rotation.x,
        0.42,
        12,
        dt,
      );
      this.rightLegPivot.rotation.x = THREE.MathUtils.damp(
        this.rightLegPivot.rotation.x,
        -0.42,
        12,
        dt,
      );
      this.bodyWrap.position.y = THREE.MathUtils.damp(this.bodyWrap.position.y, 0, 12, dt);
    } else if (isMoving) {
      const freq = 11.5;
      this.walkTime += dt * freq;
      const swing = Math.sin(this.walkTime) * 0.78;

      this.leftArmPivot.rotation.x = THREE.MathUtils.damp(
        this.leftArmPivot.rotation.x,
        swing,
        16,
        dt,
      );
      this.rightArmPivot.rotation.x = THREE.MathUtils.damp(
        this.rightArmPivot.rotation.x,
        -swing,
        16,
        dt,
      );
      this.leftLegPivot.rotation.x = THREE.MathUtils.damp(
        this.leftLegPivot.rotation.x,
        -swing,
        16,
        dt,
      );
      this.rightLegPivot.rotation.x = THREE.MathUtils.damp(
        this.rightLegPivot.rotation.x,
        swing,
        16,
        dt,
      );

      // Jemné pohupování při běhu
      this.bodyWrap.position.y = Math.abs(Math.sin(this.walkTime)) * 0.07;
      this.headGroup.rotation.y = Math.sin(this.walkTime * 0.5) * 0.08;
    } else {
      // Klidový postoj (Idle)
      const idleSwing = Math.sin(elapsedTime * 2.2) * 0.05;
      this.leftArmPivot.rotation.x = THREE.MathUtils.damp(
        this.leftArmPivot.rotation.x,
        idleSwing,
        10,
        dt,
      );
      this.rightArmPivot.rotation.x = THREE.MathUtils.damp(
        this.rightArmPivot.rotation.x,
        -idleSwing,
        10,
        dt,
      );
      this.leftLegPivot.rotation.x = THREE.MathUtils.damp(
        this.leftLegPivot.rotation.x,
        0,
        10,
        dt,
      );
      this.rightLegPivot.rotation.x = THREE.MathUtils.damp(
        this.rightLegPivot.rotation.x,
        0,
        10,
        dt,
      );
      this.bodyWrap.position.y = THREE.MathUtils.damp(this.bodyWrap.position.y, 0, 10, dt);
      this.headGroup.rotation.y = THREE.MathUtils.damp(
        this.headGroup.rotation.y,
        Math.sin(elapsedTime * 1.4) * 0.06,
        6,
        dt,
      );
    }
  }
}
