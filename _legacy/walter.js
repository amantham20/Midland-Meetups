/* =====================================================================
   WALTER VS WIZARDS
   A 2D wave-based brawler. Same mid-century modern visual language as
   Wizards & Waffles (bold primary colors, simple flat shapes), but a
   different genre: free-roam movement + climbing across a scrolling
   world, melee + spell combat, and a crystal economy.

   Shares this page with Wizards & Waffles, so this file only reacts to
   input when its OWN canvas is focused — see initGame() at the bottom.

   THIS FIRST PASS covers: movement/climbing/camera, melee combat, all
   five spells (functional, but no visual "skill tree" UI — the altar is
   a simple buy list), the three-zone world, wave spawning with the
   90%-knights-drifting-to-mixed ratio, crystal carry/bank/spend/lose.
   NOT yet included (by design, for a later pass): persistent save
   across sessions, and a shared leaderboard.

   TUNING: every number worth playing with lives in CONFIG below.
   ===================================================================== */

(function(){

  /* ==================== CONFIG ==================== */
  const CANVAS_W = 640;
  const CANVAS_H = 460;
  const GROUND_Y = 400;

  const COLORS = {
    skyTower: "#EDE6D6",
    skyWall: "#F5F0E6",
    skyFair: "#FBEFD8",
    wallStone: "#9C9284",
    wallStoneDark: "#7A7264",
    ground: "#1F2430",
    tower: "#8B5A2B",
    towerDark: "#6B4222",
    ladder: "#C9922A",
    chest: "#B8860B",
    treeTrunk: "#6B4222",
    treeCanopy: "#2D6A4F",
    chestLid: "#8B5A2B",
    altarGlow: "#F6C945",
    player: "#1B7A4A",
    playerLeather: "#8B5A2B",
    playerSteel: "#9CA3AF",
    playerSword: "#9CA3AF",
    swordHilt: "#6B4222",
    knight: "#5B6472",
    knightTrim: "#E5484D",
    archer: "#2851E3",
    archerBow: "#8B5A2B",
    wizardCloak: "#1B3A8F",
    wizardHat: "#132A66",
    wizardBeard: "#FFFFFF",
    arrow: "#6B4222",
    fireball: "#E14B3C",
    lightning: "#7FD4E8",
    freeze: "#8FE3F0",
    blackHole: "#2B1B4A",
    ally: "#F6A93B",
    hud: "#1F2430",
    hpGood: "#12B76A",
    hpBad: "#E14B3C",
    armor: "#9CA3AF",
    armorBg: "#4B5563",
    mana: "#8B5CF6",
    manaBg: "#3D2E5C",
    silver: "#8A94A6"
  };

  // World zones, left to right
  const TOWER_WIDTH = 260;
  const WALL_WIDTH = 900;
  const FAIR_WIDTH = 900;
  const TOWER_END = TOWER_WIDTH;
  const WALL_END = TOWER_END + WALL_WIDTH;
  const FAIR_END = WALL_END + FAIR_WIDTH;
  const WORLD_WIDTH = FAIR_END;

  const TOWER_X = 130;              // center of the tower/ladder
  const LADDER_HALF_WIDTH = 22;
  const ALTAR_Y = GROUND_Y - 240;   // how high the altar sits
  const CHEST_X = TOWER_X - 60;
  const CHEST_W = 40, CHEST_H = 28;

  // Trees in the fair grounds — solid to projectiles (both Walter's and
  // enemies'), not to movement, so standing behind one blocks incoming
  // shots without physically trapping the player against it.
  const TREE_W = 22, TREE_H = 95;
  const TREES = [150, 350, 550, 750].map(offset => ({ x: WALL_END + offset, w: TREE_W, h: TREE_H }));

  // Cosmetic castle wall backdrop, spanning the wall zone. Purely visual —
  // drawn behind everything, no collision.
  const CASTLE_WALL_HEIGHT = 150;
  const CRENEL_UNIT = 40; // width of one merlon + gap pair

  const PLAYER_W = 28, PLAYER_H = 42;
  const PLAYER_MAX_HP = 100;
  const MOVE_SPEED = 3.2;
  const GRAVITY = 0.7;
  const JUMP_VELOCITY = -11;
  const CLIMB_SPEED = 2.6;
  const RESPAWN_INVULN_FRAMES = 90;
  const HIT_INVULN_FRAMES = 30;

  const MELEE_RANGE = 34;
  const MELEE_DAMAGE = 30; // was 18 — now a one-shot against knights/archers/wizards
  const MELEE_COOLDOWN = 22;

  const ENEMY_STATS = {
    knight:  { hp: 30, speed: 1.4, damage: 8,  attackCooldown: 50, contactRange: 30, w: 26, h: 40, dropsSilver: true },
    archer:  { hp: 22, speed: 1.1, damage: 10, attackCooldown: 80, preferredRange: 220, projectileSpeed: 6,   w: 24, h: 38 },
    wizard:  { hp: 26, speed: 1.0, damage: 14, attackCooldown: 90, preferredRange: 260, projectileSpeed: 6.5, w: 26, h: 40, dropsCrystal: true }
  };

  // Tougher wizard variants — same base stats as a regular wizard, just
  // harder-hitting, and each one starts appearing once totalKills crosses
  // its threshold. No thresholds were specified, so these are a starting
  // guess (escalating every so often) — easy to retune here.
  const WIZARD_TIERS = [
    { key: "wizard",       label: "Wizard",        cloakColor: null,      damageMultiplier: 1,    minKills: 0   },
    { key: "wizardYellow", label: "Yellow Wizard", cloakColor: "#F6C945", damageMultiplier: 1.25, minKills: 20  },
    { key: "wizardBlack",  label: "Black Wizard",  cloakColor: "#1F2430", damageMultiplier: 1.5,  minKills: 50  },
    { key: "wizardRed",    label: "Red Wizard",    cloakColor: "#E14B3C", damageMultiplier: 1.75, minKills: 100 }
  ];
  WIZARD_TIERS.forEach(tier => {
    if (tier.key === "wizard") return; // base wizard is already defined above
    ENEMY_STATS[tier.key] = {
      ...ENEMY_STATS.wizard,
      damage: Math.round(ENEMY_STATS.wizard.damage * tier.damageMultiplier)
    };
  });

  const SPAWN_INTERVAL_MIN = 70;
  const SPAWN_INTERVAL_MAX = 140;
  const RATIO_SHIFT_KILLS = 60; // kills to fully shift from 90/5/5 toward 40/30/30

  const CRYSTAL_PER_WIZARD = 1;
  const SILVER_PER_KNIGHT = 1;

  const SPELLS = {
    fireball:    { label: "Fireball",     cost: 10, damage: 20, speed: 8, splashRadius: 80, burnDuration: 120, burnDamagePerFrame: 0.4, cooldown: 30 },
    lightning:   { label: "Lightning",    cost: 10, damage: 26, range: 260, chainMax: 3, cooldown: 45 },
    freeze:      { label: "Freeze",       cost: 10, radius: 120, duration: 180, cooldown: 240 },
    summonAlly:  { label: "Summon Ally",  cost: 10, allyDuration: 900, allyDamage: 12, allyHp: 40, cooldown: 300 },
    blackHole:   { label: "Black Hole",   cost: 10, radius: 100, duration: 180, damagePerFrame: 0.3, pullStrength: 3.5, cooldown: 360 }
  };
  const SPELL_ORDER = ["fireball", "lightning", "freeze", "summonAlly", "blackHole"];

  // Armor is a consumable HP buffer bought with silver (from knights), separate
  // from the crystal/spell economy. Damage drains armor before Walter's own HP.
  // Buying a new piece replaces whatever's left of the current one.
  const ARMOR = {
    leather: { label: "Leather Armor", cost: 5,  multiplier: 1.5 },
    steel:   { label: "Steel Armor",   cost: 10, multiplier: 2 }
  };
  const ARMOR_ORDER = ["leather", "steel"];

  // Mana gates spell casting on top of each spell's own cooldown. Regen is
  // slow enough relative to cost that draining it acts as a natural extra
  // cooldown: 5 mana per cast, 1 mana/sec regen = ~5 seconds to recover a cast.
  const MANA_COST_PER_SPELL = 5;
  const MANA_REGEN_PER_SECOND = 1;
  const MANA_REGEN_PER_FRAME = MANA_REGEN_PER_SECOND / 60;
  const MAX_MANA_START = 50;
  const MANA_UPGRADE_COST_SILVER = 100;
  const MANA_UPGRADE_AMOUNT = 10;

  // Letter code for each spell in the progress-save string (F/L/Z/S/B),
  // uppercase = unlocked, lowercase = locked. "fireball" and "freeze" both
  // start with F, so freeze uses Z and summonAlly uses S to keep every
  // letter unique.
  const SPELL_LETTERS = [
    { key: "fireball",   letter: "F" },
    { key: "lightning",  letter: "L" },
    { key: "freeze",     letter: "Z" },
    { key: "summonAlly", letter: "S" },
    { key: "blackHole",  letter: "B" }
  ];

  const DEBUG = true; // logs key events to the console — flip to false once things look right
  /* ==================== end config ==================== */

  let canvas, ctx, overlay, overlayInner;
  let player, enemies, playerProjectiles, enemyProjectiles, allies, effects;
  let cameraX, frame, totalKills, keysDown;
  let spellCooldowns, spellUnlocked, activeSpell, meleeCooldown;
  let respawnMessageTimer, respawnMessageText;
  let altarOpen, started, running;
  let animId, nextSpawnFrame;
  let walterName, walterPassword, walterGuestMode, loadedProgress, loginComplete;

  /* ---------------- helpers ---------------- */
  function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

  function rectsOverlap(x1,y1,w1,h1,x2,y2,w2,h2){
    const pad = 3;
    return x1+pad < x2+w2-pad && x1+w1-pad > x2+pad && y1+pad < y2+h2-pad && y1+h1-pad > y2+pad;
  }

  function currentZone(x){
    if (x < TOWER_END) return "tower";
    if (x < WALL_END) return "wall";
    return "fair";
  }

  function currentRatios(){
    const t = Math.min(1, totalKills / RATIO_SHIFT_KILLS);
    return {
      knight: 0.9 - 0.5 * t,
      archer: 0.05 + 0.25 * t,
      wizard: 0.05 + 0.25 * t
    };
  }

  function totalCrystals(){
    return player.carriedCrystals + player.bankedCrystals;
  }

  function buyArmor(key){
    const cfg = ARMOR[key];
    if (!cfg || player.silver < cfg.cost) return false;
    player.silver -= cfg.cost;
    player.armorType = key;
    player.armorMaxHp = Math.round(PLAYER_MAX_HP * cfg.multiplier);
    player.armorHp = player.armorMaxHp; // replaces whatever armor was left, if any
    if (DEBUG) console.log("[WvW] bought " + key + " armor, armorHp=" + player.armorHp);
    return true;
  }

  function buyManaUpgrade(){
    if (player.silver < MANA_UPGRADE_COST_SILVER) return false;
    player.silver -= MANA_UPGRADE_COST_SILVER;
    player.maxMana += MANA_UPGRADE_AMOUNT;
    if (DEBUG) console.log("[WvW] max mana increased to " + player.maxMana);
    return true;
  }

  /* ---------------- progress save/load codex ----------------
     Format: $<silver>$&<5 spell letters>&@<banked crystals>@!<armor L/S/N>!
     Spell letters use SPELL_LETTERS above, uppercase = unlocked.
     Only banked crystals persist — carried (at-risk) crystals are always
     0 at the start of a session, same as any other respawn. Kill count
     and HP aren't part of this format, so both reset each session too. */
  function encodeProgress(){
    const spellStr = SPELL_LETTERS.map(({ key, letter }) =>
      spellUnlocked.has(key) ? letter.toUpperCase() : letter.toLowerCase()
    ).join("");
    const armorChar = player.armorType === "leather" ? "L" : player.armorType === "steel" ? "S" : "N";
    return "$" + player.silver + "$&" + spellStr + "&@" + player.bankedCrystals + "@!" + armorChar + "!#" + player.maxMana + "#";
  }

  function decodeProgress(str){
    const result = { silver: 0, crystals: 0, armor: "none", spells: new Set(), maxMana: MAX_MANA_START };
    if (!str) return result;
    // The #maxMana# segment is optional so saves from before this feature still load fine.
    const m = String(str).match(/\$(\d+)\$&([A-Za-z]*)&@(\d+)@!([LSN])!(?:#(\d+)#)?/);
    if (!m) return result;
    result.silver = parseInt(m[1], 10) || 0;
    result.crystals = parseInt(m[3], 10) || 0;
    result.armor = m[4] === "L" ? "leather" : m[4] === "S" ? "steel" : "none";
    result.maxMana = m[5] ? (parseInt(m[5], 10) || MAX_MANA_START) : MAX_MANA_START;
    const spellChars = m[2] || "";
    SPELL_LETTERS.forEach(({ key, letter }, i) => {
      if (spellChars[i] && spellChars[i] === letter.toUpperCase()) result.spells.add(key);
    });
    return result;
  }

  function applyLoadedProgress(){
    if (!loadedProgress) return;
    player.silver = loadedProgress.silver;
    player.bankedCrystals = loadedProgress.crystals;
    player.maxMana = loadedProgress.maxMana;
    player.mana = loadedProgress.maxMana; // start each session with mana full, same as HP
    loadedProgress.spells.forEach(key => spellUnlocked.add(key));
    if (loadedProgress.armor !== "none"){
      player.armorType = loadedProgress.armor;
      player.armorMaxHp = Math.round(PLAYER_MAX_HP * ARMOR[loadedProgress.armor].multiplier);
      player.armorHp = player.armorMaxHp;
    }
  }

  async function saveProgress(){
    if (walterGuestMode || !walterName) return; // guest / not logged in — nothing to save to
    try{
      const res = await apiPost({ action: "walterSaveProgress", name: walterName, password: walterPassword, progress: encodeProgress() });
      if (DEBUG) console.log("[WvW] progress saved: " + encodeProgress(), res);
    }catch(err){
      console.error("[WvW] save failed", err);
    }
  }

  function spendCrystals(cost){
    let remaining = cost;
    const fromCarried = Math.min(player.carriedCrystals, remaining);
    player.carriedCrystals -= fromCarried;
    remaining -= fromCarried;
    player.bankedCrystals -= remaining;
  }

  /* ---------------- state ---------------- */
  function resetState(){
    player = {
      x: TOWER_X, y: GROUND_Y - PLAYER_H, vy: 0, onGround: true, onLadder: false,
      facing: 1, hp: PLAYER_MAX_HP,
      carriedCrystals: 0, bankedCrystals: 0, silver: 0,
      armorType: null, armorHp: 0, armorMaxHp: 0,
      mana: MAX_MANA_START, maxMana: MAX_MANA_START,
      invulnFrames: RESPAWN_INVULN_FRAMES
    };
    enemies = [];
    playerProjectiles = [];
    enemyProjectiles = [];
    allies = [];
    effects = [];
    cameraX = 0;
    frame = 0;
    totalKills = 0;
    keysDown = new Set();
    spellCooldowns = { fireball: 0, lightning: 0, freeze: 0, summonAlly: 0, blackHole: 0 };
    spellUnlocked = new Set();
    activeSpell = null; // null = sword
    meleeCooldown = 0;
    respawnMessageTimer = 0;
    respawnMessageText = "";
    altarOpen = false;
    nextSpawnFrame = 90;
    running = true;
  }

  /* ---------------- input ---------------- */
  function onKeyDown(e){
    if (document.activeElement !== canvas) return;
    if (!started){ if (loginComplete) startGame(); return; }
    if (altarOpen) return; // altar has its own buttons, don't also move/attack behind it

    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Space"].includes(e.code)) e.preventDefault();
    keysDown.add(e.code);

    if (e.code === "Space"){
      if (activeSpell) castSpell(activeSpell);
      else meleeAttack();
    }

    if (e.code === "ArrowUp"){
      const onLadderNow = Math.abs(player.x + PLAYER_W/2 - TOWER_X) < LADDER_HALF_WIDTH && currentZone(player.x) === "tower";
      if (!onLadderNow) jumpIfGrounded();
    }

    const numMatch = e.code.match(/^Digit([1-5])$/);
    if (numMatch){
      const idx = Number(numMatch[1]) - 1;
      const key = SPELL_ORDER[idx];
      if (key && spellUnlocked.has(key)){
        activeSpell = (activeSpell === key) ? null : key;
      }
    }
  }
  function onKeyUp(e){
    keysDown.delete(e.code);
  }

  function handleTap(clientX){
    if (!started){ if (loginComplete) startGame(); return; }
    const rect = canvas.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    if (relX < 0.33) keysDown.add("ArrowLeft");
    else if (relX > 0.66) keysDown.add("ArrowRight");
    else if (activeSpell) castSpell(activeSpell); else meleeAttack();
  }

  /* ---------------- update ---------------- */
  function update(){
    frame++;
    updatePlayerMovement();
    updateCamera();
    updateCooldowns();
    updateMana();
    updateWaveSpawning();
    updateEnemies();
    updateProjectiles();
    updateAllies();
    updateEffects();
    checkChestAndAltar();
    if (respawnMessageTimer > 0) respawnMessageTimer--;
  }

  function updateMana(){
    if (player.mana < player.maxMana){
      player.mana = Math.min(player.maxMana, player.mana + MANA_REGEN_PER_FRAME);
    }
  }

  function updatePlayerMovement(){
    const onLadderNow = Math.abs(player.x + PLAYER_W/2 - TOWER_X) < LADDER_HALF_WIDTH &&
                         player.y + PLAYER_H > GROUND_Y - 260 && currentZone(player.x) === "tower";

    if (onLadderNow && (keysDown.has("ArrowUp") || keysDown.has("ArrowDown"))){
      player.onLadder = true;
      player.vy = 0;
      if (keysDown.has("ArrowUp")) player.y -= CLIMB_SPEED;
      if (keysDown.has("ArrowDown")) player.y += CLIMB_SPEED;
      player.y = clamp(player.y, ALTAR_Y - PLAYER_H + 10, GROUND_Y - PLAYER_H);
      player.onGround = player.y >= GROUND_Y - PLAYER_H - 0.5;
    }else{
      player.onLadder = false;
      player.vy += GRAVITY;
      player.y += player.vy;
      if (player.y >= GROUND_Y - PLAYER_H){
        player.y = GROUND_Y - PLAYER_H;
        player.vy = 0;
        player.onGround = true;
      }else{
        player.onGround = false;
      }
    }

    if (keysDown.has("ArrowLeft")){ player.x -= MOVE_SPEED; player.facing = -1; }
    if (keysDown.has("ArrowRight")){ player.x += MOVE_SPEED; player.facing = 1; }
    player.x = clamp(player.x, 0, WORLD_WIDTH - PLAYER_W);

    if (player.invulnFrames > 0) player.invulnFrames--;
  }

  function jumpIfGrounded(){
    if (player.onGround && !player.onLadder){
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
    }
  }

  function updateCamera(){
    cameraX = clamp(player.x + PLAYER_W/2 - CANVAS_W/2, 0, Math.max(0, WORLD_WIDTH - CANVAS_W));
  }

  function updateCooldowns(){
    if (meleeCooldown > 0) meleeCooldown--;
    SPELL_ORDER.forEach(k => { if (spellCooldowns[k] > 0) spellCooldowns[k]--; });
  }

  /* ---------------- combat: player ---------------- */
  function meleeAttack(){
    if (meleeCooldown > 0) return;
    meleeCooldown = MELEE_COOLDOWN;
    const hitX = player.facing > 0 ? player.x + PLAYER_W : player.x - MELEE_RANGE;
    enemies.forEach(en => {
      if (en.hp > 0 && rectsOverlap(hitX, player.y, MELEE_RANGE, PLAYER_H, en.x, en.y, en.w, en.h)){
        damageEnemy(en, MELEE_DAMAGE);
      }
    });
  }

  function castSpell(key){
    const cfg = SPELLS[key];
    if (!cfg || spellCooldowns[key] > 0) return;
    if (player.mana < MANA_COST_PER_SPELL) return;
    spellCooldowns[key] = cfg.cooldown;
    player.mana -= MANA_COST_PER_SPELL;

    if (key === "fireball"){
      playerProjectiles.push({
        type: "fireball", x: player.x + PLAYER_W/2, y: player.y + PLAYER_H/2,
        vx: cfg.speed * player.facing, damage: cfg.damage
      });
    }else if (key === "lightning"){
      // Chain lightning: bridges from Walter to the nearest enemy, then from
      // that enemy to the next nearest (not yet hit), up to chainMax links.
      const chainPoints = [{ x: player.x + PLAYER_W/2, y: player.y + PLAYER_H/2 }];
      const hitSoFar = [];
      let fromX = chainPoints[0].x, fromY = chainPoints[0].y;

      for (let i = 0; i < cfg.chainMax; i++){
        let nearest = null, nearestDist = Infinity;
        enemies.forEach(en => {
          if (en.hp <= 0 || hitSoFar.includes(en)) return;
          const enCx = en.x + en.w/2, enCy = en.y + en.h/2;
          const dx = enCx - fromX, dy = enCy - fromY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist <= cfg.range && dist < nearestDist){
            nearest = en;
            nearestDist = dist;
          }
        });
        if (!nearest) break;
        hitSoFar.push(nearest);
        damageEnemy(nearest, cfg.damage);
        const enCx = nearest.x + nearest.w/2, enCy = nearest.y + nearest.h/2;
        chainPoints.push({ x: enCx, y: enCy });
        fromX = enCx; fromY = enCy;
      }

      effects.push({ type: "lightning-chain", points: chainPoints, life: 10 });
    }else if (key === "freeze"){
      const originX = player.x + PLAYER_W/2, originY = player.y + PLAYER_H/2;
      enemies.forEach(en => {
        const dx = (en.x + en.w/2) - originX, dy = (en.y + en.h/2) - originY;
        if (Math.sqrt(dx*dx + dy*dy) < cfg.radius) en.frozenFrames = cfg.duration;
      });
      effects.push({ type: "freeze-burst", x: originX, y: originY, radius: cfg.radius, life: 20 });
    }else if (key === "summonAlly"){
      allies = []; // only one ally at a time — casting again replaces it
      allies.push({
        x: player.x - 30 * player.facing, y: player.y, hp: cfg.allyHp,
        life: cfg.allyDuration, damage: cfg.allyDamage, cooldown: 0
      });
    }else if (key === "blackHole"){
      const cx = player.x + PLAYER_W/2 + 90 * player.facing;
      effects.push({
        type: "black-hole", x: cx, y: GROUND_Y - 60, radius: cfg.radius,
        life: cfg.duration, damagePerFrame: cfg.damagePerFrame, pullStrength: cfg.pullStrength
      });
    }

    if (DEBUG) console.log("[WvW] cast " + key);
  }

  function damageEnemy(en, amount){
    en.hp -= amount;
    if (en.hp <= 0 && !en.counted){
      en.counted = true;
      totalKills++;
      if (ENEMY_STATS[en.type].dropsCrystal){
        player.carriedCrystals += CRYSTAL_PER_WIZARD;
        if (DEBUG) console.log("[WvW] wizard defeated, crystal carried=" + player.carriedCrystals);
      }
      if (ENEMY_STATS[en.type].dropsSilver){
        player.silver += SILVER_PER_KNIGHT;
        if (DEBUG) console.log("[WvW] knight defeated, silver=" + player.silver);
      }
    }
  }

  function damagePlayer(amount){
    if (player.invulnFrames > 0) return;

    let remaining = amount;
    if (player.armorHp > 0){
      const absorbed = Math.min(player.armorHp, remaining);
      player.armorHp -= absorbed;
      remaining -= absorbed;
      if (player.armorHp <= 0){
        player.armorHp = 0;
        if (DEBUG) console.log("[WvW] " + player.armorType + " armor depleted and consumed");
        player.armorType = null;
      }
    }
    if (remaining > 0) player.hp -= remaining;

    player.invulnFrames = HIT_INVULN_FRAMES;
    if (player.hp <= 0) respawnPlayer();
  }

  function respawnPlayer(){
    const lost = player.carriedCrystals;
    player.carriedCrystals = 0;
    player.hp = PLAYER_MAX_HP;
    player.x = TOWER_X;
    player.y = GROUND_Y - PLAYER_H;
    player.vy = 0;
    player.invulnFrames = RESPAWN_INVULN_FRAMES;
    respawnMessageText = lost > 0
      ? "You went down and lost " + lost + " crystal" + (lost === 1 ? "" : "s") + "."
      : "You went down.";
    respawnMessageTimer = 180;
    if (DEBUG) console.log("[WvW] respawned, lost " + lost + " crystals");
  }

  /* ---------------- wave spawning ---------------- */
  function updateWaveSpawning(){
    const zone = currentZone(player.x);
    if (zone === "tower") return; // waves only happen in the wall/fair zones

    if (frame >= nextSpawnFrame){
      spawnWaveEnemy(zone);
      nextSpawnFrame = frame + SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
    }
  }

  function pickWizardTier(){
    const unlocked = WIZARD_TIERS.filter(t => totalKills >= t.minKills);
    return unlocked[Math.floor(Math.random() * unlocked.length)];
  }

  function spawnWaveEnemy(zone){
    const r = currentRatios();
    const roll = Math.random();
    let type = "knight";
    if (roll > r.knight + r.archer) type = pickWizardTier().key;
    else if (roll > r.knight) type = "archer";

    const stats = ENEMY_STATS[type];
    let x;
    if (zone === "wall"){
      x = WALL_END - 10; // always from the right in this zone
    }else{
      x = Math.random() < 0.5 ? WALL_END + 10 : FAIR_END - 10;
    }

    enemies.push({
      type, x, y: GROUND_Y - stats.h, w: stats.w, h: stats.h,
      hp: stats.hp, maxHp: stats.hp,
      attackCooldown: 0, frozenFrames: 0, burningFrames: 0, counted: false
    });
    if (DEBUG) console.log("[WvW] spawned " + type + " in " + zone + " zone");
  }

  /* ---------------- enemies ---------------- */
  function updateEnemies(){
    enemies.forEach(en => {
      if (en.hp <= 0) return;
      if (en.frozenFrames > 0){ en.frozenFrames--; return; }

      if (en.burningFrames > 0){
        en.burningFrames--;
        damageEnemy(en, SPELLS.fireball.burnDamagePerFrame);
        if (en.hp <= 0) return;
      }

      const stats = ENEMY_STATS[en.type];
      const enCx = en.x + en.w/2;
      const playerCx = player.x + PLAYER_W/2;
      const dist = playerCx - enCx;

      if (en.attackCooldown > 0) en.attackCooldown--;

      if (en.type === "knight"){
        if (Math.abs(dist) > stats.contactRange){
          en.x += Math.sign(dist) * stats.speed;
        }else if (en.attackCooldown <= 0){
          damagePlayer(stats.damage);
          en.attackCooldown = stats.attackCooldown;
        }
      }else{
        if (Math.abs(dist) > stats.preferredRange + 20){
          en.x += Math.sign(dist) * stats.speed;
        }else if (Math.abs(dist) < stats.preferredRange - 20){
          en.x -= Math.sign(dist) * stats.speed;
        }else if (en.attackCooldown <= 0){
          fireEnemyProjectile(en, Math.sign(dist) || 1);
          en.attackCooldown = stats.attackCooldown;
        }
      }
    });

    enemies = enemies.filter(en => en.hp > 0);
  }

  function fireEnemyProjectile(en, dir){
    const stats = ENEMY_STATS[en.type];
    const type = en.type === "archer" ? "arrow" : (Math.random() < 0.5 ? "lightning" : "fireball");
    enemyProjectiles.push({
      type, x: en.x + en.w/2, y: en.y + en.h/2, vx: stats.projectileSpeed * dir,
      damage: stats.damage
    });
  }

  /* ---------------- projectiles ---------------- */
  function triggerFireSplash(x, y){
    const cfg = SPELLS.fireball;
    enemies.forEach(en => {
      if (en.hp <= 0) return;
      const enCx = en.x + en.w/2, enCy = en.y + en.h/2;
      const dx = enCx - x, dy = enCy - y;
      if (Math.sqrt(dx*dx + dy*dy) < cfg.splashRadius) en.burningFrames = cfg.burnDuration;
    });
    effects.push({ type: "fire-burst", x, y, radius: cfg.splashRadius, life: 20 });
  }

  function hitsTree(x, y){
    return TREES.some(t => rectsOverlap(x - 8, y - 8, 16, 16, t.x, GROUND_Y - t.h, t.w, t.h));
  }

  function updateProjectiles(){
    playerProjectiles.forEach(p => { p.x += p.vx; });

    // Trees physically block projectiles — check before anything else can hit.
    playerProjectiles.forEach(p => {
      if (!p.hit && hitsTree(p.x, p.y)) p.hit = true;
    });

    playerProjectiles.forEach(p => {
      if (p.hit) return;
      enemies.forEach(en => {
        if (en.hp > 0 && rectsOverlap(p.x-8, p.y-8, 16, 16, en.x, en.y, en.w, en.h)){
          damageEnemy(en, p.damage);
          p.hit = true;
          if (p.type === "fireball") triggerFireSplash(p.x, p.y);
        }
      });
    });
    playerProjectiles = playerProjectiles.filter(p => !p.hit && p.x > -30 && p.x < WORLD_WIDTH + 30);

    enemyProjectiles.forEach(p => { p.x += p.vx; });

    enemyProjectiles.forEach(p => {
      if (!p.hit && hitsTree(p.x, p.y)) p.hit = true;
    });

    enemyProjectiles.forEach(p => {
      if (p.hit) return;
      if (player.invulnFrames <= 0 && rectsOverlap(p.x-8, p.y-8, 16, 16, player.x, player.y, PLAYER_W, PLAYER_H)){
        damagePlayer(p.damage);
        p.hit = true;
      }
    });
    enemyProjectiles = enemyProjectiles.filter(p => !p.hit && p.x > -30 && p.x < WORLD_WIDTH + 30);
  }

  /* ---------------- allies ---------------- */
  function updateAllies(){
    allies.forEach(a => {
      a.life--;
      if (a.cooldown > 0) a.cooldown--;
      const alive = enemies.filter(en => en.hp > 0);
      const target = alive.sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
      if (target){
        const dist = (target.x + target.w/2) - (a.x + PLAYER_W/2);
        if (Math.abs(dist) > 30){
          a.x += Math.sign(dist) * 2.2;
        }else if (a.cooldown <= 0){
          damageEnemy(target, a.damage);
          a.cooldown = 40;
        }
      }
    });
    allies = allies.filter(a => a.life > 0 && a.hp > 0);
  }

  /* ---------------- effects ---------------- */
  function updateEffects(){
    effects.forEach(fx => {
      fx.life--;
      if (fx.type === "black-hole"){
        enemies.forEach(en => {
          if (en.hp <= 0) return;
          const enCx = en.x + en.w/2, enCy = en.y + en.h/2;
          const dx = fx.x - enCx, dy = fx.y - enCy;
          const dist = Math.sqrt(dx*dx + dy*dy) || 1;
          if (dist < fx.radius){
            en.x += (dx/dist) * fx.pullStrength;
            damageEnemy(en, fx.damagePerFrame);
          }
        });
      }
    });
    effects = effects.filter(fx => fx.life > 0);
  }

  /* ---------------- chest / altar ---------------- */
  function checkChestAndAltar(){
    if (rectsOverlap(player.x, player.y, PLAYER_W, PLAYER_H, CHEST_X, GROUND_Y - CHEST_H, CHEST_W, CHEST_H)){
      if (player.carriedCrystals > 0){
        player.bankedCrystals += player.carriedCrystals;
        if (DEBUG) console.log("[WvW] deposited " + player.carriedCrystals + " crystals, banked=" + player.bankedCrystals);
        player.carriedCrystals = 0;
        saveProgress();
      }
    }

    const atAltar = player.y <= ALTAR_Y - PLAYER_H + 20 && currentZone(player.x) === "tower";
    if (atAltar && !altarOpen){
      openAltar();
    }
  }

  /* ---------------- draw ---------------- */
  function draw(){
    drawBackground();
    drawCastleWalls();
    drawTower();
    drawChest();
    drawTrees();
    enemies.forEach(drawEnemy);
    allies.forEach(drawAlly);
    effects.forEach(drawEffect);
    enemyProjectiles.forEach(p => drawProjectile(p));
    playerProjectiles.forEach(p => drawProjectile(p));
    drawPlayer();
    drawHud();
    drawRespawnMessage();
  }

  function worldToScreen(x){ return x - cameraX; }

  function drawBackground(){
    ctx.fillStyle = COLORS.skyWall;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const bands = [
      { from: 0, to: TOWER_END, color: COLORS.skyTower },
      { from: TOWER_END, to: WALL_END, color: COLORS.skyWall },
      { from: WALL_END, to: FAIR_END, color: COLORS.skyFair }
    ];
    bands.forEach(b => {
      const x1 = worldToScreen(b.from), x2 = worldToScreen(b.to);
      if (x2 < 0 || x1 > CANVAS_W) return;
      ctx.fillStyle = b.color;
      ctx.fillRect(Math.max(0, x1), 0, Math.min(CANVAS_W, x2) - Math.max(0, x1), CANVAS_H);
    });

    ctx.strokeStyle = COLORS.ground;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_W, GROUND_Y);
    ctx.stroke();
  }

  function drawCastleWalls(){
    const left = worldToScreen(TOWER_END);
    const right = worldToScreen(WALL_END);
    if (right < 0 || left > CANVAS_W) return; // zone not currently in view

    const top = GROUND_Y - CASTLE_WALL_HEIGHT;
    const visLeft = Math.max(0, left);
    const visRight = Math.min(CANVAS_W, right);

    ctx.fillStyle = COLORS.wallStone;
    ctx.fillRect(visLeft, top, visRight - visLeft, CASTLE_WALL_HEIGHT);

    // crenellations along the top edge
    ctx.fillStyle = COLORS.wallStoneDark;
    for (let wx = TOWER_END; wx < WALL_END; wx += CRENEL_UNIT * 2){
      const sx = worldToScreen(wx);
      if (sx + CRENEL_UNIT < 0 || sx > CANVAS_W) continue;
      ctx.fillRect(sx, top - 14, CRENEL_UNIT, 14);
    }

    // sparse vertical seams for a bit of stone texture
    ctx.strokeStyle = COLORS.wallStoneDark;
    ctx.lineWidth = 2;
    for (let wx = TOWER_END + 60; wx < WALL_END; wx += 120){
      const sx = worldToScreen(wx);
      if (sx < 0 || sx > CANVAS_W) continue;
      ctx.beginPath();
      ctx.moveTo(sx, top);
      ctx.lineTo(sx, GROUND_Y);
      ctx.stroke();
    }
  }

  function drawTower(){
    const x = worldToScreen(TOWER_X - LADDER_HALF_WIDTH - 10);
    const w = (LADDER_HALF_WIDTH + 10) * 2;
    const topY = ALTAR_Y - 20;
    ctx.fillStyle = COLORS.tower;
    ctx.fillRect(x, topY, w, GROUND_Y - topY);
    ctx.fillStyle = COLORS.towerDark;
    ctx.fillRect(x, topY, w, 14);

    ctx.strokeStyle = COLORS.ladder;
    ctx.lineWidth = 3;
    for (let y = topY + 20; y < GROUND_Y; y += 22){
      ctx.beginPath();
      ctx.moveTo(worldToScreen(TOWER_X - LADDER_HALF_WIDTH + 4), y);
      ctx.lineTo(worldToScreen(TOWER_X + LADDER_HALF_WIDTH - 4), y);
      ctx.stroke();
    }

    ctx.fillStyle = COLORS.altarGlow;
    ctx.beginPath();
    ctx.arc(worldToScreen(TOWER_X), topY - 10, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawChest(){
    const x = worldToScreen(CHEST_X);
    ctx.fillStyle = COLORS.chest;
    ctx.fillRect(x, GROUND_Y - CHEST_H, CHEST_W, CHEST_H);
    ctx.fillStyle = COLORS.chestLid;
    ctx.fillRect(x, GROUND_Y - CHEST_H, CHEST_W, 8);
  }

  function drawTrees(){
    TREES.forEach(t => {
      const x = worldToScreen(t.x);
      if (x < -60 || x > CANVAS_W + 60) return;

      const trunkW = 10;
      const trunkX = x + (t.w - trunkW) / 2;
      ctx.fillStyle = COLORS.treeTrunk;
      ctx.fillRect(trunkX, GROUND_Y - 30, trunkW, 30);

      ctx.fillStyle = COLORS.treeCanopy;
      const cx = x + t.w / 2;
      ctx.beginPath();
      ctx.moveTo(cx, GROUND_Y - t.h);
      ctx.lineTo(x, GROUND_Y - 26);
      ctx.lineTo(x + t.w, GROUND_Y - 26);
      ctx.closePath();
      ctx.fill();
    });
  }

  function drawPlayer(){
    const x = worldToScreen(player.x);
    if (player.invulnFrames > 0 && Math.floor(frame / 4) % 2 === 0) return;
    const bodyColor = player.armorType === "leather" ? COLORS.playerLeather
      : player.armorType === "steel" ? COLORS.playerSteel
      : COLORS.player;
    ctx.fillStyle = bodyColor;
    ctx.fillRect(x, player.y, PLAYER_W, PLAYER_H);

    if (!activeSpell) drawSword(x);
  }

  function drawSword(x){
    const swordDir = player.facing > 0 ? 1 : -1;
    const handX = player.facing > 0 ? x + PLAYER_W : x;
    const handY = player.y + 14;

    // direction from hand toward the tip
    const tipX = handX + 20 * swordDir;
    const tipY = player.y - 2;
    const dx = tipX - handX, dy = tipY - handY;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    const ux = dx / len, uy = dy / len;       // unit vector along the blade
    const nx = -uy, ny = ux;                  // perpendicular (blade width direction)

    const handleLen = 6;
    const guardX = handX + ux * handleLen, guardY = handY + uy * handleLen;
    const bladeWidth = 3;

    // handle (short brown segment from the hand out to the guard)
    ctx.strokeStyle = COLORS.swordHilt;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(guardX, guardY);
    ctx.stroke();

    // crossguard (short brown line perpendicular to the blade, at the base)
    ctx.beginPath();
    ctx.moveTo(guardX + nx * 5, guardY + ny * 5);
    ctx.lineTo(guardX - nx * 5, guardY - ny * 5);
    ctx.stroke();

    // blade — a tapered shape from the guard to a pointed tip
    ctx.fillStyle = COLORS.playerSword;
    ctx.beginPath();
    ctx.moveTo(guardX + nx * bladeWidth, guardY + ny * bladeWidth);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(guardX - nx * bladeWidth, guardY - ny * bladeWidth);
    ctx.closePath();
    ctx.fill();
  }

  function drawEnemy(en){
    if (en.hp <= 0) return;
    const x = worldToScreen(en.x);
    if (x < -40 || x > CANVAS_W + 40) return;

    if (en.type === "knight"){
      ctx.fillStyle = COLORS.knight;
      ctx.fillRect(x, en.y, en.w, en.h);
      ctx.fillStyle = COLORS.knightTrim;
      ctx.fillRect(x, en.y + 6, en.w, 6);
    }else if (en.type === "archer"){
      ctx.fillStyle = COLORS.archer;
      ctx.fillRect(x, en.y, en.w, en.h);
      ctx.strokeStyle = COLORS.archerBow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + en.w/2, en.y + en.h/2, 12, -Math.PI/2.2, Math.PI/2.2);
      ctx.stroke();
    }else{
      const tier = WIZARD_TIERS.find(t => t.key === en.type);
      const cloakColor = (tier && tier.cloakColor) ? tier.cloakColor : COLORS.wizardCloak;
      const hatColor = (tier && tier.cloakColor) ? tier.cloakColor : COLORS.wizardHat;
      ctx.fillStyle = cloakColor;
      ctx.beginPath();
      ctx.moveTo(x + 3, en.y + en.h);
      ctx.lineTo(x, en.y + en.h * 0.4);
      ctx.lineTo(x + en.w, en.y + en.h * 0.4);
      ctx.lineTo(x + en.w - 3, en.y + en.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hatColor;
      ctx.beginPath();
      ctx.moveTo(x + en.w/2, en.y - 10);
      ctx.lineTo(x + 3, en.y + en.h * 0.4);
      ctx.lineTo(x + en.w - 3, en.y + en.h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = COLORS.wizardBeard;
      ctx.beginPath();
      ctx.arc(x + en.w/2, en.y + en.h * 0.5, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (en.frozenFrames > 0){
      ctx.fillStyle = "rgba(143,227,240,0.5)";
      ctx.fillRect(x, en.y, en.w, en.h);
    }
    if (en.burningFrames > 0){
      ctx.fillStyle = "rgba(225,75,60,0.45)";
      ctx.fillRect(x, en.y, en.w, en.h);
    }

    ctx.fillStyle = COLORS.hpBad;
    ctx.fillRect(x, en.y - 8, en.w, 3);
    ctx.fillStyle = COLORS.hpGood;
    ctx.fillRect(x, en.y - 8, en.w * Math.max(0, en.hp / en.maxHp), 3);
  }

  function drawAlly(a){
    const x = worldToScreen(a.x);
    ctx.fillStyle = COLORS.ally;
    ctx.fillRect(x, a.y, PLAYER_W - 4, PLAYER_H - 6);
  }

  function drawProjectile(p){
    const x = worldToScreen(p.x);
    if (p.type === "fireball"){
      ctx.fillStyle = COLORS.fireball;
      ctx.beginPath(); ctx.arc(x, p.y, 7, 0, Math.PI*2); ctx.fill();
    }else if (p.type === "arrow"){
      ctx.strokeStyle = COLORS.arrow;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 10, p.y);
      ctx.lineTo(x + 10, p.y);
      ctx.stroke();
    }else{
      ctx.fillStyle = COLORS.lightning;
      ctx.beginPath();
      ctx.moveTo(x, p.y - 8);
      ctx.lineTo(x + 5, p.y - 2);
      ctx.lineTo(x + 1, p.y);
      ctx.lineTo(x + 6, p.y + 8);
      ctx.lineTo(x - 4, p.y + 1);
      ctx.lineTo(x, p.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawEffect(fx){
    const x = worldToScreen(fx.x);
    if (fx.type === "freeze-burst"){
      ctx.strokeStyle = COLORS.freeze;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, fx.y, fx.radius * (1 - fx.life/20), 0, Math.PI*2);
      ctx.stroke();
    }else if (fx.type === "fire-burst"){
      ctx.strokeStyle = COLORS.fireball;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, fx.y, fx.radius * (1 - fx.life/20), 0, Math.PI*2);
      ctx.stroke();
    }else if (fx.type === "lightning-chain"){
      ctx.strokeStyle = COLORS.lightning;
      ctx.lineWidth = 4;
      ctx.beginPath();
      fx.points.forEach((p, i) => {
        const sx = worldToScreen(p.x);
        if (i === 0) ctx.moveTo(sx, p.y);
        else ctx.lineTo(sx, p.y);
      });
      ctx.stroke();
    }else if (fx.type === "black-hole"){
      ctx.fillStyle = COLORS.blackHole;
      ctx.beginPath();
      ctx.arc(x, fx.y, fx.radius * 0.5, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = COLORS.blackHole;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, fx.y, fx.radius, 0, Math.PI*2);
      ctx.stroke();
    }
  }

  function drawHud(){
    ctx.fillStyle = COLORS.hpBad;
    ctx.fillRect(12, 12, 120, 12);
    ctx.fillStyle = COLORS.hpGood;
    ctx.fillRect(12, 12, 120 * Math.max(0, player.hp / PLAYER_MAX_HP), 12);
    ctx.strokeStyle = COLORS.hud;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(12, 12, 120, 12);

    if (player.armorType){
      ctx.fillStyle = COLORS.armorBg;
      ctx.fillRect(12, 27, 120, 7);
      ctx.fillStyle = COLORS.armor;
      ctx.fillRect(12, 27, 120 * Math.max(0, player.armorHp / player.armorMaxHp), 7);
      ctx.strokeStyle = COLORS.hud;
      ctx.lineWidth = 1;
      ctx.strokeRect(12, 27, 120, 7);
    }

    ctx.fillStyle = COLORS.manaBg;
    ctx.fillRect(12, 38, 120, 7);
    ctx.fillStyle = COLORS.mana;
    ctx.fillRect(12, 38, 120 * Math.max(0, player.mana / player.maxMana), 7);
    ctx.strokeStyle = COLORS.hud;
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 38, 120, 7);

    ctx.fillStyle = COLORS.hud;
    ctx.font = "700 13px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("Crystals: " + player.carriedCrystals + " carried / " + player.bankedCrystals + " banked", 12, 64);
    ctx.fillStyle = COLORS.silver;
    ctx.fillText("Silver: " + player.silver, 12, 80);

    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.hud;
    ctx.fillText(activeSpell ? SPELLS[activeSpell].label.toUpperCase() : "SWORD", CANVAS_W - 12, 24);
  }

  function drawRespawnMessage(){
    if (respawnMessageTimer <= 0) return;
    ctx.fillStyle = "rgba(20,24,31,0.8)";
    ctx.fillRect(CANVAS_W/2 - 160, 50, 320, 30);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "600 13px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(respawnMessageText, CANVAS_W/2, 70);
  }

  /* ---------------- loop / lifecycle ---------------- */
  function loop(){
    if (!running) return;
    if (!altarOpen) update();
    draw();
    animId = requestAnimationFrame(loop);
  }

  function startGame(){
    resetState();
    applyLoadedProgress();
    started = true;
    hideOverlay();
    canvas.focus();
    loop();
  }

  function hideOverlay(){ overlay.style.display = "none"; }

  function progressSummaryHTML(){
    if (walterGuestMode) return `<p style="font-size:0.8rem;opacity:0.8;">Playing as guest — progress won't be saved.</p>`;
    if (!loadedProgress) return "";
    const spellCount = loadedProgress.spells.size;
    const hasAnything = spellCount > 0 || loadedProgress.silver > 0 || loadedProgress.crystals > 0 || loadedProgress.armor !== "none";
    if (!hasAnything) return `<p style="font-size:0.8rem;opacity:0.8;">New save — starting fresh.</p>`;
    const armorLabel = loadedProgress.armor !== "none" ? ARMOR[loadedProgress.armor].label : "no armor";
    return `<p style="font-size:0.8rem;opacity:0.8;">Welcome back — loaded ${spellCount} spell${spellCount === 1 ? "" : "s"}, ${loadedProgress.silver} silver, ${loadedProgress.crystals} banked crystals, ${armorLabel}.</p>`;
  }

  function showStartOverlay(){
    overlay.style.display = "flex";
    overlayInner.innerHTML = `
      <h3>Walter vs Wizards</h3>
      <p>Arrow keys to move, Up to jump or climb the tower ladder, Space to swing your sword (or cast your active spell). Number keys switch spells once you've unlocked them at the altar.</p>
      ${progressSummaryHTML()}
      <button type="button" class="btn" id="wvw-play-btn">Play</button>
    `;
    document.getElementById("wvw-play-btn").addEventListener("click", startGame);
  }

  function showLoginOverlay(){
    overlay.style.display = "flex";
    overlayInner.innerHTML = `
      <h3>Walter vs Wizards</h3>
      <p>Log in with a name and password to save your spells, armor, silver, and crystals. First time using a name creates a fresh save automatically — just remember the password.</p>
      <div class="form-row"><input type="text" id="wvw-login-name" placeholder="Name" maxlength="40"></div>
      <div class="form-row"><input type="password" id="wvw-login-password" placeholder="Password" maxlength="40"></div>
      <button type="button" class="btn" id="wvw-login-btn">Log In &amp; Play</button>
      <p class="form-note" id="wvw-login-status"></p>
      <p class="form-note" style="margin-top:6px;"><a href="#" id="wvw-guest-link" style="color:inherit;text-decoration:underline;">Play without saving</a></p>
    `;

    if (typeof getStoredName === "function"){
      const stored = getStoredName();
      if (stored) document.getElementById("wvw-login-name").value = stored;
    }

    document.getElementById("wvw-login-btn").addEventListener("click", attemptLogin);
    document.getElementById("wvw-guest-link").addEventListener("click", (e) => {
      e.preventDefault();
      walterGuestMode = true;
      walterName = null;
      walterPassword = null;
      loadedProgress = null;
      loginComplete = true;
      showStartOverlay();
    });
  }

  async function attemptLogin(){
    const nameInput = document.getElementById("wvw-login-name");
    const passwordInput = document.getElementById("wvw-login-password");
    const statusEl = document.getElementById("wvw-login-status");
    const name = nameInput.value.trim();
    const password = passwordInput.value;

    if (!name || !password){
      statusEl.textContent = "Enter both a name and a password.";
      statusEl.style.color = "var(--red)";
      return;
    }

    if (!isConfigured()){
      statusEl.textContent = "Not connected to a Google Sheet yet — see config.js. Playing without saving.";
      statusEl.style.color = "var(--red)";
      walterGuestMode = true;
      walterName = null;
      walterPassword = null;
      loadedProgress = null;
      loginComplete = true;
      setTimeout(showStartOverlay, 1200);
      return;
    }

    const btn = document.getElementById("wvw-login-btn");
    btn.disabled = true;
    statusEl.textContent = "Logging in…";
    statusEl.style.color = "var(--muted)";

    try{
      const res = await apiPost({ action: "walterLogin", name, password });
      if (!res.success){
        statusEl.textContent = res.error || "Couldn't log in — try again.";
        statusEl.style.color = "var(--red)";
        btn.disabled = false;
        return;
      }
      walterGuestMode = false;
      walterName = name;
      walterPassword = password;
      if (typeof setStoredName === "function") setStoredName(name);
      loadedProgress = decodeProgress(res.progress);
      loginComplete = true;
      showStartOverlay();
    }catch(err){
      console.error("[WvW] login failed", err);
      statusEl.textContent = "Couldn't reach the server — check your connection and try again.";
      statusEl.style.color = "var(--red)";
      btn.disabled = false;
    }
  }

  /* ---------------- altar shop ---------------- */
  function openAltar(){
    altarOpen = true;
    renderAltar();
    overlay.style.display = "flex";
  }
  function closeAltar(){
    altarOpen = false;
    hideOverlay();
    canvas.focus();
    // NOTE: no loop() call here — the original requestAnimationFrame chain
    // never stopped (it only skipped update() while altarOpen was true), so
    // calling loop() again would spawn a second, parallel chain and the game
    // would run 2x speed after every altar visit (3x after two visits, etc).
  }

  function renderAltar(){
    const total = totalCrystals();
    const spellRows = SPELL_ORDER.map((key, i) => {
      const cfg = SPELLS[key];
      const owned = spellUnlocked.has(key);
      const affordable = total >= cfg.cost;
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.15);">
          <span>${i+1}. ${cfg.label}${owned ? " ✓" : ""}</span>
          ${owned
            ? `<span style="opacity:0.7;font-size:0.8rem;">Owned</span>`
            : `<button type="button" class="btn light" style="padding:6px 12px;font-size:0.8rem;" data-spell="${key}" ${affordable ? "" : "disabled"}>Buy (${cfg.cost})</button>`
          }
        </div>
      `;
    }).join("");

    const armorRows = ARMOR_ORDER.map(key => {
      const cfg = ARMOR[key];
      const equipped = player.armorType === key;
      const affordable = player.silver >= cfg.cost;
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.15);">
          <span>${cfg.label}${equipped ? " (equipped)" : ""}</span>
          <button type="button" class="btn light" style="padding:6px 12px;font-size:0.8rem;" data-armor="${key}" ${affordable ? "" : "disabled"}>Buy (${cfg.cost} silver)</button>
        </div>
      `;
    }).join("");

    const armorStatus = player.armorType
      ? `${ARMOR[player.armorType].label}: ${Math.ceil(player.armorHp)}/${player.armorMaxHp}`
      : "No armor equipped";

    const manaAffordable = player.silver >= MANA_UPGRADE_COST_SILVER;
    const manaRow = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;">
        <span>Max Mana: ${player.maxMana}</span>
        <button type="button" class="btn light" style="padding:6px 12px;font-size:0.8rem;" id="wvw-mana-upgrade-btn" ${manaAffordable ? "" : "disabled"}>+${MANA_UPGRADE_AMOUNT} (${MANA_UPGRADE_COST_SILVER} silver)</button>
      </div>
    `;

    overlayInner.innerHTML = `
      <h3>Wizard Skill Altar</h3>
      <p>You have ${total} crystal${total === 1 ? "" : "s"} to spend on spells (carried + banked), and ${player.silver} silver for armor and mana.</p>
      <p style="font-size:0.82rem;opacity:0.85;margin-top:-8px;">${armorStatus}</p>
      <div style="text-align:left;">${spellRows}</div>
      <p style="font-weight:700;margin:14px 0 4px;">Armor (buying replaces your current piece)</p>
      <div style="text-align:left;">${armorRows}</div>
      <p style="font-weight:700;margin:14px 0 4px;">Mana (repeatable)</p>
      <div style="text-align:left;">${manaRow}</div>
      <button type="button" class="btn light" id="wvw-altar-close" style="margin-top:14px;">Close</button>
    `;

    overlayInner.querySelectorAll("button[data-spell]").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.spell;
        const cfg = SPELLS[key];
        if (totalCrystals() >= cfg.cost && !spellUnlocked.has(key)){
          spendCrystals(cfg.cost);
          spellUnlocked.add(key);
          if (DEBUG) console.log("[WvW] unlocked spell " + key);
          renderAltar();
          saveProgress();
        }
      });
    });
    overlayInner.querySelectorAll("button[data-armor]").forEach(btn => {
      btn.addEventListener("click", () => {
        if (buyArmor(btn.dataset.armor)){
          renderAltar();
          saveProgress();
        }
      });
    });
    const manaBtn = document.getElementById("wvw-mana-upgrade-btn");
    if (manaBtn){
      manaBtn.addEventListener("click", () => {
        if (buyManaUpgrade()){
          renderAltar();
          saveProgress();
        }
      });
    }
    document.getElementById("wvw-altar-close").addEventListener("click", closeAltar);
  }

  /* ---------------- init ---------------- */
  function initGame(){
    canvas = document.getElementById("walter-canvas");
    overlay = document.getElementById("walter-overlay");
    overlayInner = document.getElementById("walter-overlay-inner");
    if (!canvas || !overlay) return;

    ctx = canvas.getContext("2d");
    resetState();
    running = false;
    loginComplete = false;
    draw();
    showLoginOverlay();

    canvas.addEventListener("click", (e) => { canvas.focus(); handleTap(e.clientX); });
    canvas.addEventListener("touchstart", (e) => { e.preventDefault(); canvas.focus(); handleTap(e.touches[0].clientX); }, { passive: false });

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", (e) => { if (document.activeElement === canvas) onKeyUp(e); });
  }

  document.addEventListener("DOMContentLoaded", initGame);
})();
