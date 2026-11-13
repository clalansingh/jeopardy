import React from 'react';

/**
 * Computes the boolean array of lit (true = red) vs unlit (false = black) segments
 * for a symmetric countdown bar that ticks inward from both sides toward the center.
 * For `totalSeconds` = 5, returns 9 segments (2 * 5 - 1):
 * - 5s left: [true, true, true, true, true, true, true, true, true] (9 red)
 * - 4s left: [false, true, true, true, true, true, true, true, false] (1 black each side, 7 red)
 * - 3s left: [false, false, true, true, true, true, true, false, false] (2 black each side, 5 red - matches podium-countdown.png)
 * - 2s left: 3 black each side, 3 red
 * - 1s left: 4 black each side, 1 center red
 * - 0s left: all 9 black
 */
export function computeCountdownSegments(
  totalSeconds: number,
  remainingSeconds: number
): boolean[] {
  const safeTotal = Math.max(1, Math.floor(totalSeconds));
  const segmentCount = 2 * safeTotal - 1;
  const clampedRemaining = Math.max(
    0,
    Math.min(safeTotal, Math.ceil(remainingSeconds))
  );

  if (clampedRemaining === 0) {
    return Array(segmentCount).fill(false);
  }

  const elapsed = safeTotal - clampedRemaining;
  return Array.from({ length: segmentCount }, (_, idx) => {
    const isLeftDark = idx < elapsed;
    const isRightDark = idx >= segmentCount - elapsed;
    return !isLeftDark && !isRightDark;
  });
}

interface PodiumCountdownProps {
  totalSeconds: number;
  remainingSeconds: number;
  label?: string;
}

export const PodiumCountdown: React.FC<PodiumCountdownProps> = ({
  totalSeconds,
  remainingSeconds,
  label,
}) => {
  const segments = computeCountdownSegments(totalSeconds, remainingSeconds);

  return (
    <div className="podium-countdown-wrapper">
      {label && <div className="podium-countdown-label">{label}</div>}
      <div
        className="podium-countdown-frame"
        role="timer"
        aria-label={
          label
            ? `${label}: ${remainingSeconds} seconds remaining`
            : `${remainingSeconds} seconds remaining`
        }
      >
        {segments.map((isLit, index) => (
          <div
            key={index}
            className={`podium-segment ${isLit ? 'lit' : 'dark'}`}
          />
        ))}
      </div>
    </div>
  );
};
