import { useCallback, useEffect, useRef, useState } from 'react';
import type { BuzzerSessionState, Contestant } from '../types/game';
import { BuzzerManager, deriveHostPeerId } from '../utils/buzzerManager';

interface PeerDataConnection {
  peer: string;
  open: boolean;
  send: (data: unknown) => void;
  close: () => void;
  on: (event: string, cb: (...args: any[]) => void) => void;
}

interface PeerInstance {
  id: string;
  destroyed: boolean;
  connect: (
    peerId: string,
    options?: { reliable?: boolean }
  ) => PeerDataConnection;
  destroy: () => void;
  on: (event: string, cb: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    Peer?: new (id?: string) => PeerInstance;
  }
}

const INITIAL_SESSION_STATE: BuzzerSessionState = {
  hasSession: false,
  contestants: [],
  buzzerOpen: false,
  activeClueLabel: null,
  buzzOrder: [],
  lockedOutContestantIds: [],
};

export function useBuzzerSocket() {
  const managerRef = useRef<BuzzerManager>(new BuzzerManager());
  const hostPeerRef = useRef<PeerInstance | null>(null);
  const hostConnsRef = useRef<Map<PeerDataConnection, string | undefined>>(
    new Map()
  );

  const playerPeerRef = useRef<PeerInstance | null>(null);
  const playerConnRef = useRef<PeerDataConnection | null>(null);
  const playerPasswordRef = useRef<string>('');

  const [sessionState, setSessionState] = useState<BuzzerSessionState>(
    INITIAL_SESSION_STATE
  );
  const [hostPeerStatus, setHostPeerStatus] = useState<
    'idle' | 'connecting' | 'online' | 'error'
  >('idle');

  const [joinStatus, setJoinStatus] = useState<{
    connecting: boolean;
    connectedToHost: boolean;
    joinedContestantId: string | null;
    error: string | null;
  }>({
    connecting: false,
    connectedToHost: false,
    joinedContestantId: null,
    error: null,
  });

  // Clean up PeerJS connections on page unload
  useEffect(() => {
    const cleanup = () => {
      hostPeerRef.current?.destroy();
      playerPeerRef.current?.destroy();
    };
    window.addEventListener('beforeunload', cleanup);
    return () => {
      cleanup();
      window.removeEventListener('beforeunload', cleanup);
    };
  }, []);

  const broadcastFromHost = useCallback(() => {
    const nextState = managerRef.current.getState();
    setSessionState(nextState);
    const payload = {
      type: 'SESSION_STATE',
      state: nextState,
    };
    for (const [conn] of hostConnsRef.current.entries()) {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch {
          // Ignore send errors on closing channels
        }
      }
    }
  }, []);

  const hostInitSession = useCallback(
    (password: string, contestants: Contestant[]) => {
      managerRef.current.initSession(
        password,
        contestants.map((c) => ({
          id: c.id,
          name: c.name,
          score: c.score,
        }))
      );
      setSessionState(managerRef.current.getState());

      // Tear down any existing host peer before starting the new one
      if (hostPeerRef.current) {
        hostPeerRef.current.destroy();
        hostPeerRef.current = null;
      }
      hostConnsRef.current.clear();

      if (!window.Peer) {
        setHostPeerStatus('error');
        return;
      }

      const hostPeerId = deriveHostPeerId(password);
      setHostPeerStatus('connecting');
      const peer = new window.Peer(hostPeerId);
      hostPeerRef.current = peer;

      peer.on('open', () => {
        setHostPeerStatus('online');
      });

      peer.on('error', () => {
        setHostPeerStatus('error');
      });

      peer.on('connection', (conn: PeerDataConnection) => {
        conn.on('data', (raw: any) => {
          const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (!msg || typeof msg.type !== 'string') return;

          switch (msg.type) {
            case 'PLAYER_CONNECT': {
              if (!managerRef.current.verifyPassword(msg.password ?? '')) {
                conn.send({
                  type: 'JOIN_RESULT',
                  ok: false,
                  error: 'Incorrect session password.',
                });
                return;
              }
              hostConnsRef.current.set(conn, undefined);
              conn.send({
                type: 'HOST_CONNECTED',
                state: managerRef.current.getState(),
              });
              break;
            }
            case 'PLAYER_JOIN': {
              const res = managerRef.current.verifyJoin(
                msg.contestantId ?? '',
                msg.password ?? ''
              );
              if (!res.ok) {
                conn.send({
                  type: 'JOIN_RESULT',
                  ok: false,
                  error: res.error,
                });
              } else {
                const prevContestantId = hostConnsRef.current.get(conn);
                if (
                  prevContestantId &&
                  prevContestantId !== msg.contestantId
                ) {
                  managerRef.current.setContestantConnected(
                    prevContestantId,
                    false
                  );
                }
                hostConnsRef.current.set(conn, msg.contestantId);
                managerRef.current.setContestantConnected(
                  msg.contestantId,
                  true
                );
                conn.send({
                  type: 'JOIN_RESULT',
                  ok: true,
                  contestantId: msg.contestantId,
                });
                broadcastFromHost();
              }
              break;
            }
            case 'PLAYER_BUZZ': {
              const cid =
                hostConnsRef.current.get(conn) ?? msg.contestantId ?? '';
              if (cid && managerRef.current.recordBuzz(cid)) {
                broadcastFromHost();
              }
              break;
            }
          }
        });

        const handleDisconnect = () => {
          const cid = hostConnsRef.current.get(conn);
          if (cid) {
            managerRef.current.setContestantConnected(cid, false);
          }
          hostConnsRef.current.delete(conn);
          broadcastFromHost();
        };

        conn.on('close', handleDisconnect);
        conn.on('error', handleDisconnect);
      });
    },
    [broadcastFromHost]
  );

  const hostSyncContestants = useCallback(
    (contestants: Contestant[]) => {
      managerRef.current.syncContestants(
        contestants.map((c) => ({
          id: c.id,
          name: c.name,
          score: c.score,
        }))
      );
      broadcastFromHost();
    },
    [broadcastFromHost]
  );

  const hostOpenBuzzers = useCallback(
    (clueLabel: string | null = null, lockedOutContestantIds: string[] = []) => {
      managerRef.current.openBuzzers(clueLabel, lockedOutContestantIds);
      broadcastFromHost();
    },
    [broadcastFromHost]
  );

  const hostLockBuzzers = useCallback(
    (clearQueue = true) => {
      managerRef.current.lockBuzzers(clearQueue);
      broadcastFromHost();
    },
    [broadcastFromHost]
  );

  /**
   * Step 1 on Player Phone: Connect to the Host's PeerJS session using the session password.
   */
  const playerConnectWithPassword = useCallback((password: string) => {
    if (!window.Peer) {
      setJoinStatus({
        connecting: false,
        connectedToHost: false,
        joinedContestantId: null,
        error: 'PeerJS failed to load. Please check your internet connection.',
      });
      return;
    }

    playerPasswordRef.current = password;
    setJoinStatus({
      connecting: true,
      connectedToHost: false,
      joinedContestantId: null,
      error: null,
    });

    if (playerPeerRef.current) {
      playerPeerRef.current.destroy();
      playerPeerRef.current = null;
    }

    const peer = new window.Peer();
    playerPeerRef.current = peer;
    const hostPeerId = deriveHostPeerId(password);

    peer.on('open', () => {
      const conn = peer.connect(hostPeerId, { reliable: true });
      playerConnRef.current = conn;

      conn.on('open', () => {
        conn.send({
          type: 'PLAYER_CONNECT',
          password,
        });
      });

      conn.on('data', (raw: any) => {
        const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'HOST_CONNECTED' && msg.state) {
          setSessionState(msg.state);
          setJoinStatus({
            connecting: false,
            connectedToHost: true,
            joinedContestantId: null,
            error: null,
          });
        } else if (msg.type === 'SESSION_STATE' && msg.state) {
          setSessionState(msg.state);
        } else if (msg.type === 'JOIN_RESULT') {
          if (msg.ok) {
            setJoinStatus({
              connecting: false,
              connectedToHost: true,
              joinedContestantId: msg.contestantId,
              error: null,
            });
          } else {
            setJoinStatus({
              connecting: false,
              connectedToHost: false,
              joinedContestantId: null,
              error: msg.error ?? 'Failed to join session.',
            });
          }
        }
      });

      conn.on('close', () => {
        setJoinStatus((prev) => ({
          ...prev,
          connecting: false,
          connectedToHost: false,
          joinedContestantId: null,
          error: 'Disconnected from host session.',
        }));
      });
    });

    peer.on('error', () => {
      setJoinStatus({
        connecting: false,
        connectedToHost: false,
        joinedContestantId: null,
        error:
          'Could not find an active game with that password. Make sure the host has started the game.',
      });
    });
  }, []);

  /**
   * Step 2 on Player Phone: Select contestant name after connecting to host.
   */
  const playerJoin = useCallback((contestantId: string) => {
    const conn = playerConnRef.current;
    if (!conn || !conn.open) return;
    conn.send({
      type: 'PLAYER_JOIN',
      contestantId,
      password: playerPasswordRef.current,
    });
  }, []);

  const playerLeave = useCallback(() => {
    setJoinStatus((prev) => ({
      ...prev,
      joinedContestantId: null,
      error: null,
    }));
  }, []);

  const playerDisconnectSession = useCallback(() => {
    playerPeerRef.current?.destroy();
    playerPeerRef.current = null;
    playerConnRef.current = null;
    setJoinStatus({
      connecting: false,
      connectedToHost: false,
      joinedContestantId: null,
      error: null,
    });
  }, []);

  const playerBuzz = useCallback((contestantId: string) => {
    const conn = playerConnRef.current;
    if (conn && conn.open) {
      conn.send({
        type: 'PLAYER_BUZZ',
        contestantId,
      });
    }
  }, []);

  return {
    sessionState,
    hostPeerStatus,
    joinStatus,
    hostInitSession,
    hostSyncContestants,
    hostOpenBuzzers,
    hostLockBuzzers,
    playerConnectWithPassword,
    playerJoin,
    playerLeave,
    playerDisconnectSession,
    playerBuzz,
  };
}
