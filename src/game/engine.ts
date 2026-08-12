import {
  COLORS,
  MATCH_MIN,
  PTS_DROP,
  PTS_POP,
  SPEED,
  rndColor,
  stageParams,
} from "./config";
import { Board } from "./board";
import { Fx } from "./fx";
import { Layout } from "./layout";
import type { GridPos, Phase, Point, Shot } from "./types";

export class BubbleShooterEngine {
  readonly layout = new Layout(560, 800);
  readonly board = new Board(this.layout);
  readonly fx = new Fx();

  phase: Phase = "READY";
  cur = 0;
  nxt = 0;
  score = 0;
  combo = 0;
  moves = 0;
  stage = 1;
  starsEarned = 0;
  rowRemaining = 0;
  rowEvery = 4;
  shot: Shot | null = null;
  traj: Point[] = [];

  sc = 1;
  ox = 0;
  oy = 0;

  private cv: HTMLCanvasElement;
  private plx = this.layout.SHOOTER_X;
  private ply = this.layout.SHOOTER_Y - 100;
  private pp: Phase = "READY";
  private rt = 0;
  private colorsInPlay = 5;
  private uiEat = false;

  private _pm: (e: PointerEvent) => void;
  private _pd: (e: PointerEvent) => void;
  private _kd: (e: KeyboardEvent) => void;
  private _rs: () => void;

  constructor(cv: HTMLCanvasElement) {
    this.cv = cv;
    this._pm = (e) => this.onMove(e);
    this._pd = (e) => this.onDown(e);
    this._kd = (e) => this.onKey(e);
    this._rs = () => this.computeTransform();
    cv.addEventListener("pointermove", this._pm);
    cv.addEventListener("pointerdown", this._pd, { passive: false });
    window.addEventListener("keydown", this._kd);
    window.addEventListener("resize", this._rs);
    this.computeTransform();
    this.init();
  }

  destroy() {
    this.cv.removeEventListener("pointermove", this._pm);
    this.cv.removeEventListener("pointerdown", this._pd);
    window.removeEventListener("keydown", this._kd);
    window.removeEventListener("resize", this._rs);
  }

  /**
   * Marks the next native pointerdown as consumed by Pixi UI (pause pill).
   * Pixi's canvas listener is registered before this engine's, so the pill's
   * federated pointerdown handler runs first and sets this flag.
   */
  consumeNextDown() {
    this.uiEat = true;
  }

  /** Per-frame logic step; driven by the renderer's ticker. */
  tick(dt: number) {
    this.computeTransform();
    this.update(dt);
  }

  // ─── Layout / input mapping ────────────────────────────────────────────────

  private computeTransform() {
    const w = this.cv.clientWidth;
    const h = this.cv.clientHeight;
    this.layout.configure(w, h);
    this.sc = Math.min(w / this.layout.LW, h / this.layout.LH);
    this.ox = (w - this.layout.LW * this.sc) / 2;
    this.oy = (h - this.layout.LH * this.sc) / 2;
  }

  private sToL(sx: number, sy: number) {
    const rect = this.cv.getBoundingClientRect();
    return {
      x: (sx - rect.left - this.ox) / this.sc,
      y: (sy - rect.top - this.oy) / this.sc,
    };
  }

  // ─── Input ─────────────────────────────────────────────────────────────────
  // Aiming and shooting only. UI hit testing lives in the HUD/overlay layers;
  // this engine never knows pixel coordinates of any button.

  private onMove(e: PointerEvent) {
    const l = this.sToL(e.clientX, e.clientY);
    this.plx = l.x;
    this.ply = l.y;
    if (this.phase === "READY") this.calcTraj();
  }

  private onDown(e: PointerEvent) {
    e.preventDefault();
    if (this.uiEat) {
      this.uiEat = false;
      return;
    }
    const l = this.sToL(e.clientX, e.clientY);
    this.plx = l.x;
    this.ply = l.y;
    if (this.phase === "READY") this.doShoot();
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === "Escape" || e.key === "p" || e.key === "P") this.togglePause();
  }

  togglePause() {
    if (this.phase === "PAUSED") {
      this.resume();
      return;
    }
    if (["READY", "SHOOTING", "RESOLVING", "DROPPING"].includes(this.phase)) {
      this.pp = this.phase;
      this.phase = "PAUSED";
    }
  }

  resume() {
    this.phase = this.pp;
    if (this.phase === "READY") this.calcTraj();
  }

  // ─── Public actions (driven by overlay buttons) ────────────────────────────

  retry() {
    this.init();
  }

  nextStage() {
    this.stage++;
    this.init();
  }

  menu() {
    this.stage = 1;
    this.init();
  }

  // ─── Init ────────────────────────────────────────────────────────────────

  private init() {
    const sp = stageParams(this.stage);
    this.colorsInPlay = sp.colors;
    this.rowEvery = sp.rowEvery;
    this.board.fillInitial(sp.rows, sp.colors);
    this.fx.clear();
    this.score = 0;
    this.combo = 0;
    this.moves = sp.moves;
    this.starsEarned = 0;
    this.rowRemaining = sp.rowEvery;
    this.phase = "READY";
    this.shot = null;
    this.rt = 0;
    this.cur = rndColor(sp.colors);
    this.nxt = rndColor(sp.colors);
    this.calcTraj();
  }

  // ─── Aim / shoot ───────────────────────────────────────────────────────────

  private aimAngle() {
    const { SHOOTER_X, SHOOTER_Y } = this.layout;
    const dx = this.plx - SHOOTER_X;
    const dy = this.ply - SHOOTER_Y;
    if (dy >= -5) return dx >= 0 ? Math.PI * 0.82 : -Math.PI * 0.82;
    const a = Math.atan2(dx, -dy);
    return Math.max(-Math.PI * 0.82, Math.min(Math.PI * 0.82, a));
  }

  private doShoot() {
    if (this.ply >= this.layout.SHOOTER_Y - 5) return;
    if (this.moves <= 0) return;
    const a = this.aimAngle();
    this.shot = {
      x: this.layout.SHOOTER_X,
      y: this.layout.SHOOTER_Y,
      vx: Math.sin(a) * SPEED,
      vy: -Math.cos(a) * SPEED,
      c: this.cur,
    };
    this.cur = this.nxt;
    this.nxt = rndColor(this.colorsInPlay);
    this.moves--;
    this.phase = "SHOOTING";
    this.traj = [];
  }

  /**
   * Called exactly once per shot, after the shot fully resolves (hit or miss).
   * Pressure rows must spawn AFTER resolution so the trajectory preview the
   * player just saw still matches the board the projectile flew through.
   */
  private finishShot() {
    this.rowRemaining--;
    if (this.rowRemaining <= 0) {
      this.rowRemaining = this.rowEvery;
      this.board.spawnTopRow(this.colorsInPlay);
      this.fx.shake(0.18);
      this.fx.spawnPopup(this.layout.BOARD_CENTER_X, this.layout.BOARD_TOP + 30, "NEW ROW!", false, "#FF4D6D");
    }
  }

  // ─── Trajectory ──────────────────────────────────────────────────────────

  private calcTraj() {
    const { WALL_L, WALL_R, BOARD_TOP, R, ROW_H, SHOOTER_X, SHOOTER_Y } = this.layout;
    const pts: Point[] = [];
    const a = this.aimAngle();
    let vx = Math.sin(a) * SPEED;
    let vy = -Math.cos(a) * SPEED;
    let x = SHOOTER_X;
    let y = SHOOTER_Y;
    const step = 5;
    let acc = 0;
    const dotEvery = R * 1.6;

    for (let i = 0; i < 2400; i++) {
      const len = Math.hypot(vx, vy);
      x += (vx / len) * step;
      y += (vy / len) * step;
      acc += step;
      if (x < WALL_L) {
        x = WALL_L;
        vx = Math.abs(vx);
      }
      if (x > WALL_R) {
        x = WALL_R;
        vx = -Math.abs(vx);
      }
      if (y <= BOARD_TOP + R) {
        pts.push({ x, y });
        break;
      }
      const nr = Math.floor((y - BOARD_TOP - R) / ROW_H);
      let hit = false;
      for (let row = Math.max(0, nr - 1); row <= Math.min((this.board.rows.length || 0) - 1, nr + 2); row++) {
        for (let col = 0; col < this.layout.COLS; col++) {
          if (this.board.cell(row, col) !== null) {
            const wp = this.layout.gToW(row, col);
            if (Math.hypot(x - wp.x, y - wp.y) < R * 1.95) {
              hit = true;
              break;
            }
          }
        }
        if (hit) break;
      }
      if (hit) {
        pts.push({ x, y });
        break;
      }
      if (acc >= dotEvery) {
        pts.push({ x, y });
        acc = 0;
        if (pts.length >= 38) break;
      }
    }
    this.traj = pts;
  }

  // ─── Ball flight ─────────────────────────────────────────────────────────

  private updateShooting(dt: number) {
    if (!this.shot) return;
    const { WALL_L, WALL_R, BOARD_TOP, R, ROW_H } = this.layout;
    const s = this.shot;
    const sub = 4;
    const sdt = dt / sub;
    let placed = false;

    for (let i = 0; i < sub && !placed; i++) {
      s.x += s.vx * sdt;
      s.y += s.vy * sdt;
      if (s.x < WALL_L) {
        s.x = WALL_L;
        s.vx = Math.abs(s.vx);
      }
      if (s.x > WALL_R) {
        s.x = WALL_R;
        s.vx = -Math.abs(s.vx);
      }
      if (s.y - R <= BOARD_TOP) {
        s.y = BOARD_TOP + R;
        const snap = this.findSnap(s.x, s.y, -1, -1);
        if (snap) {
          this.place(snap.row, snap.col, s.c);
          placed = true;
        } else {
          this.shot = null;
          this.finishShot();
          this.phase = "READY";
          this.calcTraj();
          return;
        }
        break;
      }
      const nr = Math.floor((s.y - BOARD_TOP - R) / ROW_H);
      for (let row = Math.max(0, nr - 1); row <= Math.min((this.board.rows.length || 0) - 1, nr + 2) && !placed; row++) {
        for (let col = 0; col < this.layout.COLS && !placed; col++) {
          if (this.board.cell(row, col) !== null) {
            const wp = this.layout.gToW(row, col);
            if (Math.hypot(s.x - wp.x, s.y - wp.y) < R * 1.95) {
              const snap = this.findSnap(s.x, s.y, row, col);
              if (snap) {
                this.place(snap.row, snap.col, s.c);
                placed = true;
              } else {
                this.shot = null;
                this.finishShot();
                this.phase = "READY";
                this.calcTraj();
                return;
              }
            }
          }
        }
      }
    }
    if (placed) this.shot = null;
  }

  private findSnap(bx: number, by: number, hr: number, hc: number): GridPos | null {
    const { MAX_ROWS, COLS, ROW_H, R } = this.layout;
    const cands: GridPos[] = [];
    if (hr >= 0) cands.push(...this.layout.nbrs(hr, hc));
    const est = this.layout.wToG(bx, by);
    cands.push(est, ...this.layout.nbrs(est.row, est.col));
    if (est.row > 0) {
      const above = this.layout.wToG(bx, by - ROW_H);
      cands.push(above, ...this.layout.nbrs(above.row, above.col));
    }
    const seen = new Set<string>();
    const valid = cands.filter((p) => {
      const k = `${p.row},${p.col}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return p.row >= 0 && p.row < MAX_ROWS && p.col >= 0 && p.col < COLS && this.board.cell(p.row, p.col) === null;
    });
    if (!valid.length) return null;
    valid.sort((a, b) => {
      const wa = this.layout.gToW(a.row, a.col);
      const wb = this.layout.gToW(b.row, b.col);
      return Math.hypot(bx - wa.x, by - wa.y) - Math.hypot(bx - wb.x, by - wb.y);
    });
    return valid[0];
  }

  // ─── Place & match ───────────────────────────────────────────────────────

  private place(row: number, col: number, c: number) {
    this.board.set(row, col, c);
    this.fx.newBubble = { row, col, t: 0 };
    const wp = this.layout.gToW(row, col);
    this.fx.spawnImpact(wp.x, wp.y, COLORS[c]);
    const matched = this.board.bfsColor(row, col, c);

    if (matched.length >= MATCH_MIN) {
      this.combo++;
      const pts = matched.length * PTS_POP;
      this.score += pts;

      const label = matched.length >= 8 ? "AMAZING!" : matched.length >= 5 ? "AWESOME!" : "";
      if (label) this.fx.spawnPopup(this.layout.SHOOTER_X, this.layout.LH * 0.42, label, true, "#FFE04B");
      this.fx.spawnPopup(wp.x, wp.y - 24, `+${pts}`, false, "#FFE04B");

      matched.forEach((p) => {
        const mw = this.layout.gToW(p.row, p.col);
        this.fx.pops.push({ c: this.board.cell(p.row, p.col)!, x: mw.x, y: mw.y, scale: 1, alpha: 1, t: 0 });
        // Emit particles exactly once per popped bubble (not per frame).
        this.fx.spawnPop(mw.x, mw.y, COLORS[this.board.cell(p.row, p.col)!]);
        this.board.set(p.row, p.col, null);
      });

      if (this.combo > 1) {
        this.fx.markCombo(this.combo, wp.x, wp.y - 70);
      }
      this.rt = 0;
      this.phase = "RESOLVING";
    } else {
      this.combo = 0;
      this.finishShot();
      this.phase = "READY";
      this.calcTraj();
      this.checkEnd();
    }
  }

  private updateResolving(dt: number) {
    const DUR = 0.38;
    this.rt += dt;
    for (const b of this.fx.pops) {
      b.t += dt / DUR;
      if (b.t < 0.28) {
        b.scale = 1 + b.t * 1.6;
        b.alpha = 1;
      } else {
        b.scale = Math.max(0.01, 1.45 - (b.t - 0.28) * 2.0);
        b.alpha = Math.max(0, 1 - (b.t - 0.28) * 3.2);
      }
    }
    if (this.rt >= DUR) {
      this.fx.pops = [];
      const floating = this.board.findFloating();
      if (floating.length) {
        const pts = floating.length * PTS_DROP;
        this.score += pts;
        floating.forEach((p) => {
          const wp = this.layout.gToW(p.row, p.col);
          const c = this.board.cell(p.row, p.col)!;
          this.fx.drops.push({
            c,
            x: wp.x,
            y: wp.y,
            vx: (Math.random() - 0.5) * 90,
            vy: -90 + Math.random() * 50,
            alpha: 1,
          });
          this.board.set(p.row, p.col, null);
        });
        if (floating.length >= 4) {
          this.fx.spawnPopup(this.layout.SHOOTER_X, this.layout.DANGER_Y - 60, `+${pts} DROP!`, false, "#C77DFF");
        }
        this.fx.shake(0.32);
        this.phase = "DROPPING";
      } else {
        this.finishShot();
        this.phase = "READY";
        this.calcTraj();
        this.checkEnd();
      }
    }
  }

  private updateDropping(dt: number) {
    const G = 780;
    for (const b of this.fx.drops) {
      b.vy += G * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.alpha = Math.max(0, b.alpha - dt * 1.4);
    }
    this.fx.drops = this.fx.drops.filter((b) => b.alpha > 0 && b.y < this.layout.LH + 80);
    if (!this.fx.drops.length) {
      this.finishShot();
      this.phase = "READY";
      this.calcTraj();
      this.checkEnd();
    }
  }

  private checkEnd() {
    const { DANGER_Y, R } = this.layout;
    for (let r = 0; r < this.board.rows.length; r++) {
      for (let col = 0; col < this.layout.COLS; col++) {
        if (this.board.cell(r, col) !== null) {
          const { y } = this.layout.gToW(r, col);
          if (y + R >= DANGER_Y) {
            this.phase = "LOSE";
            return;
          }
        }
      }
    }
    if (this.board.isClear()) {
      this.starsEarned = this.moves >= 15 ? 3 : this.moves >= 8 ? 2 : 1;
      this.phase = "WIN";
      this.fx.shake(0.7);
      return;
    }
    if (this.moves <= 0) this.phase = "LOSE";
  }

  // ─── Main loop ───────────────────────────────────────────────────────────

  private update(dt: number) {
    // Pause freezes the gameplay clock AND gameplay FX; overlay UI is static.
    if (this.phase !== "PAUSED") {
      this.fx.step(dt);
      if (this.phase === "SHOOTING") this.updateShooting(dt);
      else if (this.phase === "RESOLVING") this.updateResolving(dt);
      else if (this.phase === "DROPPING") this.updateDropping(dt);
    }
  }
}
