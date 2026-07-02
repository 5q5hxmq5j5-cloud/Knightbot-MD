// game.js — Flappy Bird (modular) with sound effects, animated bird frames, and shareable high score
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });

  const scoreEl = document.getElementById('score');
  const highEl = document.getElementById('highscore');
  const messageEl = document.getElementById('message');
  const shareBtn = document.getElementById('shareBtn');

  const STORAGE_KEY = 'flappy_highscore_v1';

  // Audio setup (Web Audio API)
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
  }

  function playTone(timeFromNow, freq, type = 'sine', duration = 0.08, gain = 0.12) {
    ensureAudio();
    const t = audioCtx.currentTime + (timeFromNow || 0);
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + duration);
  }

  function playNoise(timeFromNow, duration = 0.2, gain = 0.2) {
    ensureAudio();
    const t = audioCtx.currentTime + (timeFromNow || 0);
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const g = audioCtx.createGain(); g.gain.setValueAtTime(gain, t);
    source.connect(g); g.connect(audioCtx.destination);
    source.start(t); source.stop(t + duration);
  }

  // Effects
  function flapSound() {
    playTone(0, 650, 'sine', 0.06, 0.12);
  }
  function scoreSound() {
    // small arpeggio
    playTone(0, 880, 'triangle', 0.08, 0.09);
    playTone(0.09, 1100, 'triangle', 0.08, 0.08);
    playTone(0.18, 1320, 'triangle', 0.08, 0.07);
  }
  function hitSound() {
    playNoise(0, 0.25, 0.18);
    playTone(0, 120, 'sawtooth', 0.25, 0.14);
  }

  // Responsive canvas sizing
  function resizeCanvas() {
    const displayWidth = Math.min(window.innerWidth, 420);
    const displayHeight = Math.min(window.innerHeight - 20, Math.round(displayWidth * 1.6));
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
    const DPR = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = Math.floor(displayWidth * DPR);
    canvas.height = Math.floor(displayHeight * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resizeCanvas, { passive: true });
  resizeCanvas();

  // Game constants
  let W = parseInt(canvas.style.width);
  let H = parseInt(canvas.style.height);
  const groundHeight = 80;
  const gravity = 0.45;
  const flapStrength = -8.8;
  const pipeWidth = 60;
  const pipeGapMin = 120;
  const pipeGapExtra = 70;
  const pipeSpawnInterval = 1400; // ms
  let pipeSpeed = 2.6;

  // State
  let state = 'menu';
  let bird = null;
  let pipes = [];
  let lastPipeTime = 0;
  let score = 0;
  let highscore = 0;
  let lastTime = performance.now();

  // Bird animation frames (procedural frames via wing offset)
  const birdFrames = [ -0.8, -0.35, 0, 0.35, 0.8, 0.35, 0 ]; // wing rotation offsets
  let frameIdx = 0;
  let frameTimer = 0;
  const frameInterval = 80; // ms

  function loadHighscore() {
    try{ const v = localStorage.getItem(STORAGE_KEY); highscore = v ? parseInt(v,10)||0 : 0; }catch(e){ highscore = 0; }
    updateHUD();
  }
  function saveHighscore() {
    try{ localStorage.setItem(STORAGE_KEY, String(highscore)); }catch(e){}
  }

  function resetGame() {
    W = parseInt(canvas.style.width);
    H = parseInt(canvas.style.height);
    bird = { x: Math.round(W * 0.28), y: Math.round(H * 0.45), r: Math.max(10, Math.round(W * 0.045)), vy: 0, rotation: 0 };
    pipes = [];
    lastPipeTime = performance.now();
    score = 0;
    pipeSpeed = 2.6;
    state = 'menu';
    frameIdx = 0; frameTimer = 0;
    updateHUD();
    messageEl.textContent = 'Tap to start';
  }

  function spawnPipe() {
    const gap = pipeGapMin + Math.random() * pipeGapExtra;
    const margin = 40 + Math.round(bird.r);
    const topHeight = margin + Math.random() * Math.max(0, (H - groundHeight - gap - margin * 2));
    pipes.push({ x: W + 10, w: pipeWidth, top: Math.round(topHeight), gap: Math.round(gap), passed: false });
  }

  function flap() {
    // resume audio context on iOS autoplay policies
    if (!audioCtx && typeof AudioContext !== 'undefined') {
      try { ensureAudio(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {}
    }

    if (state === 'menu') {
      state = 'playing';
      bird.vy = flapStrength;
      lastPipeTime = performance.now();
      messageEl.textContent = '';
      flapSound();
    } else if (state === 'playing') {
      bird.vy = flapStrength;
      flapSound();
    } else if (state === 'dead') {
      resetGame();
    }
  }

  function onPointerDown(e) { if (e.cancelable) e.preventDefault(); flap(); }
  window.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('mousedown', onPointerDown, { passive: false });
  window.addEventListener('pointerdown', onPointerDown, { passive: false });

  function die() {
    if (state !== 'dead') {
      state = 'dead';
      hitSound();
      if (score > highscore) { highscore = score; saveHighscore(); }
      messageEl.textContent = 'Game over — tap to restart';
      updateHUD();
    }
  }

  function rectCircleColliding(rx, ry, rw, rh, cx, cy, cr) {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX; const dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function update(delta) {
    if (state === 'playing') {
      bird.vy += gravity;
      bird.y += bird.vy;
      bird.rotation = Math.max(-0.8, Math.min(1.4, bird.vy / 8));

      // pipes
      for (let p of pipes) {
        p.x -= pipeSpeed;
        if (!p.passed && p.x + p.w < bird.x) {
          p.passed = true; score++; scoreSound();
          if (score % 5 === 0) pipeSpeed += 0.2;
          updateHUD();
        }
      }
      pipes = pipes.filter(p => p.x + p.w > -20);
      if (performance.now() - lastPipeTime > pipeSpawnInterval) { spawnPipe(); lastPipeTime = performance.now(); }

      // collisions
      if (bird.y - bird.r < 0 || bird.y + bird.r > H - groundHeight) { die(); return; }
      for (let p of pipes) {
        if (rectCircleColliding(p.x, 0, p.w, p.top, bird.x, bird.y, bird.r)) { die(); return; }
        if (rectCircleColliding(p.x, p.top + p.gap, p.w, H - groundHeight - (p.top + p.gap), bird.x, bird.y, bird.r)) { die(); return; }
      }

      // frame animation advance
      frameTimer += delta;
      if (frameTimer > frameInterval) { frameTimer = 0; frameIdx = (frameIdx + 1) % birdFrames.length; }

    } else if (state === 'menu') {
      bird.rotation = Math.sin(performance.now() / 300) * 0.08;
      // slow idle flap
      frameTimer += delta; if (frameTimer > 220) { frameTimer = 0; frameIdx = (frameIdx + 1) % birdFrames.length; }
    } else if (state === 'dead') {
      if (bird.y + bird.r < H - groundHeight) { bird.vy += gravity; bird.y += bird.vy; bird.rotation = Math.min(1.4, bird.rotation + 0.05); }
    }
  }

  function draw() {
    // clear
    ctx.fillStyle = '#70c5ce'; ctx.fillRect(0, 0, W, H);

    // pipes
    for (let p of pipes) {
      ctx.fillStyle = '#2ea44f'; ctx.fillRect(p.x, 0, p.w, p.top);
      ctx.fillRect(p.x, p.top + p.gap, p.w, H - groundHeight - (p.top + p.gap));
      ctx.fillStyle = '#237a37'; ctx.fillRect(p.x - 4, p.top - 8, p.w + 8, 8);
      ctx.fillRect(p.x - 4, p.top + p.gap, p.w + 8, 8);
    }

    // ground
    ctx.fillStyle = '#d18b3b'; ctx.fillRect(0, H - groundHeight, W, groundHeight);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 20; i++) { const x = (i * 50 + (performance.now() / 30) % 50); ctx.fillRect(x, H - groundHeight + 10, 30, 6); }

    // bird (animated frames)
    ctx.save(); ctx.translate(bird.x, bird.y); ctx.rotate(bird.rotation);
    // body
    ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(0, 0, bird.r, 0, Math.PI * 2); ctx.fill();
    // wing — frame-driven
    const wingOffset = birdFrames[frameIdx] * bird.r * 0.6;
    ctx.fillStyle = '#ffb74d'; ctx.beginPath();
    ctx.ellipse(-bird.r * 0.1, bird.r * 0.12, bird.r * 0.6, bird.r * 0.35, wingOffset, 0, Math.PI * 2);
    ctx.fill();
    // eye
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(bird.r * 0.35, -bird.r * 0.2, Math.max(2, bird.r * 0.16), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function updateHUD() { scoreEl.textContent = score; highEl.textContent = 'Best: ' + highscore; }

  function gameLoop(now) {
    const delta = Math.min(40, now - lastTime);
    lastTime = now;
    const newW = parseInt(canvas.style.width); const newH = parseInt(canvas.style.height);
    if (newW !== W || newH !== H) { W = newW; H = newH; bird.x = Math.round(W * 0.28); bird.y = Math.min(bird.y, H - groundHeight - bird.r - 2); }
    update(delta); draw(); requestAnimationFrame(gameLoop);
  }

  // Share handling
  function shareScore() {
    const text = `I scored ${score} points in this Flappy Bird! Can you beat me?`;
    const shareData = { title: 'Flappy Bird — Score', text };
    if (navigator.share) {
      navigator.share(shareData).catch(()=>{});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        // brief temporary message
        const prev = messageEl.textContent;
        messageEl.textContent = 'Score copied to clipboard';
        setTimeout(() => { messageEl.textContent = prev; }, 1500);
      }).catch(()=>{});
    } else {
      // fallback: prompt
      window.prompt('Copy your score', text);
    }
  }
  shareBtn.addEventListener('click', (e) => { e.stopPropagation(); shareScore(); });

  // init
  loadHighscore(); resetGame(); requestAnimationFrame(gameLoop);
})();
