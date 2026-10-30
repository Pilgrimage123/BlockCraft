import * as THREE from 'three';

export interface PlasticMaterialOptions {
  roughness?: number;
  metalness?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  map?: THREE.Texture | null;
  transparent?: boolean;
  opacity?: number;
  polygonOffset?: boolean;
}

/**
 * Vytvoří lesklý „plastový" PBR materiál ve stylu Roblox/stavebnice.
 * Výchozí hodnoty: roughness 0.25, metalness 0.1.
 */
export function createPlasticMaterial(
  color: THREE.ColorRepresentation,
  options: PlasticMaterialOptions = {},
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.25,
    metalness: options.metalness ?? 0.1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    map: options.map ?? null,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });

  if (options.polygonOffset) {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -1;
  }

  return mat;
}

/**
 * Vykreslí veselý „Roblox" obličej na 2D CanvasTexture (mapovaný na plášť válce hlavy).
 */
export function createRobloxFaceTexture(
  headHexColor: string,
  maxAnisotropy: number = 4,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Základní barva hlavy po celém obvodu válce
  ctx.fillStyle = headHexColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Střed obličeje na válci v Three.js CylinderGeometry odpovídá X = 256 (U = 0.5)
  const cx = 256;
  const cy = 128;

  // Jemné tvářičky
  ctx.fillStyle = 'rgba(244, 63, 94, 0.28)';
  ctx.beginPath();
  ctx.ellipse(cx - 52, cy + 16, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 52, cy + 16, 16, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Levé a pravé oko
  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.roundRect(cx - 38, cy - 28, 18, 28, 9);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(cx + 20, cy - 28, 18, 28, 9);
  ctx.fill();

  // Bílé odlesky v očích
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx - 32, cy - 19, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 26, cy - 19, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Veselý úsměv
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy + 4, 28, 0.18 * Math.PI, 0.82 * Math.PI, false);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Vytvoří procedurální plastovou „stud" (stavebnicovou) texturu pro povrchy plošin.
 */
export function createStudTexture(
  baseHex: string,
  accentHex: string,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number = 4,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);

  // Jemný rámeček dlaždice
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 124);

  // 4 stavebnicové výstupky (studs)
  const positions = [
    [32, 32],
    [96, 32],
    [32, 96],
    [96, 96],
  ];
  for (const [x, y] of positions) {
    ctx.fillStyle = accentHex;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 13, Math.PI * 0.8, Math.PI * 1.8);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Vytvoří procedurální 2D nápis na plovoucí ceduli (např. „Obby Parkour" nebo „Šatna").
 */
export function createSignTexture(
  title: string,
  subtitle: string,
  bgHex: string,
  borderHex: string,
  maxAnisotropy: number = 4,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  // Pozadí cedule
  ctx.fillStyle = bgHex;
  ctx.beginPath();
  ctx.roundRect(8, 8, 496, 176, 28);
  ctx.fill();

  // Výrazný okraj
  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(12, 12, 488, 168, 24);
  ctx.stroke();

  // Hlavní nadpis
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 54px Outfit, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 256, 78);

  // Podtitulek
  ctx.fillStyle = '#FDE047';
  ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subtitle, 256, 136);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}
