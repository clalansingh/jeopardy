import React from 'react';

interface LandingPageProps {
  hasGameInProgress: boolean;
  onSelectHost: () => void;
  onSelectJoin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  hasGameInProgress,
  onSelectHost,
  onSelectJoin,
}) => {
  return (
    <div className="setup-screen">
      <div
        className="setup-card"
        style={{
          maxWidth: 520,
          textAlign: 'center',
          padding: '44px 36px',
          gap: 28,
        }}
      >
        <h1 className="setup-title" style={{ fontSize: '4rem' }}>
          JEOPARDY!
        </h1>
        <p style={{ color: '#cbd0ff', fontSize: '1.08rem' }}>
          Select your role to begin:
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <button
            type="button"
            className="primary-action-btn"
            style={{ fontSize: '1.25rem', padding: '16px 28px' }}
            onClick={onSelectHost}
          >
            {hasGameInProgress ? 'Host (Game in Progress)' : 'Host'}
          </button>

          <button
            type="button"
            className="secondary-action-btn"
            style={{
              fontSize: '1.25rem',
              padding: '16px 28px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontWeight: 800,
            }}
            onClick={onSelectJoin}
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
};
