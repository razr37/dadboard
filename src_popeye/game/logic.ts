import { GW, GH, CW, CH, FLOORS, LADDERS } from './constants';

let uid = 0;
const id = () => ++uid;

export type GameState = {
  status: 'title' | 'playing' | 'gameover';
  score: number; hi: number; lives: number; level: number; frame: number;
  popeye: { x: number; y: number; floor: number; facing: number; punch: number; invincible: number };
  bluto: { x: number; y: number; dir: number; angry: number };
  olive: { x: number; y: number };
  projectiles: { id: number; x: number; y: number; vx: number; vy: number }[];
  hearts: { id: number; x: number; y: number; vy: number }[];
  spinachCan: { x: number; y: number; pulse: number } | null;
  spinachActive: boolean; spinachTimer: number; spinachSpawn: number; caught: number;
};

export type Input = { left: boolean; right: boolean; up: boolean; down: boolean; punch: boolean; spinach: boolean };

export function makeState(): GameState {
  return {
    status: 'title', score: 0, hi: 0, lives: 3, level: 1, frame: 0,
    popeye: { x: GW/2, y: FLOORS[0].y - CH, floor: 0, facing: 1, punch: 0, invincible: 0 },
    bluto: { x: GW*0.65, y: FLOORS[2].y - CH*1.3, dir: -1, angry: 0 },
    olive: { x: GW*0.47, y: GH*0.08 },
    projectiles: [], hearts: [],
    spinachCan: null, spinachActive: false, spinachTimer: 0, spinachSpawn: 100, caught: 0,
  };
}

export function startGame(s: GameState): GameState {
  const n = makeState();
  return { ...n, status: 'playing', hi: s.hi, hearts: [{ id: id(), x: n.olive.x, y: n.olive.y + CH, vy: GH*0.004 }] };
}

export function tick(s: GameState, inp: Input, haptic: (t: 'light'|'medium'|'heavy') => void): GameState {
  if (s.status !== 'playing') return s;
  let n = { ...s, frame: s.frame + 1 };
  n.popeye = { ...n.popeye };
  n.bluto = { ...n.bluto };

  const spd = n.spinachActive ? GW*0.013 : GW*0.008;
  const fl = FLOORS[n.popeye.floor];

  if (inp.left)  { n.popeye.x -= spd; n.popeye.facing = -1; }
  if (inp.right) { n.popeye.x += spd; n.popeye.facing =  1; }
  n.popeye.x = Math.max(fl.x1, Math.min(fl.x2 - CW, n.popeye.x));

  if (inp.punch && n.popeye.punch === 0) { n.popeye.punch = 14; haptic('medium'); }
  if (n.popeye.punch > 0) n.popeye.punch--;
  if (n.popeye.invincible > 0) n.popeye.invincible--;

  if (inp.spinach && n.spinachCan && !n.spinachActive) {
    if (Math.abs(n.popeye.x - n.spinachCan.x) < CW*2.5 && Math.abs(n.popeye.y - n.spinachCan.y) < CH*2) {
      n.spinachCan = null; n.spinachActive = true; n.spinachTimer = 300; haptic('heavy');
    }
  }
  if (n.spinachActive && --n.spinachTimer <= 0) n.spinachActive = false;

  let onLadder = false;
  for (const lad of LADDERS) {
    if (Math.abs(n.popeye.x + CW/2 - lad.x) > CW) continue;
    if (inp.up && n.popeye.floor < FLOORS.length-1) {
      const nf = FLOORS[n.popeye.floor+1];
      if (Math.abs(lad.y1 - nf.y) < 4) {
        n.popeye.y -= spd*1.3; onLadder = true;
        if (n.popeye.y <= nf.y - CH) { n.popeye.floor++; n.popeye.y = FLOORS[n.popeye.floor].y - CH; onLadder = false; }
      }
    }
    if (inp.down && n.popeye.floor > 0) {
      const cf = FLOORS[n.popeye.floor];
      if (Math.abs(lad.y2 - cf.y) < 4) {
        n.popeye.y += spd*1.3; onLadder = true;
        if (n.popeye.y >= cf.y) { n.popeye.floor--; n.popeye.y = FLOORS[n.popeye.floor].y - CH; onLadder = false; }
      }
    }
  }
  if (!onLadder) n.popeye.y = FLOORS[n.popeye.floor].y - CH;

  const bs = GW*0.003 + n.level*GW*0.001;
  n.bluto.x += n.bluto.dir * bs;
  if (n.bluto.x < FLOORS[2].x1 + CW) n.bluto.dir = 1;
  if (n.bluto.x > FLOORS[2].x2 - CW*2) n.bluto.dir = -1;
  if (n.bluto.angry > 0) n.bluto.angry--;

  if (n.frame % Math.max(50, 130 - n.level*12) === 0) {
    n.projectiles = [...n.projectiles, { id: id(), x: n.bluto.x, y: n.bluto.y + CH*0.5, vx: n.bluto.dir*(GW*0.005 + n.level*GW*0.001), vy: GH*0.002 }];
  }

  const punchX = n.popeye.x + (n.popeye.facing > 0 ? CW*1.6 : -CW*0.6);
  const punchY = n.popeye.y + CH*0.4;

  n.projectiles = n.projectiles
    .map(p => ({ ...p, x: p.x+p.vx, y: p.y+p.vy, vy: p.vy+GH*0.0002 }))
    .filter(p => {
      if (n.popeye.punch > 6 && Math.abs(p.x-punchX) < CW*1.5 && Math.abs(p.y-punchY) < CH) { n.score += 50; haptic('light'); return false; }
      if (n.popeye.invincible === 0 && !n.spinachActive && Math.abs(p.x-(n.popeye.x+CW/2)) < CW*0.8 && Math.abs(p.y-(n.popeye.y+CH/2)) < CH*0.8) { n = loseLife(n, haptic); return false; }
      return p.x > 0 && p.x < GW && p.y < GH;
    });

  if (n.frame % 210 === 0) n.hearts = [...n.hearts, { id: id(), x: n.olive.x, y: n.olive.y+CH, vy: GH*0.004 }];

  n.hearts = n.hearts
    .map(h => ({ ...h, y: h.y+h.vy }))
    .filter(h => {
      if (Math.abs(h.x-(n.popeye.x+CW/2)) < CW*1.5 && Math.abs(h.y-(n.popeye.y+CH/2)) < CH*1.5) { n.score += 150; n.caught++; if (n.caught%5===0) n.level = Math.min(6,n.level+1); haptic('light'); return false; }
      if (h.y > GH) { n = loseLife(n, haptic); return false; }
      return true;
    });

  if (--n.spinachSpawn <= 0 && !n.spinachCan) {
    n.spinachCan = { x: FLOORS[0].x1 + Math.random()*(FLOORS[0].x2-FLOORS[0].x1-CW), y: FLOORS[0].y-CH, pulse: 0 };
    n.spinachSpawn = 400;
  }
  if (n.spinachCan) n.spinachCan = { ...n.spinachCan, pulse: (n.spinachCan.pulse+0.1) % (Math.PI*2) };

  if (n.popeye.punch > 0 && n.popeye.floor === 2 && Math.abs(n.popeye.x-n.bluto.x) < CW*3) {
    n.score += n.spinachActive ? 500 : 100; n.bluto.angry = 60; haptic(n.spinachActive ? 'heavy' : 'medium');
  }

  return n;
}

function loseLife(s: GameState, haptic: (t: 'light'|'medium'|'heavy') => void): GameState {
  haptic('heavy');
  const lives = s.lives - 1;
  if (lives <= 0) return { ...s, lives: 0, status: 'gameover', hi: Math.max(s.hi, s.score) };
  return { ...s, lives, popeye: { ...s.popeye, invincible: 120 }, spinachActive: true, spinachTimer: 90, projectiles: [] };
}
