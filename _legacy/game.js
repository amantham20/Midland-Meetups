/* =====================================================================
   WIZARDS AND WAFFLES
   A 2D endless-runner shooter, mid-century modern style — bold primary
   colors, simple flat shapes. Loaded only on game.html, after config.js
   and app.js (reuses apiGet, apiPost, escapeHTML, getStoredName,
   setStoredName, isConfigured, configNotice, loadErrorNotice — same
   global scope, same leaderboard API as before).

   EVERYTHING here is client-side. Changing how the game looks, feels,
   or plays never requires touching the Apps Script backend — only
   score-saving talks to the Sheet, and that's a fixed {name, score}
   shape regardless of what the game does above it.

   TUNING: every number worth playing with lives in CONFIG below.
   Change a value, reload the page. No backend involved.
   ===================================================================== */

(function(){

  /* ==================== CONFIG — tweak freely ==================== */
  const CANVAS_W = 640;
  const CANVAS_H = 280;
  const GROUND_Y = 230;

  const COLORS = {
    bg: "#F5F0E6",            // warm cream backdrop
    ground: "#1F2430",
    player: "#1B7A4A",        // green hero — reads clearly against reds/blues
    wizardCloak: "#1B3A8F",   // dark blue
    wizardHat: "#132A66",
    wizardBeard: "#FFFFFF",
    wizardWand: "#8B5A2B",    // brown
    waffle: "#F6C945",        // yellow
    waffleLine: "#C9922A",
    muffin: "#8B5A2B",        // brown
    muffinTop: "#6B4222",
    lightning: "#7FD4E8",     // light blue
    fireball: "#E14B3C",      // red
    obstacle: "#2E3440",
    motorcycle: "#E14B3C",
    motorcycleWheel: "#1F2430",
    jetpack: "#9CA3AF",
    jetpackFlame: "#F6A93B",
    powerupRing: "#F6C945",
    hud: "#1F2430"
  };

  const PLAYER_X = 70;
  const PLAYER_W = 30;
  const PLAYER_H = 40;

  const GRAVITY = 0.7;
  const JUMP_VELOCITY = -12;

  const START_SPEED = 5.5;
  const MAX_SPEED = 11;
  const SPEED_RAMP = 0.0009; // speed gained per frame

  const OBSTACLE_HEIGHT = 40; // wizards and plain obstacles share this height
  const WIZARD_RATIO = 0.7;   // 70% of spawns are wizards, 30% plain obstacles
  const SPAWN_MIN_GAP = 55;   // frames between spawns, before speed adjustment
  const SPAWN_MAX_GAP = 110;

  const WIZARD_FIRE_COOLDOWN_MIN = 22;  // frames between a wizard's shots
  const WIZARD_FIRE_COOLDOWN_MAX = 48;
  const WIZARD_FIRE_RANGE = 560;        // wizard only fires once this close

  const WAFFLE_SPEED = 9;      // straight shot
  const THROW_COOLDOWN = 18;   // frames between throws (waffle or muffin)

  const MUFFIN_SPEED_X = 6;    // arcs toward the ground
  const MUFFIN_INITIAL_VY = -7;
  const MUFFIN_GRAVITY = 0.4;

  const ENEMY_PROJECTILE_SPEED_BONUS = 4; // how much faster than world-scroll a bolt/fireball flies

  const MOTORCYCLE_DURATION_FRAMES = 10 * 60; // 10 seconds @ ~60fps, invincible
  const JETPACK_DURATION_FRAMES = 8 * 60;     // 8 seconds, hover + throw muffins
  const JETPACK_HOVER_OFFSET = 60;            // how high above ground while hovering

  const POWERUP_SPAWN_CHANCE = 0.006; // rolled once per frame once eligible
  const POWERUP_MIN_SCORE_GAP = 400;  // minimum score between power-up spawns

  const WIZARD_DEFEAT_BONUS = 25; // score bonus for hitting a wizard

  const LOCAL_BEST_KEY = "midland-meetups-ww-best-score";

  const DEBUG = true; // logs key game events to the browser console — flip to false once you're done troubleshooting
  /* ==================== end config ==================== */

  let canvas, ctx, overlay, overlayInner;
  let player, obstacles, enemyProjectiles, playerProjectiles, powerups;
  let speed, score, frame, running, over, started;
  let nextSpawnFrame, throwCooldown, lastPowerupScore, animId;

  function resetState(){
    player = { y: GROUND_Y - PLAYER_H, vy: 0, onGround: true, mode: "normal", modeFramesLeft: 0 };
    obstacles = [];
    enemyProjectiles = [];
    playerProjectiles = [];
    powerups = [];
    speed = START_SPEED;
    score = 0;
    frame = 0;
    nextSpawnFrame = 60;
    throwCooldown = 0;
    lastPowerupScore = 0;
    running = false;
    over = false;
  }

  /* ---------------- local best score (kept even if never saved to the Sheet) ---------------- */
  function getLocalBest(){
    return Number(localStorage.getItem(LOCAL_BEST_KEY)) || 0;
  }
  function setLocalBestIfHigher(candidateScore){
    const current = getLocalBest();
    if (candidateScore > current){
      localStorage.setItem(LOCAL_BEST_KEY, String(candidateScore));
      return true;
    }
    return false;
  }

  function rectsOverlap(x1,y1,w1,h1,x2,y2,w2,h2){
    const pad = 4;
    return x1+pad < x2+w2-pad && x1+w1-pad > x2+pad && y1+pad < y2+h2-pad && y1+h1-pad > y2+pad;
  }

  /* ---------------- update ---------------- */
  function update(){
    frame++;
    speed = Math.min(MAX_SPEED, START_SPEED + frame * SPEED_RAMP);
    score += speed * 0.05;

    updatePlayer();
    updateSpawning();
    updateObstacles();
    updateEnemyProjectiles();
    updatePlayerProjectiles();
    updatePowerups();
    checkCollisions();
  }

  function updatePlayer(){
    if (player.mode === "jetpack"){
      const targetY = GROUND_Y - PLAYER_H - JETPACK_HOVER_OFFSET;
      player.y += (targetY - player.y) * 0.15;
      player.vy = 0;
      player.onGround = false;
    }else{
      player.vy += GRAVITY;
      player.y += player.vy;
      if (player.y >= GROUND_Y - PLAYER_H){
        player.y = GROUND_Y - PLAYER_H;
        player.vy = 0;
        player.onGround = true;
      }
    }

    if (player.mode !== "normal"){
      player.modeFramesLeft--;
      if (player.modeFramesLeft <= 0) player.mode = "normal";
    }

    if (throwCooldown > 0) throwCooldown--;
  }

  function updateSpawning(){
    if (frame >= nextSpawnFrame){
      spawnObstacle();
      const gap = SPAWN_MIN_GAP + Math.random() * (SPAWN_MAX_GAP - SPAWN_MIN_GAP);
      nextSpawnFrame = frame + Math.max(30, gap - speed * 3);
    }
    if (score - lastPowerupScore > POWERUP_MIN_SCORE_GAP && Math.random() < POWERUP_SPAWN_CHANCE){
      spawnPowerup();
      lastPowerupScore = score;
    }
  }

  function spawnObstacle(){
    const isWizard = Math.random() < WIZARD_RATIO;
    const w = isWizard ? 26 : 20 + Math.floor(Math.random() * 8);
    obstacles.push({
      type: isWizard ? "wizard" : "obstacle",
      x: CANVAS_W + 20,
      y: GROUND_Y - OBSTACLE_HEIGHT,
      w, h: OBSTACLE_HEIGHT,
      alive: true,
      fireCooldown: WIZARD_FIRE_COOLDOWN_MIN + Math.random() * (WIZARD_FIRE_COOLDOWN_MAX - WIZARD_FIRE_COOLDOWN_MIN)
    });
    if (DEBUG && isWizard) console.log("[W&W] wizard spawned at frame " + frame);
  }

  function spawnPowerup(){
    const type = Math.random() < 0.5 ? "motorcycle" : "jetpack";
    powerups.push({ type, x: CANVAS_W + 20, y: GROUND_Y - 30, w: 30, h: 30 });
  }

  function updateObstacles(){
    obstacles.forEach(o => {
      o.x -= speed;
      if (o.type === "wizard" && o.alive && o.x < WIZARD_FIRE_RANGE && o.x > PLAYER_X + PLAYER_W){
        o.fireCooldown--;
        if (o.fireCooldown <= 0){
          fireEnemyProjectile(o);
          o.fireCooldown = WIZARD_FIRE_COOLDOWN_MIN + Math.random() * (WIZARD_FIRE_COOLDOWN_MAX - WIZARD_FIRE_COOLDOWN_MIN);
        }
      }
    });
    obstacles = obstacles.filter(o => o.alive && o.x + o.w > -20);
  }

  function fireEnemyProjectile(wizard){
    const type = Math.random() < 0.5 ? "lightning" : "fireball";
    enemyProjectiles.push({ type, x: wizard.x, y: wizard.y + wizard.h/2 - 6, w: 16, h: 12 });
    if (DEBUG) console.log("[W&W] wizard fired " + type + " at frame " + frame + ", wizard x=" + Math.round(wizard.x));
  }

  function updateEnemyProjectiles(){
    const flightSpeed = speed + ENEMY_PROJECTILE_SPEED_BONUS;
    enemyProjectiles.forEach(p => { p.x -= flightSpeed; });
    enemyProjectiles = enemyProjectiles.filter(p => p.x + p.w > -20);
  }

  function updatePlayerProjectiles(){
    playerProjectiles.forEach(p => {
      p.x += p.vx;
      if (p.type === "muffin"){
        p.vy += MUFFIN_GRAVITY;
        p.y += p.vy;
      }
    });

    playerProjectiles.forEach(p => {
      if (p.hit) return;
      obstacles.forEach(o => {
        if (o.alive && o.type === "wizard" &&
            rectsOverlap(p.x-8, p.y-8, 16, 16, o.x, o.y, o.w, o.h)){
          o.alive = false;
          p.hit = true;
          score += WIZARD_DEFEAT_BONUS;
        }
      });
    });

    playerProjectiles = playerProjectiles.filter(p =>
      !p.hit && p.x < CANVAS_W + 20 && p.y < CANVAS_H + 20
    );
  }

  function updatePowerups(){
    powerups.forEach(p => { p.x -= speed; });
    powerups = powerups.filter(p => p.x + p.w > -20);
  }

  function checkCollisions(){
    // power-ups are always collectible, regardless of mode
    powerups.forEach(p => {
      if (rectsOverlap(PLAYER_X, player.y, PLAYER_W, PLAYER_H, p.x, p.y, p.w, p.h)){
        player.mode = p.type;
        player.modeFramesLeft = p.type === "motorcycle" ? MOTORCYCLE_DURATION_FRAMES : JETPACK_DURATION_FRAMES;
        p.collected = true;
      }
    });
    powerups = powerups.filter(p => !p.collected);

    if (player.mode === "motorcycle") return; // invincible — nothing else can hurt you

    const hovering = player.mode === "jetpack"; // above ground-level threats

    if (!hovering){
      for (const o of obstacles){
        if (rectsOverlap(PLAYER_X, player.y, PLAYER_W, PLAYER_H, o.x, o.y, o.w, o.h)){
          endGame();
          return;
        }
      }
      for (const p of enemyProjectiles){
        if (rectsOverlap(PLAYER_X, player.y, PLAYER_W, PLAYER_H, p.x, p.y, p.w, p.h)){
          endGame();
          return;
        }
      }
    }
  }

  /* ---------------- draw ---------------- */
  function draw(){
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.strokeStyle = COLORS.ground;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_W, GROUND_Y);
    ctx.stroke();

    obstacles.forEach(o => o.type === "wizard" ? drawWizard(o) : drawObstacle(o));
    powerups.forEach(drawPowerup);
    enemyProjectiles.forEach(drawEnemyProjectile);
    playerProjectiles.forEach(drawPlayerProjectile);
    drawPlayer();
    drawHud();
  }

  function drawObstacle(o){
    ctx.fillStyle = COLORS.obstacle;
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }

  function drawWizard(o){
    const cx = o.x + o.w / 2;
    ctx.fillStyle = COLORS.wizardCloak;
    ctx.beginPath();
    ctx.moveTo(o.x + 3, o.y + o.h);
    ctx.lineTo(o.x, o.y + o.h * 0.4);
    ctx.lineTo(o.x + o.w, o.y + o.h * 0.4);
    ctx.lineTo(o.x + o.w - 3, o.y + o.h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.wizardHat;
    ctx.beginPath();
    ctx.moveTo(cx, o.y - 10);
    ctx.lineTo(o.x + 3, o.y + o.h * 0.4);
    ctx.lineTo(o.x + o.w - 3, o.y + o.h * 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.wizardBeard;
    ctx.beginPath();
    ctx.moveTo(cx - 6, o.y + o.h * 0.42);
    ctx.lineTo(cx + 6, o.y + o.h * 0.42);
    ctx.lineTo(cx, o.y + o.h * 0.68);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = COLORS.wizardWand;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(o.x + o.w - 2, o.y + o.h * 0.5);
    ctx.lineTo(o.x + o.w + 9, o.y + o.h * 0.32);
    ctx.stroke();
  }

  function drawEnemyProjectile(p){
    if (p.type === "lightning"){
      ctx.fillStyle = COLORS.lightning;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + 8, p.y);
      ctx.lineTo(p.x + 3, p.y + 6);
      ctx.lineTo(p.x + 10, p.y + 6);
      ctx.lineTo(p.x, p.y + 16);
      ctx.lineTo(p.x + 4, p.y + 8);
      ctx.lineTo(p.x - 2, p.y + 8);
      ctx.closePath();
      ctx.fill();
    }else{
      ctx.fillStyle = COLORS.fireball;
      ctx.beginPath();
      ctx.arc(p.x + 6, p.y + 6, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlayerProjectile(p){
    if (p.type === "waffle"){
      ctx.fillStyle = COLORS.waffle;
      ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
      ctx.strokeStyle = COLORS.waffleLine;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x - 8, p.y - 3); ctx.lineTo(p.x + 8, p.y - 3);
      ctx.moveTo(p.x - 8, p.y + 3); ctx.lineTo(p.x + 8, p.y + 3);
      ctx.moveTo(p.x - 3, p.y - 8); ctx.lineTo(p.x - 3, p.y + 8);
      ctx.moveTo(p.x + 3, p.y - 8); ctx.lineTo(p.x + 3, p.y + 8);
      ctx.stroke();
    }else{
      ctx.fillStyle = COLORS.muffin;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.muffinTop;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 3, 5, Math.PI, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPowerup(p){
    ctx.strokeStyle = COLORS.powerupRing;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x + p.w/2, p.y + p.h/2, p.w/2 + 3, 0, Math.PI * 2);
    ctx.stroke();

    if (p.type === "motorcycle"){
      ctx.fillStyle = COLORS.motorcycle;
      ctx.fillRect(p.x + 4, p.y + p.w/2 - 4, p.w - 8, 8);
      ctx.fillStyle = COLORS.motorcycleWheel;
      ctx.beginPath(); ctx.arc(p.x + 8, p.y + p.h - 6, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + p.w - 8, p.y + p.h - 6, 5, 0, Math.PI * 2); ctx.fill();
    }else{
      ctx.fillStyle = COLORS.jetpack;
      ctx.fillRect(p.x + 8, p.y + 4, p.w - 16, p.h - 10);
      ctx.fillStyle = COLORS.jetpackFlame;
      ctx.fillRect(p.x + 10, p.y + p.h - 6, 4, 6);
      ctx.fillRect(p.x + p.w - 14, p.y + p.h - 6, 4, 6);
    }
  }

  function drawPlayer(){
    const x = PLAYER_X, y = player.y;

    if (player.mode === "motorcycle"){
      ctx.fillStyle = COLORS.motorcycleWheel;
      ctx.beginPath(); ctx.arc(x + 6, y + PLAYER_H - 2, 8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + PLAYER_W - 2, y + PLAYER_H - 2, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.motorcycle;
      ctx.fillRect(x, y + PLAYER_H - 18, PLAYER_W + 6, 10);
      ctx.fillStyle = COLORS.player;
      ctx.fillRect(x + 6, y + 4, 16, 18);
      return;
    }

    ctx.fillStyle = COLORS.player;
    ctx.fillRect(x, y, PLAYER_W, PLAYER_H - 8);

    const legPhase = Math.floor(frame / 6) % 2;
    if (!player.onGround){
      ctx.fillRect(x + 4, y + PLAYER_H - 8, 8, 8);
      ctx.fillRect(x + PLAYER_W - 12, y + PLAYER_H - 8, 8, 8);
    }else if (legPhase === 0){
      ctx.fillRect(x + 4, y + PLAYER_H - 8, 8, 8);
      ctx.fillRect(x + PLAYER_W - 12, y + PLAYER_H - 8, 8, 6);
    }else{
      ctx.fillRect(x + 4, y + PLAYER_H - 8, 8, 6);
      ctx.fillRect(x + PLAYER_W - 12, y + PLAYER_H - 8, 8, 8);
    }

    if (player.mode === "jetpack"){
      ctx.fillStyle = COLORS.jetpack;
      ctx.fillRect(x - 8, y + 4, 8, 20);
      ctx.fillStyle = COLORS.jetpackFlame;
      const flicker = 6 + Math.random() * 4;
      ctx.beginPath();
      ctx.moveTo(x - 8, y + 24);
      ctx.lineTo(x - 4, y + 24 + flicker);
      ctx.lineTo(x, y + 24);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawHud(){
    ctx.fillStyle = COLORS.hud;
    ctx.font = "700 15px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText("SCORE " + Math.floor(score), CANVAS_W - 12, 24);

    if (player.mode !== "normal"){
      ctx.textAlign = "left";
      const label = player.mode === "motorcycle" ? "INVINCIBLE" : "JETPACK";
      ctx.fillStyle = player.mode === "motorcycle" ? COLORS.motorcycle : COLORS.jetpack;
      ctx.fillText(label + " " + Math.ceil(player.modeFramesLeft / 60) + "s", 12, 24);
    }
  }

  /* ---------------- loop / lifecycle ---------------- */
  function loop(){
    if (!running) return;
    update();
    if (running){
      draw();
      animId = requestAnimationFrame(loop);
    }
  }

  function startGame(){
    resetState();
    started = true;
    running = true;
    hideOverlay();
    canvas.focus();
    loop();
  }

  function endGame(){
    running = false;
    over = true;
    cancelAnimationFrame(animId);
    draw();
    showGameOverOverlay();
  }

  function jump(){
    if (!started || over){ startGame(); return; }
    if (player.mode === "jetpack") return; // already hovering
    if (player.onGround){
      player.vy = JUMP_VELOCITY;
      player.onGround = false;
    }
  }

  function throwWeapon(){
    if (!started || over){ startGame(); return; }
    if (throwCooldown > 0) return;
    throwCooldown = THROW_COOLDOWN;

    const originX = PLAYER_X + PLAYER_W;
    const originY = player.y + PLAYER_H / 2;

    if (player.mode === "jetpack"){
      playerProjectiles.push({ type: "muffin", x: originX, y: originY, vx: MUFFIN_SPEED_X, vy: MUFFIN_INITIAL_VY });
    }else{
      playerProjectiles.push({ type: "waffle", x: originX, y: originY, vx: WAFFLE_SPEED, vy: 0 });
    }
  }

  /* ---------------- overlay UI ---------------- */
  function hideOverlay(){
    overlay.style.display = "none";
  }

  function showStartOverlay(){
    overlay.style.display = "flex";
    const localBest = getLocalBest();
    overlayInner.innerHTML = `
      <h3>Wizards &amp; Waffles</h3>
      <p>Left tap / Up arrow to jump. Right tap / Space to throw. Dodge or defeat the wizards — grab power-ups when you see them.</p>
      ${localBest > 0 ? `<p style="font-size:0.82rem;opacity:0.85;">Your best so far: ${localBest}</p>` : ""}
      <button type="button" class="btn" id="game-play-btn">Play</button>
    `;
    document.getElementById("game-play-btn").addEventListener("click", startGame);
  }

  function showGameOverOverlay(){
    const finalScore = Math.floor(score);
    const isNewLocalBest = setLocalBestIfHigher(finalScore);
    const localBest = getLocalBest();

    overlay.style.display = "flex";
    const storedName = (typeof getStoredName === "function" ? getStoredName() : "") || "";
    overlayInner.innerHTML = `
      <h3>Game Over</h3>
      <p>Score: ${finalScore}${isNewLocalBest ? " — new personal best!" : ""}</p>
      <p style="font-size:0.78rem;opacity:0.8;margin-top:-10px;">Your best: ${localBest}</p>
      <div class="form-row">
        <input type="text" id="game-name" placeholder="Your name" maxlength="40" value="${typeof escapeHTML === "function" ? escapeHTML(storedName) : storedName}">
      </div>
      <button type="button" class="btn" id="game-save-btn">Save Score</button>
      <button type="button" class="btn light" id="game-again-btn">Play Again</button>
      <p class="form-note" id="game-score-status"></p>
    `;

    const statusEl = document.getElementById("game-score-status");
    const saveBtn = document.getElementById("game-save-btn");

    saveBtn.addEventListener("click", async () => {
      const nameInput = document.getElementById("game-name");
      const name = nameInput.value.trim();
      if (!name){
        nameInput.focus();
        statusEl.textContent = "Add your name first.";
        statusEl.style.color = "var(--red)";
        return;
      }
      if (typeof setStoredName === "function") setStoredName(name);

      if (!isConfigured()){
        statusEl.textContent = "This isn't connected to a Google Sheet yet — see config.js.";
        statusEl.style.color = "var(--red)";
        return;
      }

      saveBtn.disabled = true;
      statusEl.textContent = "Saving…";
      statusEl.style.color = "var(--muted)";

      try{
        await apiPost({ action: "submitScore", name, score: finalScore });
        statusEl.textContent = "Saved! Check the leaderboard above.";
        statusEl.style.color = "var(--green)";
        renderLeaderboard();
      }catch(err){
        console.error(err);
        statusEl.textContent = "Couldn't save that — check your connection and try again.";
        statusEl.style.color = "var(--red)";
      }finally{
        saveBtn.disabled = false;
      }
    });

    document.getElementById("game-again-btn").addEventListener("click", startGame);
  }

  /* ---------------- leaderboard ---------------- */
  async function renderLeaderboard(){
    const list = document.getElementById("leaderboard-list");
    if (!list) return;

    if (!isConfigured()){
      list.innerHTML = configNotice("Install the backend");
      return;
    }

    let scores;
    try{
      scores = await apiGet("getScores");
    }catch(err){
      console.error(err);
      list.innerHTML = loadErrorNotice();
      return;
    }

    if (scores.length === 0){
      list.innerHTML = '<li class="empty-note">No scores yet — be the first!</li>';
      return;
    }

    list.innerHTML = scores.map((s, i) => `
      <li>
        <span class="leaderboard-rank">${i + 1}</span>
        <span class="leaderboard-name">${escapeHTML(s.name)}</span>
        <span class="leaderboard-score">${Math.floor(Number(s.score))}</span>
      </li>
    `).join("");
  }

  /* ---------------- input ---------------- */
  function handlePointer(clientX){
    const rect = canvas.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    if (!started || over){ startGame(); return; }
    if (relX < 0.5) jump(); else throwWeapon();
  }

  /* ---------------- init ---------------- */
  function initGame(){
    if (DEBUG) console.log("[W&W] game.js loaded — build includes wizard fire-cooldown fix (22-48f)");
    canvas = document.getElementById("game-canvas");
    overlay = document.getElementById("game-overlay");
    overlayInner = document.getElementById("game-overlay-inner");
    if (!canvas || !overlay) return;

    ctx = canvas.getContext("2d");
    resetState();
    draw();
    showStartOverlay();

    canvas.addEventListener("click", (e) => { canvas.focus(); handlePointer(e.clientX); });
    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      canvas.focus();
      handlePointer(e.touches[0].clientX);
    }, { passive: false });

    document.addEventListener("keydown", (e) => {
      if (document.activeElement !== canvas) return; // don't steal input meant for another game on this page
      if (e.code === "ArrowUp" || e.code === "KeyW"){
        e.preventDefault();
        jump();
      }else if (e.code === "Space"){
        e.preventDefault();
        if (!started || over) startGame();
        else throwWeapon();
      }
    });

    renderLeaderboard();
    setInterval(renderLeaderboard, 20000);
  }

  document.addEventListener("DOMContentLoaded", initGame);
})();
