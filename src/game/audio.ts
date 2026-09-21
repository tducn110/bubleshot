/**
 * Procedural Web Audio synthesizer for Bubble Shooter.
 * Zero asset dependencies, instant load, works offline, supports SFX and ambient BGM.
 */

class SoundSystem {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private bgmGain: GainNode | null = null
  private sfxEnabled = true
  private bgmEnabled = true
  private parentMuted = false
  private bgmTimer: number | null = null
  private unlocked = false

  constructor() {
    if (typeof window !== "undefined") {
      const unlockHandler = () => this.unlock()
      window.addEventListener("pointerdown", unlockHandler, {
        once: true,
        passive: true,
      })
      window.addEventListener("touchstart", unlockHandler, {
        once: true,
        passive: true,
      })
      window.addEventListener("keydown", unlockHandler, {
        once: true,
        passive: true,
      })

      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          if (this.ctx && this.ctx.state === "running") {
            this.ctx.suspend().catch(() => {})
          }
        } else {
          if (this.unlocked && this.ctx && this.ctx.state === "suspended") {
            this.ctx.resume().catch(() => {})
          }
        }
      })
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (AudioContextClass) {
        this.ctx = new AudioContextClass()
        this.masterGain = this.ctx.createGain()
        this.sfxGain = this.ctx.createGain()
        this.bgmGain = this.ctx.createGain()

        this.sfxGain.connect(this.masterGain)
        this.bgmGain.connect(this.masterGain)
        this.masterGain.connect(this.ctx.destination)

        this.updateGainLevels()
      }
    }
    if (
      this.ctx &&
      this.ctx.state === "suspended" &&
      this.unlocked &&
      typeof document !== "undefined" &&
      !document.hidden
    ) {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  private updateGainLevels() {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.parentMuted ? 0 : 1, now)
    }
    if (this.sfxGain) {
      this.sfxGain.gain.setValueAtTime(this.sfxEnabled ? 1 : 0, now)
    }
    if (this.bgmGain) {
      this.bgmGain.gain.setValueAtTime(this.bgmEnabled ? 1 : 0, now)
    }
  }

  /** Unlocks AudioContext on user interaction (pointerdown/click/touchstart) */
  unlock() {
    if (this.unlocked) return
    this.unlocked = true
    const ctx = this.ensureContext()
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {})
    }
    if (this.bgmEnabled && !this.parentMuted) {
      this.startBgm()
    }
  }

  setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled
    this.updateGainLevels()
  }

  setBgmEnabled(enabled: boolean) {
    this.bgmEnabled = enabled
    this.updateGainLevels()
    if (enabled && !this.parentMuted && this.unlocked) {
      this.startBgm()
    } else {
      this.stopBgm()
    }
  }

  setParentMuted(muted: boolean) {
    this.parentMuted = muted
    this.updateGainLevels()
    if (muted) {
      this.stopBgm()
    } else if (this.bgmEnabled && this.unlocked) {
      this.startBgm()
    }
  }

  private canPlaySfx(): boolean {
    return this.sfxEnabled && !this.parentMuted
  }

  private getSfxDestination(ctx: AudioContext): AudioNode {
    return this.sfxGain ?? ctx.destination
  }

  private getBgmDestination(ctx: AudioContext): AudioNode {
    return this.bgmGain ?? ctx.destination
  }

  /** Energetic bubble cannon shoot sound */
  playShoot() {
    if (!this.canPlaySfx()) return
    const ctx = this.ensureContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sine"
    osc.frequency.setValueAtTime(420, now)
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.12)

    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)

    osc.connect(gain)
    gain.connect(this.getSfxDestination(ctx))

    osc.start(now)
    osc.stop(now + 0.15)
  }

  /** Subtle wooden wall bounce sound */
  playBounce() {
    if (!this.canPlaySfx()) return
    const ctx = this.ensureContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "triangle"
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.05)

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)

    osc.connect(gain)
    gain.connect(this.getSfxDestination(ctx))

    osc.start(now)
    osc.stop(now + 0.07)
  }

  /**
   * Musical bubble pop sound with rising pentatonic pitch per combo.
   * Gives the classic arcade gratification!
   */
  playPop(combo = 0) {
    if (!this.canPlaySfx()) return
    const ctx = this.ensureContext()
    if (!ctx) return

    const now = ctx.currentTime
    // Pentatonic scale starting at C5: C, D, E, G, A, C6, D6, E6...
    const notes = [
      523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51,
    ]
    const baseFreq = notes[Math.min(notes.length - 1, combo)]

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sine"
    osc.frequency.setValueAtTime(baseFreq * 0.85, now)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.08)

    gain.gain.setValueAtTime(0.24, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    osc.connect(gain)
    gain.connect(this.getSfxDestination(ctx))

    osc.start(now)
    osc.stop(now + 0.13)
  }

  /** Falling floating bubbles drop sound */
  playDrop() {
    if (!this.canPlaySfx()) return
    const ctx = this.ensureContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sine"
    osc.frequency.setValueAtTime(280, now)
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.22)

    gain.gain.setValueAtTime(0.16, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)

    osc.connect(gain)
    gain.connect(this.getSfxDestination(ctx))

    osc.start(now)
    osc.stop(now + 0.25)
  }

  /**
   * Authentic bubble bounce sfx when dropped bubbles bounce on the bounce line (bubbo-bubbo style).
   */
  playBubbleBounce(pitchScale = 1.0) {
    if (!this.canPlaySfx()) return
    const ctx = this.ensureContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    const baseFreq = (200 + Math.random() * 50) * pitchScale
    osc.type = "sine"
    osc.frequency.setValueAtTime(baseFreq * 0.85, now)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.035)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, now + 0.11)

    gain.gain.setValueAtTime(0.2, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    osc.connect(gain)
    gain.connect(this.getSfxDestination(ctx))

    osc.start(now)
    osc.stop(now + 0.13)
  }

  /** Swap current and next bubbles */
  playSwap() {
    if (!this.canPlaySfx()) return
    const ctx = this.ensureContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "triangle"
    osc.frequency.setValueAtTime(350, now)
    osc.frequency.exponentialRampToValueAtTime(550, now + 0.08)

    gain.gain.setValueAtTime(0.14, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

    osc.connect(gain)
    gain.connect(this.getSfxDestination(ctx))

    osc.start(now)
    osc.stop(now + 0.11)
  }

  /** Power-up activation sparkling chord */
  playPowerUp() {
    if (!this.canPlaySfx()) return
    const ctx = this.ensureContext()
    if (!ctx) return

    const freqs = [440, 554.37, 659.25, 880]
    const now = ctx.currentTime

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "sine"
      osc.frequency.setValueAtTime(f, now + idx * 0.04)

      gain.gain.setValueAtTime(0.15, now + idx * 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.2)

      osc.connect(gain)
      gain.connect(this.getSfxDestination(ctx))

      osc.start(now + idx * 0.04)
      osc.stop(now + idx * 0.04 + 0.22)
    })
  }

  /** Victory fanfare on stage clear */
  playWin() {
    if (!this.canPlaySfx()) return
    const ctx = this.ensureContext()
    if (!ctx) return

    const now = ctx.currentTime
    const chords = [
      { f: 523.25, t: 0 },
      { f: 659.25, t: 0.1 },
      { f: 783.99, t: 0.2 },
      { f: 1046.5, t: 0.35 },
    ]

    chords.forEach(({ f, t }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "triangle"
      osc.frequency.setValueAtTime(f, now + t)

      gain.gain.setValueAtTime(0.2, now + t)
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.35)

      osc.connect(gain)
      gain.connect(this.getSfxDestination(ctx))

      osc.start(now + t)
      osc.stop(now + t + 0.38)
    })
  }

  /** Game over descending sound */
  playLose() {
    if (!this.canPlaySfx()) return
    const ctx = this.ensureContext()
    if (!ctx) return

    const now = ctx.currentTime
    const notes = [
      { f: 440, t: 0 },
      { f: 392, t: 0.15 },
      { f: 349.23, t: 0.3 },
      { f: 293.66, t: 0.45 },
    ]

    notes.forEach(({ f, t }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = "sine"
      osc.frequency.setValueAtTime(f, now + t)

      gain.gain.setValueAtTime(0.18, now + t)
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.28)

      osc.connect(gain)
      gain.connect(this.getSfxDestination(ctx))

      osc.start(now + t)
      osc.stop(now + t + 0.3)
    })
  }

  /** Procedural pleasant ambient background chord progression */
  startBgm() {
    if (!this.bgmEnabled || this.parentMuted || this.bgmTimer) return
    const ctx = this.ensureContext()
    if (!ctx) return

    // Warm ambient chords: Fmaj7 -> G -> Em -> Am
    const chords = [
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [196.0, 246.94, 293.66, 392.0], // G
      [164.81, 196.0, 246.94, 329.63], // Em
      [220.0, 261.63, 329.63, 440.0], // Am
    ]
    let chordIdx = 0

    const playChordStep = () => {
      if (!this.bgmEnabled || this.parentMuted) return
      const currentCtx = this.ensureContext()
      if (!currentCtx || currentCtx.state !== "running") return

      const chord = chords[chordIdx % chords.length]
      chordIdx++
      const now = currentCtx.currentTime
      const stepDuration = 3.2

      chord.forEach((freq) => {
        const osc = currentCtx.createOscillator()
        const gain = currentCtx.createGain()

        osc.type = "sine"
        osc.frequency.setValueAtTime(freq, now)

        // Soft pad envelope
        gain.gain.setValueAtTime(0.001, now)
        gain.gain.linearRampToValueAtTime(0.018, now + 0.8)
        gain.gain.linearRampToValueAtTime(0.015, now + 2.2)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + stepDuration)

        osc.connect(gain)
        gain.connect(this.getBgmDestination(currentCtx))

        osc.start(now)
        osc.stop(now + stepDuration + 0.1)
      })
    }

    playChordStep()
    this.bgmTimer = window.setInterval(playChordStep, 3000)
  }

  stopBgm() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer)
      this.bgmTimer = null
    }
  }
}

export const gameAudio = new SoundSystem()
