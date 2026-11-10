import React from 'react';
import type { CategoryState, ClueState } from '../types/game';

interface GameBoardProps {
  categories: CategoryState[];
  onSelectClue: (clue: ClueState, categoryTitle: string) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  categories,
  onSelectClue,
}) => {
  return (
    <div className="board-container">
      {/* Row 1: 6 Category Headers */}
      {categories.map((cat, catIdx) => {
        const displayTitle = cat.category.trim();
        return (
          <div key={`cat-${catIdx}`} className="category-cell">
            {displayTitle ? (
              displayTitle
            ) : (
              <span className="category-placeholder">
                CATEGORY {catIdx + 1}
              </span>
            )}
          </div>
        );
      })}

      {/* Rows 2-6: 5 Dollar Value Rows across the 6 Categories */}
      {[0, 1, 2, 3, 4].map((questionIdx) =>
        categories.map((cat, catIdx) => {
          const clue = cat.clues[questionIdx];
          if (!clue) return null;
          const catTitle =
            cat.category.trim() || `CATEGORY ${catIdx + 1}`;
          return (
            <button
              key={clue.id}
              type="button"
              className={`clue-cell ${clue.completed ? 'completed' : ''}`}
              onClick={() => onSelectClue(clue, catTitle)}
              aria-label={
                clue.completed
                  ? `Completed clue ${catTitle} for $${clue.value} (click to review)`
                  : `${catTitle} for $${clue.value}`
              }
            >
              <span className="clue-dollar">${clue.value}</span>
            </button>
          );
        })
      )}
    </div>
  );
};
