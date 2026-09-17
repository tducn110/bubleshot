/**
 * The single Wink adapter for this game.
 */

export interface WinkRound {
  readonly roundId: string;
  readonly startedAtMs: number;
}

export interface WinkLifecycleHandlers {
  onPause?: () => void;
  onResume?: () => void;
  onMute?: () => void;
  onUnmute?: () => void;
}

export interface LeaderboardEntry {
  id: string;
  userId: string | null;
  isAnonymous: boolean;
  displayName: string | null;
  score: number;
  playTime: number | null;
  rank: number;
  createdAt: string | null;
}

export interface SubmitScoreInput {
  score: number;
  playTime?: number;
  gameMode?: string;
  counter?: number;
  metadata?: Record<string, unknown>;
}

export interface SubmitScoreResponse {
  entry: LeaderboardEntry | null;
  isNewBest: boolean;
  previousBest: number | null;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total?: number;
  me?: LeaderboardEntry | null;
}

export interface CompletionInput {
  roundId: string;
  playDurationMs: number;
  [key: string]: unknown;
}

export interface WinkBridgeCapabilities {
  getLeaderboard: boolean;
  submitScore: boolean;
  complete: boolean;
  track?: boolean;
}

export interface WinkBridgeState {
  phase: string;
  gameId: string | null;
  environment: 'dev' | 'prod' | null;
  sessionId: string | null;
  identityType: 'anonymous' | 'user' | null;
  displayName: string | null;
  capabilities: WinkBridgeCapabilities;
  expiresAt: string | null;
  lifecycle: {
    paused: boolean;
    muted: boolean;
  };
  error: any | null;
}

declare global {
  interface Window {
    Wink?: any;
    WinkBridge?: any;
  }
}

const DENIED: WinkBridgeCapabilities = Object.freeze({
  getLeaderboard: false,
  submitScore: false,
  complete: false,
});

function newRoundId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  const random = Math.random().toString(16).slice(2, 10);
  return `round-${Date.now().toString(16)}-${random}`;
}

let globalInitPromise: Promise<any> | null = null;
let globalReadyPromise: Promise<void> | null = null;

function getWinkInitPromise(): Promise<any> {
  if (!globalInitPromise) {
    globalInitPromise = Promise.resolve().then(() => {
      if (typeof window !== 'undefined' && (window as any).Wink && typeof (window as any).Wink.init === 'function') {
        return (window as any).Wink.init().then(() => (window as any).Wink);
      }
      return (window as any).Wink;
    });
    globalReadyPromise = globalInitPromise.then(() => undefined).catch(() => undefined);
  }
  return globalInitPromise;
}

export class WinkGameIntegration {
  #completedRounds = new Set<string>();
  #disposers: Array<() => void> = [];

  readonly readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = getWinkInitPromise().then(() => undefined).catch(() => undefined);
  }

  startRound(): WinkRound {
    if (typeof window !== 'undefined' && (window as any).Wink && typeof (window as any).Wink.gameplayStart === 'function') {
      try { (window as any).Wink.gameplayStart(); } catch {}
    }
    return Object.freeze({
      roundId: newRoundId(),
      startedAtMs: Date.now(),
    });
  }

  track(eventName: string, properties?: Record<string, unknown>): void {
    if (typeof window !== 'undefined' && (window as any).Wink && typeof (window as any).Wink.track === 'function') {
      if ((window as any).Wink.can && (window as any).Wink.can('track')) {
        (window as any).Wink.track(eventName, properties).catch(() => {});
      }
    }
  }

  completeRound(
    round: WinkRound,
    extra: Omit<CompletionInput, 'roundId' | 'playDurationMs'> & {
      playDurationMs?: number;
    } = {},
  ): boolean {
    if (this.#completedRounds.has(round.roundId)) {
      return false;
    }
    this.#completedRounds.add(round.roundId);

    const { playDurationMs, ...rest } = extra;
    const duration = Math.max(0, Math.round(playDurationMs ?? Date.now() - round.startedAtMs));

    if (typeof window !== 'undefined' && (window as any).Wink) {
      if (typeof (window as any).Wink.gameplayStop === 'function') {
        (window as any).Wink.gameplayStop();
      } else if (typeof (window as any).Wink.complete === 'function') {
        (window as any).Wink.complete({
          roundId: round.roundId,
          playDurationMs: duration,
          ...rest,
        });
      }
    }
    return true;
  }

  lastSubmittedEntryId: string | null = null;

  async submitFinalScore(input: SubmitScoreInput): Promise<SubmitScoreResponse> {
    if (typeof window === 'undefined' || !(window as any).Wink || typeof (window as any).Wink.submitScore !== 'function') {
      return { entry: null, isNewBest: false, previousBest: null };
    }
    if ((window as any).Wink.can && !(window as any).Wink.can('submitScore')) {
      throw new Error("CAPABILITY_DENIED");
    }
    const res = await (window as any).Wink.submitScore(input);
    if (res && res.entry) {
      this.lastSubmittedEntryId = res.entry.id;
    }
    return res || { entry: null, isNewBest: false, previousBest: null };
  }

  async getPersonalBest(): Promise<LeaderboardEntry | null> {
    if (typeof window === 'undefined' || !(window as any).Wink || typeof (window as any).Wink.getPersonalBest !== 'function') {
      return null;
    }
    const res = await (window as any).Wink.getPersonalBest();
    return res?.me ?? null;
  }

  async refreshLeaderboard(
    options?: { limit?: number; offset?: number }
  ): Promise<LeaderboardResponse> {
    if (typeof window === 'undefined' || !(window as any).Wink || typeof (window as any).Wink.getLeaderboard !== 'function') {
      return { entries: [], total: 0, me: null };
    }
    return (window as any).Wink.getLeaderboard(options);
  }

  get capabilities(): WinkBridgeCapabilities {
    if (typeof window !== 'undefined' && (window as any).Wink && typeof (window as any).Wink.can === 'function') {
      return {
        getLeaderboard: (window as any).Wink.can('getLeaderboard'),
        submitScore: (window as any).Wink.can('submitScore'),
        complete: true,
        track: (window as any).Wink.can('track'),
      };
    }
    return DENIED;
  }

  get state(): WinkBridgeState | null {
    return null;
  }

  get displayName(): string | null {
    if (typeof window !== 'undefined' && (window as any).Wink && (window as any).Wink.player) {
      return (window as any).Wink.player.displayName ?? null;
    }
    return null;
  }

  get canSubmitScore(): boolean {
    return this.capabilities.submitScore === true;
  }

  observe(listener: (state: WinkBridgeState) => void): () => void {
    return () => {};
  }

  bindLifecycle(handlers: WinkLifecycleHandlers): () => void {
    const stops: Array<() => void> = [];
    if (typeof window !== 'undefined' && (window as any).Wink && typeof (window as any).Wink.on === 'function') {
      if (handlers.onPause) stops.push((window as any).Wink.on('pause', handlers.onPause));
      if (handlers.onResume) stops.push((window as any).Wink.on('resume', handlers.onResume));
      if (handlers.onMute) stops.push((window as any).Wink.on('mute', handlers.onMute));
      if (handlers.onUnmute) stops.push((window as any).Wink.on('unmute', handlers.onUnmute));
    }
    
    const stopAll = () => stops.forEach((stop) => stop());
    this.#disposers.push(stopAll);
    return stopAll;
  }

  dispose(): void {
    this.#disposers.forEach((stop) => stop());
    this.#disposers = [];
    this.#completedRounds.clear();
  }
}

export const winkGame = new WinkGameIntegration();

if (typeof window !== 'undefined') {
  (window as any).winkGame = winkGame;
}
