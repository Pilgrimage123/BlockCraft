# Blocky World: 3D Dobrodružný Hub & Obby Parkour

Interaktivní 3D offline hra pro děti inspirovaná světem Robloxu, postavená na čistém Three.js, fyzikálním enginu Rapier3D a React UI. Veškerá 3D grafika, animace postavy, překážkové dráhy i zvukové efekty jsou generovány 100% procedurálně přímo v kódu bez závislosti na externích souborech.

## User Review & Critical Decisions

> [!IMPORTANT]
> Shrnutí potvrzených rozhodnutí z úvodního dotazování, která řídí návrh ovládání, stavbu parkourové dráhy a systém šatny.

- **Ovládání kamery (Potvrzeno)**: Otáčení kamery třetí osoby probíhá **tažením myší se stisknutým tlačítkem** (levým či pravým). Tento přístup je pro dětské hráče nejpřirozenější, protože kurzor myši zůstává neustále viditelný a umožňuje plynulý přechod mezi hraním a klikáním na tlačítka v šatně či HUDu bez nutnosti odemykat kurzor klávesou `ESC`.
- **Struktura překážkové dráhy Obby (Potvrzeno)**: Parkour nad lávou bude rozdělen do **5 plnohodnotných sekcí** oddělených záchytnými checkpointy: (1) statické skákací bloky v různých výškách, (2) pohyblivé plošiny unášející hráče s sebou, (3) rotující kladina vyžadující načasování výskoku, (4) mizící/blikající bloky s časovačem a (5) závěrečné stoupající schodiště vedoucí k cílové zlaté truhle.
- **Detailnost přizpůsobení v Šatně (Potvrzeno)**: Hráč si může v šatně barvit **každou část těla samostatně** (hlava, trup, levá ruka, pravá ruka, levá noha, pravá noha) ze 3 základních barev zdarma a 6 prémiových barev odemykatelných za nasbírané hvězdičky.

---

## 1. Overview & Core Concept

- **Co aplikace dělá**: Nabízí dětem bezpečné, barevné 3D pískoviště se dvěma propojenými světy – klidným **Hlavním Hubem** (náměstíčko s barevným domečkem, stromy, šatnou a svítícím portálem) a akční minihrou **Obby Parkour** nad žhnoucí lávou. Hráč překonává překážky, aktivuje checkpointy, sbírá hvězdičky z cílové truhly a za ně si v šatně odemyká nové barvy pro svého „blocky" avatara.
- **Cílová skupina**: Děti a mladší hráči hledající okamžitou, intuitivní 3D zábavu v prohlížeči s veselou hračkovou estetikou a okamžitou audiovizuální odezvou.
- **Hlavní přínos**: 100% samoobslužný offline provoz bez čekání na stahování 3D modelů či zvuků – vše se generuje okamžitě procedurálně s garantovanou nulovou chybovostí externích zdrojů (zero-404) a plynulou fyzikou.

---

## 2. User Experience & Visual Design

### Klíčové uživatelské průchody (User Flows)

1. **Vstup do Hlavního Hubu**: Hráč se objeví uprostřed slunného náměstíčka obklopeného barevným domečkem se střechou a komínem, geometrickými stromy a přírodním okrajem ostrova. Pohybuje se klávesami `WASD` nebo šipkami, skáče `Mezerníkem` a rozhlíží se tažením myší.
2. **Návštěva Šatny a Obchodu**: Jakmile hráč vkročí na zvýrazněnou kruhovou plošinu Šatny, automaticky se otevře přehledný 2D panel přizpůsobení postavy. Hráč si vybere konkrétní část těla (hlava, trup, levá/pravá ruka, levá/pravá noha) a kliknutím buď okamžitě aplikuje odemčenou barvu (s přímým propisem na 3D postavu v reálném čase), nebo si za hvězdičky koupí novou prémiovou barvu za doprovodu cinknutí pokladny.
3. **Cesta Portálem do Obby Parkouru**: Hráč doběhne k rotujícímu svítícímu 3D portálu s plovoucím nápisem **„Obby Parkour"**. Dotyk s portálem vyčistí scénu Hubu a přenese hráče na startovní plošinu nad lávovým mořem.
4. **Překonávání 5 sekcí a Checkpointů**:
   - Mezi jednotlivými sekcemi leží záchytné podložky (Checkpointy). Při prvním šlápnutí se podložka přebarví ze žluté/červené na jasně zelenou, přehraje stoupající akord a uloží novou respawn pozici.
   - Pokud hráč spadne do svítící oranžovo-červené lávy pod dráhou, zazní zvuk pádu a postava se okamžitě teleportuje zpět na poslední aktivní checkpoint s vynulovanou rychlostí.
5. **Zlatá truhla a návrat do Hubu**: Na vrcholu závěrečného schodiště čeká zlatá truhla. Dotyk s truhlou spustí vítěznou fanfáru, na obrazovce se objeví oslavný 2D efekt se ziskem **+50 hvězdiček**, stav se uloží do `localStorage` a po 2 vteřinách je hráč přenesen zpět do Hlavního Hubu. Kdykoliv během parkouru se lze vrátit i ručně tlačítkem **„Zpět do Hubu"** v horní liště.

### Vizuální identita a téma

- **Estetický směr**: *Toybox Plastic Studio* – veselý, čistý „plastový" vzhled stavebnicových hraček (`MeshStandardMaterial` s `roughness: 0.25` a `metalness: 0.1`), doplněný procedurálním studiovým odrazovým prostředím (`RoomEnvironment` přes `PMREMGenerator`), měkkými stíny (`PCFSoftShadowMap`) a oblohou přecházející do jemné horizontální mlhy (`THREE.Fog`).
- **Barevná paleta a kontrast**:
  - **Pozadí 3D světa**: Jasná blankytná obloha (`#7DD3FC`) v Hubu a teplý sopečný opar (`#FED7AA` / `#7DD3FC`) s výraznou svítící lávou (`#FF4500`, `emissive: #FF2200`) v Obby.
  - **2D UI vrstva (60-30-10)**: Čisté, vysoce čitelné panely s tmavým poloprůhledným pozadím (`rgba(15, 23, 42, 0.88)`) bez použití `backdrop-filter` nad aktivním WebGL plátnem (zajišťuje plynulý chod i na softwarovém vykreslování), světlé plochy karet v šatně (`#F8FAFC`) a výrazné akcentní barvy pro hlavní akce – sluneční žlutá (`#FACC15`) pro hvězdičky, smaragdově zelená (`#22C55E`) pro aktivní stav a návratová modrá (`#3B82F6`).
- **Typografie a hierarchie**:
  - **Display nadpisy a počítadla**: `Outfit` nebo `Plus Jakarta Sans` (Bold 700, `tabular-nums` pro počítadlo hvězdiček a ceny v obchodě).
  - **Texty a nápověda ovládání**: Čistý bezpatkový font s vysokou čitelností a velkými dotykovými/klikacími plochami ($\ge 44\text{px}$) přizpůsobenými dětem.
- **Rozložení HUDu (Nulové zakrytí středu obrazovky)**:
  - Střed obrazovky s postavou je 100% volný.
  - V horních rozích leží kompaktní ukazatel aktuální lokace, počítadlo hvězdiček s ikonou a během minihry tlačítko **„Zpět do Hubu"**.
  - Ve spodní části obrazovky je ukotvená sbalitelná lišta s nápovědou ovládání (`WASD / Šipky` pohyb, `Mezerník` skok, `Tažení myší` kamera) a tlačítkem pro ztlumení zvuku.

---

## 3. Key Product Decisions & Trade-Offs

- **Rozhodnutí 1: Fyzika postavy a přenos pohybu na jedoucích plošinách**
  - *Zvolený přístup*: Dynamické těleso kapsle v `@dimforge/rapier3d-compat` s uzamčenou rotací (`body.lockRotations(true, true)`) doplněné o raycast směrem dolů (`world.castRay`) pro spolehlivou detekci země, krátký **coyote time** (120 ms tolerance po opuštění hrany plošiny) a přičítání delta posunu kinematické plošiny, na které hráč právě stojí.
  - *Proč*: Samotná fyzikální kapsle bez přenosu pohybu podložky by na plynule jedoucích plošinách (`KinematicPositionBased`) podkluzovala. Spojení raycastu s přenosem delty pohybu podložky zaručí, že pohyblivé plošiny hráče spolehlivě vezou s sebou a skoky na hranách působí odpouštějícím, dětsky přívětivým dojmem.
  - *Zvažované alternativy*: Čistě třecí přenos přes fyzikální materiál – při změně směru plošiny však postava prokluzuje nebo má zpoždění.
- **Rozhodnutí 2: Správa paměti a prevence „duchů" kolizí při přepínání scén**
  - *Zvolený přístup*: Centrální `SceneManager` si drží registr všech vytvořených `THREE.Object3D` a všech Rapier `RigidBody` / `Collider` instancí patřících aktuální scéně. Při přechodu mezi Hubem a Obby nejprve odstraní všechna scénická tělesa z Rapier `World`, uvolní geometrie, materiály i procedurální textury (`dispose()`), a teprve poté postaví novou scénu a přemístí hráče na startovní bod.
  - *Proč*: Zabraňuje únikům paměti GPU/WASM a garantuje, že v nové scéně nikdy nezůstanou neviditelné kolizní stěny z předchozí lokace.
- **Rozhodnutí 3: Procedurální syntéza zvuku přes Web Audio API**
  - *Zvolený přístup*: Samostatný `SoundManager` využívající oscilátory (`sine`, `triangle`, `square`) a šumové buffery s obálkou hlasitosti (`exponentialRampToValueAtTime`) pro všech 5 zvukových událostí: skok, checkpoint, pád do lávy, nákup v šatně a otevření cílové truhly.
  - *Proč*: Okamžitá odezva s nulovou latencí, 100% offline spolehlivost a automatická aktivace `AudioContext` při prvním stisku klávesy nebo kliknutí myší.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architektura systému a komponent

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        React Application & UI Layer                        │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │   Top HUD Overlay    │  │  Wardrobe & Shop UI  │  │ Victory Banner & │  │
│  │ (Lokace, Hvězdičky,  │  │ (Výběr 6 částí těla, │  │  Collapsible     │  │
│  │  Zpět do Hubu, Zvuk) │  │  3 free + 6 premium) │  │  Controls Dock   │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬─────────┘  │
└─────────────┼─────────────────────────┼───────────────────────┼────────────┘
              │                         │                       │
              ▼                         ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                   Game State & Persistence Store (LocalStorage)            │
│    stars: number | unlockedColors: string[] | avatarColors: AvatarConfig   │
│    activeScene: 'hub' | 'obby' | isWardrobeOpen: boolean | checkpointIdx   │
└─────────────┬─────────────────────────┬───────────────────────┬────────────┘
              │                         │                       │
              ▼                         ▼                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                       Core 3D & Physics Engine Loop                        │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │     SceneManager     │  │   PlayerController   │  │   SoundManager   │  │
│  │ - Hub Scene Builder  │  │ - Blocky 3D Avatar   │  │ - Jump Synth     │  │
│  │ - Obby Scene Builder │  │   (Shoulder/Hip Piv) │  │ - Checkpoint Sfx │  │
│  │ - Resource & Rapier  │  │ - Rapier Capsule +   │  │ - Lava Sizzle    │  │
│  │   Body Disposer      │  │   Ground Raycast     │  │ - Shop Chime     │  │
│  │ - Kinematic Updaters │  │ - 3rd Person Camera  │  │ - Chest Fanfare  │  │
│  └──────────────────────┘  └──────────────────────┘  └──────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Datový model a perzistence (`localStorage`)

Veškerý postup hráče se automaticky ukládá pod klíčem `blocky_world_save_v1`:

- **`stars`** (`number`): Celkový počet nasbíraných hvězdiček (výchozí `0`, každé dokončení Obby přidá `+50`).
- **`unlockedColors`** (`string[]`): Pole identifikátorů odemčených barev. Do začátku obsahuje 3 základní barvy zdarma (např. *Sluneční žlutá*, *Blankytná modrá*, *Trávově zelená*); dalších 6 prémiových barev (*Královská fialová*, *Ohnivá oranžová*, *Tyrkysová laguna*, *Cukrová růžová*, *Zlatá hvězda*, *Noční antracit*) je dostupných ke koupi za 25 nebo 50 hvězdiček.
- **`avatarColors`** (`Record<BodyPart, string>`): Uložená barva pro každou ze 6 částí postavy: `head`, `torso`, `leftArm`, `rightArm`, `leftLeg`, `rightLeg`.

### Mapování interakcí a stavových přechodů

1. **Hierarchie postavy a animace kloubů**:
   - Postava je sestavena jako vícečásticová `THREE.Group`: válcová hlava se zaobleným lemem a procedurální `CanvasTexture` veselého obličeje (`SRGBColorSpace`), trup a 4 končetiny.
   - Každá končetina je vložena do samostatného pivot uzlu (`leftArmPivot`, `rightArmPivot`, `leftLegPivot`, `rightLegPivot`) umístěného přesně v rameni nebo kyčli, zatímco samotná geometrie končetiny je posunuta o polovinu své výšky směrem dolů. Při pohybu kmitají protilehlé končetiny v opačné fázi `Math.sin(walkTime * speed)` a při výskoku se ruce zvednou vzhůru.
2. **Detekce zón a kolizních událostí v herní smyčce**:
   - **Zóna Šatny (Hub)**: Vzdálenostní detekce na kruhové plošině šatny plynule otevře 2D panel šatny při vstupu a automaticky jej zavře při odchodu ze zóny nebo kliknutí na tlačítko zavřít.
   - **3D Portál (Hub -> Obby)**: Vstup do prstence portálu vyvolá `sceneManager.loadScene('obby')`, který vyčistí objekty i fyzikální tělesa Hubu a vygeneruje 5 sekcí Obby dráhy.
   - **Pohyblivé a mizící překážky (Obby)**: Každý snímek aktualizuje pozici/rotaci `KinematicPositionBased` plošin a rotující kladiny pomocí `setNextKinematicTranslation` / `setNextKinematicRotation`. Sekce mizících bloků periodicky střídá varovnou barvu a dočasné vypnutí kolize/viditelnosti, aby hráč musel správně načasovat přeběhnutí.
   - **Láva, Checkpointy a Cílová truhla (Obby)**: Při klesnutí či dotyku s hladinou lávy se přivolá `soundManager.playLava()` a pozice tělesa hráče se nastaví na souřadnice posledního aktivního checkpointu. Šlápnutí na nový checkpoint jej přebarví na zelenou (`#22C55E`), uloží souřadnice a přehraje `soundManager.playCheckpoint()`. Dotyk se zlatou truhlou na konci 5. sekce přehraje `soundManager.playVictory()`, přičte `+50` hvězdiček, zobrazí 2D oslavný překryv a po 2 sekundách zavolá přechod zpět do Hubu.
