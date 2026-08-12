import { Texture } from "pixi.js";
import { COLORS } from "../config";
import type { Layout } from "../layout";

export const TEX_BR = 32;
export const TEX_BUBBLE = 96;
export const DOT_R = 14;
export const TRAJ_R = 6;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w));
  cv.height = Math.max(1, Math.round(h));
  return [cv, cv.getContext("2d")!];
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

function roundRectTexture(w: number, h: number, r: number, fill: string, stroke?: { color: string; width: number }): Texture {
  const [cv, g] = canvas(w, h);
  rr(g, 0.5, 0.5, w - 1, h - 1, r);
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke.color;
    g.lineWidth = stroke.width;
    g.stroke();
  }
  return Texture.from(cv);
}

function dotTexture(size: number, radius: number): Texture {
  const [cv, g] = canvas(size, size);
  const c = size / 2;
  const grad = g.createRadialGradient(c, c, 0, c, c, radius);
  grad.addColorStop(0, "rgba(255,255,255,.95)");
  grad.addColorStop(0.65, "rgba(255,255,255,.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, radius, 0, Math.PI * 2);
  g.fill();
  return Texture.from(cv);
}

function bubbleTexture(hex: string, glow: boolean): Texture {
  const [cv, g] = canvas(TEX_BUBBLE, TEX_BUBBLE);
  const c = TEX_BUBBLE / 2;
  g.save();
  g.shadowColor = "rgba(13,73,120,.32)";
  g.shadowBlur = TEX_BR * 0.26;
  g.shadowOffsetY = TEX_BR * 0.14;
  g.beginPath();
  g.arc(c, c, TEX_BR, 0, Math.PI * 2);
  g.fillStyle = hex;
  g.fill();
  g.restore();
  const grad = g.createRadialGradient(c - TEX_BR * 0.34, c - TEX_BR * 0.42, TEX_BR * 0.04, c, c, TEX_BR * 1.06);
  grad.addColorStop(0, "rgba(255,255,255,.86)");
  grad.addColorStop(0.18, "rgba(255,255,255,.32)");
  grad.addColorStop(0.55, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(23,43,97,.3)");
  g.beginPath();
  g.arc(c, c, TEX_BR, 0, Math.PI * 2);
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = "rgba(255,255,255,.66)";
  g.lineWidth = 1.6;
  g.stroke();
  if (glow) {
    g.save();
    g.shadowColor = hex;
    g.shadowBlur = 18;
    g.beginPath();
    g.arc(c, c, TEX_BR * 0.92, 0, Math.PI * 2);
    g.strokeStyle = "rgba(255,255,255,.82)";
    g.stroke();
    g.restore();
  }
  return Texture.from(cv);
}

function pillTopTexture(): Texture {
  const [cv, g] = canvas(36, 36);
  rr(g, 0.5, 0.5, 35, 35, 18);
  g.fillStyle = "#FFFFFF";
  g.fill();
  g.clearRect(0, 18, 36, 18);
  return Texture.from(cv);
}

export class GameTextures {
  readonly bubble: Texture[];
  readonly bubbleGlow: Texture[];
  readonly whiteDot: Texture;
  readonly trajDot: Texture;
  readonly dot: Texture;
  readonly panel: Texture;
  readonly pause: Texture;
  readonly pill: Texture;
  readonly pillTop: Texture;
  readonly card: Texture;
  readonly cardRed: Texture;
  readonly dangerLabel: Texture;
  readonly dim: Texture;
  readonly dimSoft: Texture;

  private constructor() {
    this.bubble = COLORS.map((hex) => bubbleTexture(hex, false));
    this.bubbleGlow = COLORS.map((hex) => bubbleTexture(hex, true));
    this.whiteDot = dotTexture(32, DOT_R);
    this.trajDot = dotTexture(24, TRAJ_R);
    this.dot = roundRectTexture(32, 32, 16, "#FFFFFF");
    this.panel = roundRectTexture(32, 32, 16, "rgba(8,91,142,.24)", { color: "rgba(255,255,255,.42)", width: 1 });
    this.pause = roundRectTexture(80, 32, 16, "rgba(8,91,142,.50)", { color: "rgba(255,255,255,.44)", width: 1 });
    this.pill = roundRectTexture(36, 36, 18, "#FFFFFF");
    this.pillTop = pillTopTexture();
    this.card = roundRectTexture(48, 48, 18, "rgba(15,30,90,.95)", { color: "rgba(100,140,255,.4)", width: 2 });
    this.cardRed = roundRectTexture(48, 48, 18, "rgba(15,30,90,.95)", { color: "rgba(255,80,80,.4)", width: 2 });
    this.dangerLabel = textTexture("DANGER", "900 12px Outfit, sans-serif", "#E95574", 90, 18);
    this.dim = roundRectTexture(8, 8, 0, "rgba(5,12,38,.88)");
    this.dimSoft = roundRectTexture(8, 8, 0, "rgba(5,12,38,.82)");
  }

  static create(): GameTextures {
    return new GameTextures();
  }

  destroy() {
    for (const t of [
      ...this.bubble,
      ...this.bubbleGlow,
      this.whiteDot,
      this.trajDot,
      this.dot,
      this.panel,
      this.pause,
      this.pill,
      this.pillTop,
      this.card,
      this.cardRed,
      this.dangerLabel,
      this.dim,
      this.dimSoft,
    ]) {
      t.destroy(true);
    }
  }
}

function textTexture(text: string, font: string, color: string, w: number, h: number): Texture {
  const [cv, g] = canvas(w, h);
  g.font = font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = color;
  g.fillText(text, w / 2, h / 2);
  return Texture.from(cv);
}

export function makeBackgroundTexture(l: Layout): Texture {
  const [cv, g] = canvas(l.LW, l.LH);
  const sky = g.createLinearGradient(0, 0, 0, l.LH);
  sky.addColorStop(0, "#70D9F5");
  sky.addColorStop(0.5, "#78CDEF");
  sky.addColorStop(1, "#BFE9E2");
  g.fillStyle = sky;
  g.fillRect(0, 0, l.LW, l.LH);
  g.globalAlpha = 0.28;
  g.fillStyle = "#4C9EB6";
  g.beginPath();
  g.moveTo(0, 270);
  g.quadraticCurveTo(95, 210, 188, 260);
  g.quadraticCurveTo(292, 190, 378, 258);
  g.quadraticCurveTo(470, 205, l.LW, 256);
  g.lineTo(l.LW, 445);
  g.lineTo(0, 445);
  g.closePath();
  g.fill();
  g.globalAlpha = 0.2;
  g.fillStyle = "#238BAE";
  g.beginPath();
  g.moveTo(0, 330);
  g.quadraticCurveTo(130, 254, 252, 340);
  g.quadraticCurveTo(380, 270, l.LW, 326);
  g.lineTo(l.LW, 490);
  g.lineTo(0, 490);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;
  const water = g.createLinearGradient(0, 585, 0, l.LH);
  water.addColorStop(0, "rgba(255,255,255,.3)");
  water.addColorStop(1, "rgba(20,151,192,.14)");
  g.fillStyle = water;
  g.fillRect(0, 565, l.LW, l.LH - 565);
  const lane = g.createLinearGradient(0, l.BOARD_TOP, 0, l.SHOOTER_Y + 54);
  lane.addColorStop(0, "rgba(255,255,255,.10)");
  lane.addColorStop(0.58, "rgba(255,255,255,.025)");
  lane.addColorStop(1, "rgba(255,255,255,.10)");
  g.fillStyle = lane;
  g.fillRect(0, l.BOARD_TOP - 16, l.LW, l.SHOOTER_Y - l.BOARD_TOP + 76);

  const sx = l.SHOOTER_X;
  const sy = l.SHOOTER_Y;
  g.save();
  g.shadowColor = "rgba(16,83,133,.48)";
  g.shadowBlur = 20;
  g.fillStyle = "rgba(9,79,133,.82)";
  rr(g, sx - 52, sy - 13, 104, 46, 23);
  g.fill();
  g.restore();
  g.fillStyle = "rgba(255,255,255,.30)";
  rr(g, sx - 43, sy - 8, 86, 13, 7);
  g.fill();
  g.fillStyle = "#176FA4";
  g.beginPath();
  g.ellipse(sx, sy + 27, 68, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(255,255,255,.38)";
  g.beginPath();
  g.ellipse(sx, sy + 22, 50, 6, 0, 0, Math.PI * 2);
  g.fill();
  return Texture.from(cv);
}

export function makeDangerLineTexture(l: Layout, near: boolean): Texture {
  const w = l.COLS * l.R * 2 + 4;
  const [cv, g] = canvas(w, 24);
  g.strokeStyle = "rgba(255,75,107,1)";
  g.lineWidth = near ? 4 : 3;
  g.shadowColor = "#FF4D6D";
  g.shadowBlur = near ? 20 : 8;
  g.setLineDash([16, 9]);
  g.beginPath();
  g.moveTo(2, 12);
  g.lineTo(w - 2, 12);
  g.stroke();
  return Texture.from(cv);
}