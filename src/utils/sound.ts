/**
 * Plays a classic Jeopardy-style triple-beep "Time's Up" chime using the Web Audio API.
 * Safe to call in any environment (no-ops if Web Audio API is unavailable).
 */
export function playTimesUpChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Three rapid descending/urgent chimes ("beep-beep-beep")
    const pulseTimes = [0, 0.16, 0.32];
    for (const offset of pulseTimes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(587.33, now + offset); // D5
      osc.frequency.exponentialRampToValueAtTime(440, now + offset + 0.11); // A4

      gain.gain.setValueAtTime(0.001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.28, now + offset + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.13);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + offset);
      osc.stop(now + offset + 0.14);
    }

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 800);
  } catch {
    // Ignore audio context restrictions if user hasn't interacted yet
  }
}
