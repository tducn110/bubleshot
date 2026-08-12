import type { Drop, Particle, Pop, Popup } from "./types";

export interface NewBubbleAnim {
  row: number;
  col: number;
  t: number;
}

export class Fx {
  pops: Pop[] = [];
  drops: Drop[] = [];
  parts: Particle[] = [];
  popups: Popup[] = [];
  comboA = { v: 0, alpha: 0, scale: 1, x: 0, y: 0 };
  newBubble: NewBubbleAnim | null = null;
  shakeT = 0;
  csx = 0;
  csy = 0;
  pulse = 0;

  clear() {
    this.pops.length = 0;
    this.drops.length = 0;
    this.parts.length = 0;
    this.popups.length = 0;
    this.comboA = { v: 0, alpha: 0, scale: 1, x: 0, y: 0 };
    this.newBubble = null;
    this.shakeT = 0;
    this.csx = 0;
    this.csy = 0;
    this.pulse = 0;
  }

  step(dt: number) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const intensity = this.shakeT * 8;
      this.csx = (Math.random() - 0.5) * intensity;
      this.csy = (Math.random() - 0.5) * intensity;
    } else {
      this.csx = 0;
      this.csy = 0;
    }
    this.pulse += dt * 2.8;
    if (this.comboA.alpha > 0) {
      this.comboA.alpha -= dt * 1.4;
      this.comboA.scale = Math.max(1, this.comboA.scale - dt * 4);
      this.comboA.y -= dt * 18;
    }
    for (const p of this.parts) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      p.alpha = Math.max(0, 1 - p.life / p.max);
    }
    this.parts = this.parts.filter((p) => p.alpha > 0);
    for (const sp of this.popups) {
      sp.y += sp.vy * dt;
      sp.alpha = Math.max(0, sp.alpha - dt * (sp.big ? 1.0 : 1.3));
    }
    this.popups = this.popups.filter((sp) => sp.alpha > 0);
    if (this.newBubble) {
      this.newBubble.t += dt * 5;
      if (this.newBubble.t >= 1) this.newBubble = null;
    }
  }

  shake(dur: number) {
    this.shakeT = dur;
  }

  markCombo(v: number, x: number, y: number) {
    this.comboA = { v, alpha: 1, scale: 1.8, x, y };
  }

  spawnImpact(x: number, y: number, color: string) {
    for (let i = 0; i < 7; i++) {
      const a = (Math.PI * 2 * i) / 7 + Math.random() * 0.5;
      const spd = 55 + Math.random() * 85;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color,
        alpha: 0.75,
        r: 2 + Math.random() * 3,
        life: 0,
        max: 0.18 + Math.random() * 0.12,
      });
    }
  }

  spawnPop(x: number, y: number, color: string) {
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 140;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 50,
        color,
        alpha: 1,
        r: 2 + Math.random() * 4.5,
        life: 0,
        max: 0.32 + Math.random() * 0.22,
      });
    }
  }

  spawnPopup(x: number, y: number, text: string, big: boolean, color: string) {
    this.popups.push({ x, y, text, alpha: 1, vy: big ? -38 : -58, big, color });
  }
}