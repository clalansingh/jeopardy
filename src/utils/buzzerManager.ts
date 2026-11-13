import type { BuzzEntry, BuzzerSessionState } from '../types/game';

export interface ContestantInfo {
  id: string;
  name: string;
  score: number;
}

/**
 * Generates a deterministic, URL-safe PeerJS host ID from the session password
 * so players only need to know the session password to connect to the host over WebRTC.
 */
export function deriveHostPeerId(password: string): string {
  const clean = password.trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const slug = clean.replace(/[^a-z0-9]/g, '').slice(0, 16) || 'room';
  return `jeopardy-host-${slug}-${hex}`;
}

export class BuzzerManager {
  private password = '';
  private hasSession = false;
  private contestants: Map<string, ContestantInfo> = new Map();
  private connectedCount: Map<string, number> = new Map();
  private buzzerOpen = false;
  private activeClueLabel: string | null = null;
  private buzzOrder: BuzzEntry[] = [];
  private lockedOutIds: Set<string> = new Set();

  public initSession(password: string, contestants: ContestantInfo[]): void {
    this.password = password.trim();
    this.hasSession = true;
    this.contestants.clear();
    for (const c of contestants) {
      this.contestants.set(c.id, { ...c });
    }
    this.buzzerOpen = false;
    this.activeClueLabel = null;
    this.buzzOrder = [];
    this.lockedOutIds.clear();
  }

  public syncContestants(contestants: ContestantInfo[]): void {
    for (const c of contestants) {
      this.contestants.set(c.id, { ...c });
    }
  }

  public verifyPassword(passwordAttempt: string): boolean {
    if (!this.hasSession) return false;
    if (this.password && passwordAttempt.trim() !== this.password) {
      return false;
    }
    return true;
  }

  public verifyJoin(
    contestantId: string,
    passwordAttempt: string
  ): { ok: true; contestant: ContestantInfo } | { ok: false; error: string } {
    if (!this.hasSession) {
      return { ok: false, error: 'Host has not started a game session yet.' };
    }
    if (!this.verifyPassword(passwordAttempt)) {
      return { ok: false, error: 'Incorrect session password.' };
    }
    const contestant = this.contestants.get(contestantId);
    if (!contestant) {
      return { ok: false, error: 'Please select a valid contestant.' };
    }
    return { ok: true, contestant };
  }

  public setContestantConnected(contestantId: string, connected: boolean): void {
    const current = this.connectedCount.get(contestantId) ?? 0;
    if (connected) {
      this.connectedCount.set(contestantId, current + 1);
    } else {
      this.connectedCount.set(contestantId, Math.max(0, current - 1));
    }
  }

  public openBuzzers(
    clueLabel: string | null = null,
    lockedOutContestantIds: string[] = []
  ): void {
    this.lockedOutIds = new Set(lockedOutContestantIds);
    this.buzzOrder = [];
    if (clueLabel !== null) {
      this.activeClueLabel = clueLabel;
    }
    // Only open if there is at least one contestant not locked out
    const eligibleCount = Array.from(this.contestants.keys()).filter(
      (id) => !this.lockedOutIds.has(id)
    ).length;
    this.buzzerOpen = eligibleCount > 0;
  }

  public lockBuzzers(clearQueue = true): void {
    this.buzzerOpen = false;
    if (clearQueue) {
      this.buzzOrder = [];
      this.lockedOutIds.clear();
      this.activeClueLabel = null;
    }
  }

  public recordBuzz(
    contestantId: string,
    nowMs: number = performance.now()
  ): boolean {
    if (!this.buzzerOpen) return false;
    if (this.lockedOutIds.has(contestantId)) return false;
    const contestant = this.contestants.get(contestantId);
    if (!contestant) return false;
    if (this.buzzOrder.some((b) => b.contestantId === contestantId)) {
      return false;
    }
    const firstTimestamp =
      this.buzzOrder.length > 0 ? this.buzzOrder[0].timestamp : nowMs;
    const deltaMs = Math.max(0, Math.round(nowMs - firstTimestamp));
    this.buzzOrder.push({
      contestantId,
      contestantName: contestant.name,
      timestamp: nowMs,
      deltaMs,
    });
    // Lock buzzers immediately once someone buzzes in so they can answer
    this.buzzerOpen = false;
    return true;
  }

  public getState(): BuzzerSessionState {
    return {
      hasSession: this.hasSession,
      contestants: Array.from(this.contestants.values()).map((c) => ({
        ...c,
        connected: (this.connectedCount.get(c.id) ?? 0) > 0,
      })),
      buzzerOpen: this.buzzerOpen,
      activeClueLabel: this.activeClueLabel,
      buzzOrder: [...this.buzzOrder],
      lockedOutContestantIds: Array.from(this.lockedOutIds),
    };
  }
}
