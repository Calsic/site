const canvas = document.getElementById("intelligence-field");
const context = canvas.getContext("2d", { alpha: true });
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const palette = ["#ff3a0d", "#a72308", "#ffca05", "#958000", "#f7f4ed"];
const pointer = { x: -9999, y: -9999, active: false };
const bursts = [];

let width = 0;
let height = 0;
let dpr = 1;
let tiles = [];
let animationFrame = 0;

const patterns = [
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 1, 2],
    [3, 0, 2],
  ],
  [
    [0, 0, 2],
    [1, 0, 3],
    [2, 0, 3],
    [3, 1, 0],
    [4, 1, 1],
  ],
  [
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 0],
    [2, 1, 0],
    [3, 2, 0],
  ],
  [
    [0, 0, 3],
    [1, 0, 2],
    [2, 0, 2],
    [2, -1, 2],
    [3, 1, 0],
  ],
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function addTile(x, y, size, color, alpha = 0.84) {
  tiles.push({
    x,
    y,
    bx: x,
    by: y,
    vx: 0,
    vy: 0,
    size,
    color,
    alpha,
    phase: Math.random() * Math.PI * 2,
    pulse: Math.random() * 0.45,
  });
}

function addPattern(pattern, x, y, step, alpha = 0.78) {
  pattern.forEach(([px, py, colorIndex]) => {
    addTile(x + px * step, y + py * step, step - 1, palette[colorIndex], alpha);
  });
}

function seedField() {
  tiles = [];

  const step = clamp(width / 25, 24, 58);
  const isNarrow = width < 640;

  if (isNarrow) {
    addPattern(patterns[0], width * 0.66, height * 0.13, step * 0.76, 0.64);
    addPattern(patterns[1], width * -0.2, height * 0.36, step * 0.84, 0.52);
    addPattern(patterns[2], width * 0.94, height * 0.7, step * 0.82, 0.44);
    addPattern(patterns[3], width * -0.05, height * 0.9, step * 0.68, 0.28);
  } else {
    addPattern(patterns[0], width * 0.66, height * 0.12, step, 0.78);
    addPattern(patterns[1], width * -0.08, height * 0.36, step, 0.72);
    addPattern(patterns[2], width * 0.76, height * 0.72, step, 0.68);
    addPattern(patterns[3], width * 0.15, height * 0.82, step * 0.82, 0.42);
  }

  const dustCount = Math.round(clamp((width * height) / (isNarrow ? 46000 : 32000), 18, 74));
  for (let index = 0; index < dustCount; index += 1) {
    const dustSize = Math.round(clamp(step * (0.12 + Math.random() * 0.22), 4, 13));
    const x = Math.random() * width;
    const y = Math.random() * height;
    const color = Math.random() > 0.7 ? palette[Math.floor(Math.random() * 4)] : palette[4];
    addTile(x, y, dustSize, color, color === palette[4] ? 0.05 : isNarrow ? 0.07 : 0.22);
  }
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  seedField();
}

function addBurst(x, y, power = 1) {
  bursts.push({ x, y, radius: 0, life: 1, power });
  if (bursts.length > 8) {
    bursts.shift();
  }
}

function drawConnections(time) {
  context.lineWidth = 1;

  for (let i = 0; i < tiles.length; i += 1) {
    const a = tiles[i];
    if (a.alpha < 0.15) continue;

    for (let j = i + 1; j < Math.min(i + 7, tiles.length); j += 1) {
      const b = tiles[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 150) {
        const signal = (1 - distance / 150) * 0.08;
        context.strokeStyle = `rgba(247, 244, 237, ${signal})`;
        context.beginPath();
        context.moveTo(a.x + a.size / 2, a.y + a.size / 2);
        context.lineTo(
          b.x + b.size / 2 + Math.sin(time * 0.001 + b.phase) * 2,
          b.y + b.size / 2 + Math.cos(time * 0.001 + a.phase) * 2,
        );
        context.stroke();
      }
    }
  }
}

function draw(time) {
  context.clearRect(0, 0, width, height);
  const isReduced = reducedMotion.matches;

  bursts.forEach((burst) => {
    burst.radius += isReduced ? 0 : 8 + burst.power * 5;
    burst.life -= isReduced ? 0.03 : 0.018;
  });

  while (bursts.length && bursts[0].life <= 0) {
    bursts.shift();
  }

  drawConnections(time);

  tiles.forEach((tile) => {
    const drift = isReduced ? 0 : Math.sin(time * 0.0007 + tile.phase) * 12;
    let targetX = tile.bx + drift * (tile.alpha > 0.5 ? 0.5 : 1.1);
    let targetY = tile.by + Math.cos(time * 0.00055 + tile.phase) * (tile.alpha > 0.5 ? 6 : 16);

    const dx = tile.x + tile.size / 2 - pointer.x;
    const dy = tile.y + tile.size / 2 - pointer.y;
    const distance = Math.hypot(dx, dy);
    const pointerReach = pointer.active ? 230 : 150;

    if (distance < pointerReach) {
      const force = (1 - distance / pointerReach) * (pointer.active ? 82 : 46);
      const angle = Math.atan2(dy, dx);
      targetX += Math.cos(angle) * force;
      targetY += Math.sin(angle) * force;
      tile.pulse = clamp(tile.pulse + 0.055, 0, 1);
    }

    bursts.forEach((burst) => {
      const bx = tile.x - burst.x;
      const by = tile.y - burst.y;
      const burstDistance = Math.hypot(bx, by);
      const reach = 340 * burst.power;

      if (burstDistance < reach) {
        const force = (1 - burstDistance / reach) * 150 * burst.life;
        const angle = Math.atan2(by, bx);
        targetX += Math.cos(angle) * force;
        targetY += Math.sin(angle) * force;
        tile.pulse = clamp(tile.pulse + 0.04, 0, 1);
      }
    });

    tile.x += (targetX - tile.x) * 0.075;
    tile.y += (targetY - tile.y) * 0.075;
    tile.pulse *= 0.94;

    const alpha = clamp(tile.alpha + tile.pulse * 0.28, 0.03, 1);
    const size = tile.size + tile.pulse * 5;

    context.globalAlpha = alpha;
    context.fillStyle = tile.color;
    context.fillRect(Math.round(tile.x), Math.round(tile.y), Math.round(size), Math.round(size));
  });

  context.globalAlpha = 1;

  bursts.forEach((burst) => {
    context.strokeStyle = `rgba(255, 202, 5, ${0.22 * burst.life})`;
    context.lineWidth = 2;
    context.strokeRect(
      burst.x - burst.radius / 2,
      burst.y - burst.radius / 2,
      burst.radius,
      burst.radius,
    );
  });

  animationFrame = window.requestAnimationFrame(draw);
}

function updatePointer(event) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
}

window.addEventListener("resize", resize);
window.addEventListener("pointermove", updatePointer);
window.addEventListener("pointerdown", (event) => {
  pointer.active = true;
  updatePointer(event);
  addBurst(event.clientX, event.clientY, 1.1);
});
window.addEventListener("pointerup", () => {
  pointer.active = false;
});
window.addEventListener("pointerleave", () => {
  pointer.active = false;
  pointer.x = -9999;
  pointer.y = -9999;
});

resize();
animationFrame = window.requestAnimationFrame(draw);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    window.cancelAnimationFrame(animationFrame);
    return;
  }

  animationFrame = window.requestAnimationFrame(draw);
});
