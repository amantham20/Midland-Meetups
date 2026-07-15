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
  const CANVAS_H = 360;
  const GROUND_Y = 300;

  const COLORS = {
    skyTower: "#EDE6D6",
    skyWall: "#F5F0E6",
    skyFair: "#FBEFD8",
    ground: "#1F2430",
    tower: "#8B5A2B",
    towerDark: "#6B4222",
    ladder: "#C9922A",
    chest: "#B8860B",
    chestLid: "#8B5A2B",
    altarGlow: "#F6C945",
    player: "#1B7A4A",
    playerSword: "#9CA3AF",
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
    hpBad: "#E14B3C"
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

  const PLAYER_W = 28, PLAYER_H = 42;
  const PLAYER_MAX_HP = 100;
  const MOVE_SPEED = 3.2;
  const GRAVITY = 0.7;
  const JUMP_VELOCITY = -11;
  const CLIMB_SPEED = 2.6;
  const RESPAWN_INVULN_FRAMES = 90;
  const HIT_INVULN_FRAMES = 30;

  const MELEE_RANGE = 34;
  const MELEE_DAMAGE = 18;
  const MELEE_COOLDOWN = 22;

  const ENEMY_STATS = {
    knight:  { hp: 30, speed: 1.4, damage: 8,  attackCooldown: 50, contactRange: 30, w: 26, h: 40 },
    archer:  { hp: 22, speed: 1.1, damage: 10, attackCooldown: 80, preferredRange: 220, projectileSpeed: 6,   w: 24, h: 38 },
    wizard:  { hp: 26, speed: 1.0, damage: 14, attackCooldown: 90, preferredRange: 260, projectileSpeed: 6.5, w: 26, h: 40, dropsCrystal: true }
  };

  const SPAWN_INTERVAL_MIN = 70;
  const SPAWN_INTERVAL_MAX = 140;
  const RATIO_SHIFT_KILLS = 60; // kills to fully shift from 90/5/5 toward 40/30/30

  const CRYSTAL_PER_WIZARD = 1;

  const SPELLS = {
    fireball:    { label: "Fireball",     cost: 10, damage: 20, speed: 8,   cooldown: 30 },
    lightning:   { label: "Lightning",    cost: 10, damage: 26, range: 260, cooldown: 45 },
    freeze:      { label: "Freeze",       cost: 10, radius: 120, duration: 180, cooldown: 240 },
    summonAlly:  { label: "Summon Ally",  cost: 10, allyDuration: 900, allyDamage: 12, allyHp: 40, cooldown: 300 },
    blackHole:   { label: "Black Hole",   cost: 10, radius: 100, duration: 180, damagePerFrame: 0.3, pullStrength: 0.6, cooldown: 360 }
  };
  const SPELL_ORDER = ["fireball", "lightning", "freeze", "summonAlly", "blackHole"];

  const DEBUG = true; // logs key events to the console — flip to false once things look right
  /* ==================== end config ==================== */

  let canvas, ctx, overlay, overlayInner;
  let player, enemies, playerProjectiles, enemyProjectiles, allies, effects;
  let cameraX, frame, totalKills, keysDown;
  let spellCooldowns, spellUnlocked, activeSpell, meleeCooldown;
  let respawnMessageTimer, respawnMessageText;
  let altarOpen, started, running;
  let animId, nextSpawnFrame;

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
      carriedCrystals: 0, bankedCrystals: 0,
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
    if (!started){ startGame(); return; }
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
    if (!started){ startGame(); return; }
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
    updateWaveSpawning();
    updateEnemies();
    updateProjectiles();
    updateAllies();
    updateEffects();
    checkChestAndAltar();
    if (respawnMessageTimer > 0) respawnMessageTimer--;
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
    spellCooldowns[key] = cfg.cooldown;

    if (key === "fireball"){
      playerProjectiles.push({
        type: "fireball", x: player.x + PLAYER_W/2, y: player.y + PLAYER_H/2,
        vx: cfg.speed * player.facing, damage: cfg.damage
      });
    }else if (key === "lightning"){
      const originX = player.x + PLAYER_W/2;
      const originY = player.y + PLAYER_H/2;
      const reachX = originX + cfg.range * player.facing;
      enemies.forEach(en => {
        const enCx = en.x + en.w/2;
        const withinLine = player.facing > 0 ? (enCx > originX && enCx < reachX) : (enCx < originX && enCx > reachX);
        if (en.hp > 0 && withinLine && Math.abs((en.y + en.h/2) - originY) < 50){
          damageEnemy(en, cfg.damage);
        }
      });
      effects.push({ type: "lightning-flash", x: originX, y: originY, dir: player.facing, range: cfg.range, life: 8 });
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
    }
  }

  function damagePlayer(amount){
    if (player.invulnFrames > 0) return;
    player.hp -= amount;
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

  function spawnWaveEnemy(zone){
    const r = currentRatios();
    const roll = Math.random();
    let type = "knight";
    if (roll > r.knight + r.archer) type = "wizard";
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
      attackCooldown: 0, frozenFrames: 0, counted: false
    });
    if (DEBUG) console.log("[WvW] spawned " + type + " in " + zone + " zone");
  }

  /* ---------------- enemies ---------------- */
  function updateEnemies(){
    enemies.forEach(en => {
      if (en.hp <= 0) return;
      if (en.frozenFrames > 0){ en.frozenFrames--; return; }

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
  function updateProjectiles(){
    playerProjectiles.forEach(p => { p.x += p.vx; });
    playerProjectiles.forEach(p => {
      if (p.hit) return;
      enemies.forEach(en => {
        if (en.hp > 0 && rectsOverlap(p.x-8, p.y-8, 16, 16, en.x, en.y, en.w, en.h)){
          damageEnemy(en, p.damage);
          p.hit = true;
        }
      });
    });
    playerProjectiles = playerProjectiles.filter(p => !p.hit && p.x > -30 && p.x < WORLD_WIDTH + 30);

    enemyProjectiles.forEach(p => { p.x += p.vx; });
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
    drawTower();
    drawChest();
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

  function drawPlayer(){
    const x = worldToScreen(player.x);
    if (player.invulnFrames > 0 && Math.floor(frame / 4) % 2 === 0) return;
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(x, player.y, PLAYER_W, PLAYER_H);
    ctx.strokeStyle = COLORS.playerSword;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const swordX = player.facing > 0 ? x + PLAYER_W : x;
    const swordDir = player.facing > 0 ? 1 : -1;
    ctx.moveTo(swordX, player.y + 12);
    ctx.lineTo(swordX + 16 * swordDir, player.y + 2);
    ctx.stroke();
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
      ctx.fillStyle = COLORS.wizardCloak;
      ctx.beginPath();
      ctx.moveTo(x + 3, en.y + en.h);
      ctx.lineTo(x, en.y + en.h * 0.4);
      ctx.lineTo(x + en.w, en.y + en.h * 0.4);
      ctx.lineTo(x + en.w - 3, en.y + en.h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = COLORS.wizardHat;
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
    }else if (fx.type === "lightning-flash"){
      ctx.strokeStyle = COLORS.lightning;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, fx.y);
      ctx.lineTo(x + fx.range * fx.dir, fx.y);
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

    ctx.fillStyle = COLORS.hud;
    ctx.font = "700 13px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("Crystals: " + player.carriedCrystals + " carried / " + player.bankedCrystals + " banked", 12, 42);

    ctx.textAlign = "right";
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
    started = true;
    hideOverlay();
    canvas.focus();
    loop();
  }

  function hideOverlay(){ overlay.style.display = "none"; }

  function showStartOverlay(){
    overlay.style.display = "flex";
    overlayInner.innerHTML = `
      <h3>Walter vs Wizards</h3>
      <p>Arrow keys to move, Up to jump or climb the tower ladder, Space to swing your sword (or cast your active spell). Number keys switch spells once you've unlocked them at the altar.</p>
      <button type="button" class="btn" id="wvw-play-btn">Play</button>
    `;
    document.getElementById("wvw-play-btn").addEventListener("click", startGame);
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
    const rows = SPELL_ORDER.map((key, i) => {
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

    overlayInner.innerHTML = `
      <h3>Wizard Skill Altar</h3>
      <p>You have ${total} crystal${total === 1 ? "" : "s"} to spend (carried + banked).</p>
      <div style="text-align:left;">${rows}</div>
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
        }
      });
    });
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
    draw();
    showStartOverlay();

    canvas.addEventListener("click", (e) => { canvas.focus(); handleTap(e.clientX); });
    canvas.addEventListener("touchstart", (e) => { e.preventDefault(); canvas.focus(); handleTap(e.touches[0].clientX); }, { passive: false });

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", (e) => { if (document.activeElement === canvas) onKeyUp(e); });
  }

  document.addEventListener("DOMContentLoaded", initGame);
})();
