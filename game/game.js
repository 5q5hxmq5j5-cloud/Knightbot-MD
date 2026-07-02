// Simple Flappy Bird clone — mobile friendly and touch-controlled.
// Tap or click anywhere to flap. Tap after death to restart.

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });

  const scoreEl = document.getElementById('score');
  const messageEl = document.getElementById('message');

  // Responsive canvas sizing (portrait-oriented)
  function resizeCanvas() {
    // Desired display width (CSS pixels)
    const displayWidth = Math.min(window.innerWidth, 420);
    const displayHeight = Math.min(window.innerHeight - 20, Math.round(displayWidth * 1.6));

    // Set CSS size (keeps layout responsive via style)
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';

    // Backing store size for crisp high-DPI rendering
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
  const flapStrength = -8.5;
  const pipeWidth = 60;
  const pipeGapMin = 120;
  const pipeGapExtra = 70;
  const pipeSpawnInterval = 1500; // ms
  let pipeSpeed = 2.6;

  // Game state
  let state = 'menu'; // 'menu' | 'playing' | 'dead'
  let bird = null;
  let pipes = [];
  let lastPipeTime = 0;
  let score = 0;
  let lastTime = performance.now();

  function resetGame() {
    W = parseInt(canvas.style.width);
    H = parseInt(canvas.style.height);
    bird = {
      x: Math.round(W * 0.28),
      y: Math.round(H * 0.45),
      r: Math.max(10, Math.round(W * 0.045)),
      vy: 0,
      rotation: 0
    };
    pipes = [];
    lastPipeTime = performance.now();
    score = 0;
    pipeSpeed = 2.6;
    state = 'menu';
    updateHUD();
  }

  function spawnPipe() {
    const gap = pipeGapMin + Math.random() * pipeGapExtra;
    const margin = 40 + Math.round(bird.r);
    const topHeight = margin + Math.random() * (H - groundHeight - gap - margin * 2);
    pipes.push({
      x: W + 10,
      w: pipeWidth,
      top: Math.round(topHeight),
      gap: Math.round(gap),
      passed: false
    });
  }

  function flap() {
    if (state === 'menu') {
      state = 'playing';
      bird.vy = flapStrength;
      lastPipeTime = performance.now();
      messageEl.textContent = '';
    } else if (state === 'playing') {
      bird.vy = flapStrength;
    } else if (state === 'dead') {
      resetGame();
    }
  }

  // Input handling (touch and mouse/pointer)
  function onPointerDown(e) {
    // prevent e.g. text selection on mobile
    if (e.cancelable) e.preventDefault();
    flap();
  }
  window.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('mousedown', onPointerDown, { passive: false });
  window.addEventListener('pointerdown', onPointerDown, { passive: false });

  function update(delta) {
    if (state === 'playing') {
      // Bird physics
      bird.vy += gravity;
      bird.y += bird.vy;
      bird.rotation = Math.max(-0.6, Math.min(1.2, bird.vy / 10));

      // Pipes
      for (let p of pipes) {
        p.x -= pipeSpeed;
        // score when passing
        if (!p.passed && p.x + p.w < bird.x) {
          p.passed = true;
          score++;
          // small increase in difficulty
          if (score % 5 === 0) pipeSpeed += 0.2;
          updateHUD();
        }
      }
      // remove off-screen pipes
      pipes = pipes.filter(p => p.x + p.w > -20);

      // spawn new pipes
      if (performance.now() - lastPipeTime > pipeSpawnInterval) {
        spawnPipe();
        lastPipeTime = performance.now();
      }

      // Collisions
      // ground/ceiling
      if (bird.y - bird.r < 0 || bird.y + bird.r > H - groundHeight) {
        die();
        return;
      }
      // pipes rectangles
      for (let p of pipes) {
        // top pipe rect: x..x+w, 0..p.top
        if (rectCircleColliding(p.x, 0, p.w, p.top, bird.x, bird.y, bird.r)) {
          die();
          return;
        }
        // bottom pipe rect: x..x+w, p.top+gap .. H-groundHeight
        if (rectCircleColliding(p.x, p.top + p.gap, p.w, H - groundHeight - (p.top + p.gap), bird.x, bird.y, bird.r)) {
          die();
          return;
        }
      }
    } else if (state === 'menu') {
      // small idle flap bob
      bird.rotation = Math.sin(performance.now() / 300) * 0.08;
    } else if (state === 'dead') {
      // fall to ground if not already
      if (bird.y + bird.r < H - groundHeight) {
        bird.vy += gravity;
        bird.y += bird.vy;
        bird.rotation = Math.min(1.2, bird.rotation + 0.05);
      }
    }
  }

  function die() {
    state = 'dead';
    messageEl.textContent = 'Game over — tap to restart';
  }

  function rectCircleColliding(rx, ry, rw, rh, cx, cy, cr) {
    // Find closest point to circle within rectangle
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) < (cr * cr);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function draw() {
    // Clear
    ctx.fillStyle = '#70c5ce';
    ctx.fillRect(0, 0, W, H);

    // Background subtle (optional)
    // Draw pipes
    for (let p of pipes) {
      ctx.fillStyle = '#2ea44f';
      // top pipe
      ctx.fillRect(p.x, 0, p.w, p.top);
      // bottom pipe
      ctx.fillRect(p.x, p.top + p.gap, p.w, H - groundHeight - (p.top + p.gap));
      // pipe caps
      ctx.fillStyle = '#237a37';
      ctx.fillRect(p.x - 4, p.top - 8, p.w + 8, 8); // top cap
      ctx.fillRect(p.x - 4, p.top + p.gap, p.w + 8, 8); // bottom cap
    }

    // ground
    ctx.fillStyle = '#d18b3b';
    ctx.fillRect(0, H - groundHeight, W, groundHeight);
    // ground detail stripes
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 20; i++) {
      const x = (i * 50 + (performance.now() / 30) % 50);
      ctx.fillRect(x, H - groundHeight + 10, 30, 6);
    }

    // Bird
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.rotation);
    // body
    ctx.fillStyle = '#ffd54a';
    ctx.beginPath();
    ctx.arc(0, 0, bird.r, 0, Math.PI * 2);
    ctx.fill();
    // wing
    ctx.fillStyle = '#ffb74d';
    ctx.beginPath();
    ctx.ellipse(-bird.r * 0.1, bird.r * 0.1, bird.r * 0.55, bird.r * 0.35, -0.6, 0, Math.PI * 2);
    ctx.fill();
    // eye
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(bird.r * 0.35, -bird.r * 0.2, Math.max(2, bird.r * 0.18), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Score is drawn via HUD element, no need to draw here.
  }

  function updateHUD() {
    scoreEl.textContent = score;
    if (state === 'menu') {
      messageEl.textContent = 'Tap to start';
    } else if (state === 'playing') {
      messageEl.textContent = '';
    } else if (state === 'dead') {
      messageEl.textContent = 'Game over — tap to restart';
    }
  }

  function gameLoop(now) {
    const delta = Math.min(40, now - lastTime);
    lastTime = now;

    // Recompute width/height if CSS changed (e.g., orientation change)
    const newW = parseInt(canvas.style.width);
    const newH = parseInt(canvas.style.height);
    if (newW !== W || newH !== H) {
      W = newW; H = newH;
      // Ensure bird remains inside bounds; small adjustments
      bird.x = Math.round(W * 0.28);
      bird.y = Math.min(bird.y, H - groundHeight - bird.r - 2);
    }

    update(delta);
    draw();
    requestAnimationFrame(gameLoop);
  }

  // Kick things off
  resetGame();
  requestAnimationFrame(gameLoop);
})();
