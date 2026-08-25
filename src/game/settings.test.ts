import { describe, expect, it } from "vitest"
import { GameSettingsStore } from "./settings"

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length() {
    return this.values.size
  }

  clear() {
    this.values.clear()
  }

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.values.delete(key)
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

describe("GameSettingsStore", () => {
  it("is the single persisted source for all three UI settings", () => {
    const storage = new MemoryStorage()
    const settings = new GameSettingsStore(storage)

    settings.set("bgmEnabled", false)
    settings.set("sfxEnabled", false)
    settings.set("hapticsEnabled", false)

    expect(new GameSettingsStore(storage).value).toEqual({
      bgmEnabled: false,
      sfxEnabled: false,
      hapticsEnabled: false,
    })
  })

  it("pauses BGM policy without changing the player's preference", () => {
    const settings = new GameSettingsStore(new MemoryStorage())

    expect(settings.bgmShouldPlay).toBe(true)
    settings.setGameplayPaused(true)
    expect(settings.bgmShouldPlay).toBe(false)
    expect(settings.value.bgmEnabled).toBe(true)

    settings.setGameplayPaused(false)
    expect(settings.bgmShouldPlay).toBe(true)
  })
})
