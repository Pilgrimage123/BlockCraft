/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  BodyPart,
  ColorOption,
  PersistedGameState,
  SceneId,
} from './types/game';
import {
  DEFAULT_AVATAR_COLORS,
  loadGameState,
  saveGameState,
} from './store/gameStore';
import { BlockyAvatar } from './game/Avatar';
import { PlayerController } from './game/PlayerController';
import { SceneManager } from './game/SceneManager';
import { soundManager } from './audio/SoundManager';
import { HUD } from './components/HUD';
import { WardrobeModal } from './components/WardrobeModal';
import { VictoryOverlay } from './components/VictoryOverlay';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Perzistentní stav hry (hvězdičky, odemčené barvy, barvy avatara)
  const [gameState, setGameState] = useState<PersistedGameState>(() =>
    loadGameState(),
  );
  const [activeScene, setActiveScene] = useState<SceneId>('hub');
  const [isWardrobeOpen, setIsWardrobeOpen] = useState<boolean>(false);
  const [checkpointInfo, setCheckpointInfo] = useState<{
    index: number;
    total: number;
  }>({ index: 1, total: 5 });
  const [showVictory, setShowVictory] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [engineReady, setEngineReady] = useState<boolean>(false);

  // Reference na 3D objekty pro okamžitou komunikaci z React UI bez re-inicializace WebGL
  const avatarRef = useRef<BlockyAvatar | null>(null);
  const playerRef = useRef<PlayerController | null>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const initialColorsRef = useRef(gameState.avatarColors);

  // Ukládání změn stavu do LocalStorage a okamžitý propis barev na 3D postavu
  useEffect(() => {
    saveGameState(gameState);
    if (avatarRef.current) {
      avatarRef.current.setColors(gameState.avatarColors);
    }
  }, [gameState]);

  // Při otevření 2D UI šatny uvolníme případné tažení kamery
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.setControlsDisabled(false);
    }
  }, [isWardrobeOpen]);

  // Inicializace Three.js a Rapier3D (asynchronní await RAPIER.init())
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    let disposed = false;
    let frameId = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let playerController: PlayerController | null = null;
    let sceneManager: SceneManager | null = null;

    const handleResize = () => {
      if (!renderer || !camera) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const camera = new THREE.PerspectiveCamera(
      62,
      window.innerWidth / window.innerHeight,
      0.1,
      240,
    );

    async function initEngine() {
      // 1. Povinná asynchronní inicializace WASM fyziky @dimforge/rapier3d-compat
      await RAPIER.init();
      if (disposed || !mountEl) return;

      // 2. Detekce softwarového WebGL pro optimalizaci vykreslování a plynulý běh
      const isSoftwareGl = (() => {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      })();

      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2),
      );
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      mountEl.innerHTML = '';
      mountEl.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#7DD3FC');
      scene.fog = new THREE.Fog('#7DD3FC', 38, 115);

      // Studiová odrazová mapa pro plastové a kovové povrchy
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(
        new RoomEnvironment(),
        0.04,
      ).texture;
      pmremGenerator.dispose();

      // 3. Osvětlení: HemisphereLight (světle modrá obloha / teplá zem) + DirectionalLight se stíny
      const hemiLight = new THREE.HemisphereLight('#BAE6FD', '#FDE68A', 0.85);
      hemiLight.position.set(0, 50, 0);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight('#FFFBEB', 1.65);
      dirLight.position.set(28, 48, 24);
      dirLight.castShadow = !isSoftwareGl;
      dirLight.shadow.mapSize.width = 2048;
      dirLight.shadow.mapSize.height = 2048;
      const d = 38;
      dirLight.shadow.camera.left = -d;
      dirLight.shadow.camera.right = d;
      dirLight.shadow.camera.top = d;
      dirLight.shadow.camera.bottom = -d;
      dirLight.shadow.camera.near = 1;
      dirLight.shadow.camera.far = 140;
      dirLight.shadow.bias = -0.0005;
      dirLight.shadow.normalBias = 0.02;
      scene.add(dirLight);
      scene.add(dirLight.target);

      const fillLight = new THREE.DirectionalLight('#E0F2FE', 0.45);
      fillLight.position.set(-22, 20, -18);
      scene.add(fillLight);

      // 4. Fyzikální svět Rapier3D
      const gravity = { x: 0.0, y: -24.0, z: 0.0 };
      const world = new RAPIER.World(gravity);

      const maxAnisotropy = renderer.capabilities.getMaxAnisotropy() || 4;
      const avatar = new BlockyAvatar(initialColorsRef.current, maxAnisotropy);
      avatarRef.current = avatar;

      playerController = new PlayerController(
        RAPIER,
        world,
        scene,
        camera,
        renderer.domElement,
        avatar,
      );
      playerRef.current = playerController;

      sceneManager = new SceneManager(
        RAPIER,
        world,
        scene,
        playerController,
        {
          onSceneChanged: (newSceneId) => {
            setActiveScene(newSceneId);
            if (newSceneId === 'obby') {
              setIsWardrobeOpen(false);
            } else {
              setShowVictory(false);
            }
          },
          onWardrobeZoneEnterChange: (inZone) => {
            setIsWardrobeOpen(inZone);
          },
          onCheckpointReached: (idx, total) => {
            setCheckpointInfo({ index: idx, total });
          },
          onObbyVictory: () => {
            setShowVictory(true);
            setGameState((prev) => ({
              ...prev,
              stars: prev.stars + 50,
            }));
          },
        },
        maxAnisotropy,
      );
      sceneManagerRef.current = sceneManager;

      // Načteme úvodní scénu Hlavního Hubu
      sceneManager.loadScene('hub');

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      setEngineReady(true);
      window.addEventListener('resize', handleResize);

      // 5. Herní smyčka s podporou afterDraw pro softwarové WebGL
      const clock = new THREE.Clock();

      function afterDraw(cb: () => void) {
        if (!renderer) return;
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      }

      function tick() {
        if (disposed || !renderer || !playerController || !sceneManager) return;

        const rawDelta = clock.getDelta();
        const dt = Math.min(rawDelta, 0.05);
        const elapsed = clock.getElapsedTime();

        // Posuneme kinematické plošiny a zóny
        sceneManager.update(dt, elapsed);

        // Krok fyziky Rapier3D
        world.timestep = dt;
        world.step();

        // Aktualizujeme hráče a kameru
        playerController.update(dt, elapsed, sceneManager);

        // Posouváme stínovou kameru slunce s hráčem, aby byly stíny ostré po celé Obby dráze
        const playerPos = avatar.root.position;
        dirLight.position.set(
          playerPos.x + 24,
          playerPos.y + 42,
          playerPos.z + 22,
        );
        dirLight.target.position.copy(playerPos);

        renderer.render(scene, camera);

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      }

      tick();
    }

    initEngine();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      playerController?.dispose();
      sceneManager?.clearCurrentScene();
      renderer?.dispose();
    };
  }, []);

  // Obsluha výběru nebo nákupu barvy v Šatně
  const handleSelectColor = useCallback(
    (part: BodyPart, option: ColorOption) => {
      setGameState((prev) => {
        const isUnlocked =
          option.price === 0 || prev.unlockedColors.includes(option.id);

        if (!isUnlocked) {
          if (prev.stars < option.price) return prev;
          soundManager.playPurchase();
          return {
            stars: prev.stars - option.price,
            unlockedColors: [...prev.unlockedColors, option.id],
            avatarColors: {
              ...prev.avatarColors,
              [part]: option.hex,
            },
          };
        }

        soundManager.playEquip();
        return {
          ...prev,
          avatarColors: {
            ...prev.avatarColors,
            [part]: option.hex,
          },
        };
      });
    },
    [],
  );

  const handleResetDefaultColors = useCallback(() => {
    soundManager.playEquip();
    setGameState((prev) => ({
      ...prev,
      avatarColors: { ...DEFAULT_AVATAR_COLORS },
    }));
  }, []);

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      soundManager.setMuted(next);
      return next;
    });
  }, []);

  const handleReturnToHub = useCallback(() => {
    sceneManagerRef.current?.loadScene('hub');
  }, []);

  const handleStartObby = useCallback(() => {
    soundManager.playCheckpoint();
    sceneManagerRef.current?.loadScene('obby');
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-sky-300">
      {/* Samostatný WebGL kontejner mimo sourozenecké React UI překryvy */}
      <div
        ref={canvasMountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Načítací obrazovka během inicializace WASM fyziky */}
      {!engineReady && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-sky-400 text-slate-950">
          <div className="rounded-3xl bg-white px-8 py-6 shadow-2xl border-4 border-yellow-400 text-center">
            <h1 className="font-['Outfit'] text-2xl font-extrabold mb-1">
              Stavíme 3D Blocky World...
            </h1>
            <p className="text-sm font-semibold text-slate-600">
              Inicializace fyziky Rapier3D a procedurálního světa
            </p>
          </div>
        </div>
      )}

      {/* 2D React HUD v rozích obrazovky a spodní sbalitelný dok */}
      <HUD
        activeScene={activeScene}
        stars={gameState.stars}
        checkpointIndex={checkpointInfo.index}
        totalCheckpoints={checkpointInfo.total}
        isMuted={isMuted}
        isWardrobeOpen={isWardrobeOpen}
        onToggleMute={handleToggleMute}
        onOpenWardrobe={() => setIsWardrobeOpen(true)}
        onReturnToHub={handleReturnToHub}
        onStartObby={handleStartObby}
      />

      {/* 2D Panel Šatny a Obchodu barev */}
      <WardrobeModal
        isOpen={isWardrobeOpen}
        stars={gameState.stars}
        unlockedColors={gameState.unlockedColors}
        avatarColors={gameState.avatarColors}
        onSelectColor={handleSelectColor}
        onApplyAllColor={() => {}}
        onResetDefault={handleResetDefaultColors}
        onClose={() => setIsWardrobeOpen(false)}
      />

      {/* Oslavný 2D efekt po otevření cílové zlaté truhly */}
      <VictoryOverlay visible={showVictory} />
    </div>
  );
}
