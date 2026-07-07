/* =====================================================================
   THE MIDLAND MIXER — Dino Game
   A simple canvas runner, inspired by the Chrome "no internet" game.
   Loaded only on game.html, after config.js and app.js (reuses apiGet,
   apiPost, escapeHTML, getStoredName, setStoredName, isConfigured,
   configNotice, loadErrorNotice from app.js — same global scope).
   ===================================================================== */

(function(){
  const CANVAS_W = 640;
  const CANVAS_H = 200;
  const GROUND_Y = 170;
  const GRAVITY = 0.7;
  const JUMP_VELOCITY = -12;
  const DINO_W = 34;
  const DINO_H = 38;
  const START_SPEED = 6;
  const MAX_SPEED = 13;
  const SPEED_RAMP = 0.0015; // speed gained per frame

  let canvas, ctx, overlay, overlayInner, scoreEl;
  let dino, obstacles, speed, score, frame, running, over, started, nextObstacleFrame, animId;

  function resetState(){
    dino = { x: 50, y: GROUND_Y - DINO_H, vy: 0, onGround: true };
    obstacles = [];
    speed = START_SPEED;
    score = 0;
    frame = 0;
    nextObstacleFrame = 70;
    running = false;
    over = false;
  }

  function rectsOverlap(x1,y1,w1,h1,x2,y2,w2,h2){
    const pad = 5; // forgiving hitboxes so near-misses feel fair
    return x1+pad < x2+w2-pad && x1+w1-pad > x2+pad && y1+pad < y2+h2-pad && y1+h1-pad > y2+pad;
  }

  function spawnObstacle(){
    const heights = [20, 30, 42];
    const h = heights[Math.floor(Math.random() * heights.length)];
    const w = 14 + Math.floor(Math.random() * 16);
    obstacles.push({ x: CANVAS_W + 10, y: GROUND_Y - h, w, h });
  }

  function update(){
    frame++;
    speed = Math.min(MAX_SPEED, START_SPEED + frame * SPEED_RAMP);
    score += speed * 0.05;

    dino.vy += GRAVITY;
    dino.y += dino.vy;
    if (dino.y >= GROUND_Y - DINO_H){
      dino.y = GROUND_Y - DINO_H;
      dino.vy = 0;
      dino.onGround = true;
    }

    if (frame >= nextObstacleFrame){
      spawnObstacle();
      nextObstacleFrame = frame + Math.max(38, 95 - speed * 4) + Math.floor(Math.random() * 30);
    }
    obstacles.forEach(o => { o.x -= speed; });
    obstacles = obstacles.filter(o => o.x + o.w > -5);

    for (let i = 0; i < obstacles.length; i++){
      const o = obstacles[i];
      if (rectsOverlap(dino.x, dino.y, DINO_W, DINO_H, o.x, o.y, o.w, o.h)){
        endGame();
        return;
      }
    }
  }

  function draw(){
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // ground
    ctx.strokeStyle = "#D6DAE2";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(CANVAS_W, GROUND_Y);
    ctx.stroke();

    // dino (simple blocky runner — legs alternate for a tiny bit of motion)
    ctx.fillStyle = "#14181F";
    ctx.fillRect(dino.x, dino.y, DINO_W, DINO_H - 8);
    const legPhase = Math.floor(frame / 6) % 2;
    if (legPhase === 0){
      ctx.fillRect(dino.x + 4, dino.y + DINO_H - 8, 8, 8);
      ctx.fillRect(dino.x + DINO_W - 12, dino.y + DINO_H - 8, 8, 6);
    }else{
      ctx.fillRect(dino.x + 4, dino.y + DINO_H - 8, 8, 6);
      ctx.fillRect(dino.x + DINO_W - 12, dino.y + DINO_H - 8, 8, 8);
    }
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(dino.x + DINO_W - 11, dino.y + 6, 4, 4);

    // obstacles (cacti)
    ctx.fillStyle = "#12B76A";
    obstacles.forEach(o => ctx.fillRect(o.x, o.y, o.w, o.h));

    // score
    ctx.fillStyle = "#14181F";
    ctx.font = "700 15px 'JetBrains Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText("SCORE " + Math.floor(score), CANVAS_W - 12, 24);
  }

  function loop(){
    if (!running) return;
    update();
    if (running){ // update() may have ended the game
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
    if (!started || over){
      startGame();
      return;
    }
    if (dino.onGround){
      dino.vy = JUMP_VELOCITY;
      dino.onGround = false;
    }
  }

  function hideOverlay(){
    overlay.style.display = "none";
  }

  function showStartOverlay(){
    overlay.style.display = "flex";
    overlayInner.innerHTML = `
      <h3>Dino Game</h3>
      <p>Press Space, tap the game, or hit the button to start. Jump the cacti — that's it.</p>
      <button type="button" class="btn" id="game-play-btn">Play</button>
    `;
    document.getElementById("game-play-btn").addEventListener("click", startGame);
  }

  function showGameOverOverlay(){
    const finalScore = Math.floor(score);
    overlay.style.display = "flex";
    const storedName = (typeof getStoredName === "function" ? getStoredName() : "") || "";
    overlayInner.innerHTML = `
      <h3>Game Over</h3>
      <p>Score: ${finalScore}</p>
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

  /* ---------------- Leaderboard ---------------- */
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

  /* ---------------- Init ---------------- */
  function initGame(){
    canvas = document.getElementById("dino-canvas");
    overlay = document.getElementById("game-overlay");
    overlayInner = document.getElementById("game-overlay-inner");
    if (!canvas || !overlay) return;

    ctx = canvas.getContext("2d");
    resetState();
    draw();
    showStartOverlay();

    canvas.addEventListener("click", jump);
    canvas.addEventListener("touchstart", (e) => { e.preventDefault(); jump(); }, { passive: false });

    document.addEventListener("keydown", (e) => {
      if (e.code === "Space" || e.code === "ArrowUp"){
        e.preventDefault();
        jump();
      }
    });

    renderLeaderboard();
    setInterval(renderLeaderboard, 20000); // keep the leaderboard reasonably "live"
  }

  document.addEventListener("DOMContentLoaded", initGame);
})();
