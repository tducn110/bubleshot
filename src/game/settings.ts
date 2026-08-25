export interface GameSettingsSnapshot {
  readonly bgmEnabled: boolean
  readonly sfxEnabled: boolean
  readonly hapticsEnabled: boolean
}

export type GameSettingKey = keyof GameSettingsSnapshot

const STORAGE_KEY = "bubbleShooter.settings"

const DEFAULT_SETTINGS: GameSettingsSnapshot = {
  bgmEnabled: true,
  sfxEnabled: true,
  hapticsEnabled: true,
}

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

function loadSettings(storage: Storage | undefined): GameSettingsSnapshot {
  if (!storage) return DEFAULT_SETTINGS
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const value = JSON.parse(raw) as Partial<GameSettingsSnapshot>
    return {
      bgmEnabled: value.bgmEnabled !== false,
      sfxEnabled: value.sfxEnabled !== false,
      hapticsEnabled: value.hapticsEnabled !== false,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export class GameSettingsStore {
  private snapshot: GameSettingsSnapshot
  private gameplayPaused = false

  constructor(
    private readonly storage: Storage | undefined = getBrowserStorage(),
  ) {
    this.snapshot = loadSettings(storage)
  }

  get value(): GameSettingsSnapshot {
    return this.snapshot
  }

  set(key: GameSettingKey, enabled: boolean) {
    if (this.snapshot[key] === enabled) return
    this.snapshot = { ...this.snapshot, [key]: enabled }
    this.persist()
  }

  toggle(key: GameSettingKey) {
    this.set(key, !this.snapshot[key])
  }

  setGameplayPaused(paused: boolean) {
    this.gameplayPaused = paused
  }

  get bgmShouldPlay() {
    return this.snapshot.bgmEnabled && !this.gameplayPaused
  }

  triggerHaptics(pattern: number | number[] = 10) {
    if (!this.snapshot.hapticsEnabled) return
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return
    try {
      navigator.vibrate(pattern)
    } catch {
      // Vibration is an optional capability and may be blocked by the browser.
    }
  }

  private persist() {
    if (!this.storage) return
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot))
    } catch {
      // Settings remain usable when storage is unavailable or restricted.
    }
  }
}
