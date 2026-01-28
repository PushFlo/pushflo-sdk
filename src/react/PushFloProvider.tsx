import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { PushFloClient } from '../client/PushFloClient.js';
import type { ConnectionState, ClientOptions } from '../types/connection.js';
import type { SubscriptionOptions, Subscription } from '../types/message.js';

export interface PushFloContextValue {
  /** Current connection state */
  connectionState: ConnectionState;

  /** Client instance (may be null before initialization) */
  client: PushFloClient | null;

  /** Connect to PushFlo */
  connect: () => Promise<void>;

  /** Disconnect from PushFlo */
  disconnect: () => void;

  /** Subscribe to a channel */
  subscribe: (channel: string, options?: SubscriptionOptions) => Subscription | null;

  /** Unsubscribe from a channel */
  unsubscribe: (channel: string) => void;
}

const PushFloContext = createContext<PushFloContextValue | null>(null);

export interface PushFloProviderProps extends Omit<ClientOptions, 'autoConnect'> {
  /** React children */
  children: React.ReactNode;

  /** Automatically connect on mount */
  autoConnect?: boolean;
}

/**
 * Provider component for PushFlo React integration
 */
export function PushFloProvider({
  children,
  publishKey,
  baseUrl,
  debug,
  connectionTimeout,
  heartbeatInterval,
  autoReconnect,
  maxReconnectAttempts,
  reconnectDelay,
  maxReconnectDelay,
  autoConnect = true,
}: PushFloProviderProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const clientRef = useRef<PushFloClient | null>(null);
  const mountedRef = useRef(true);

  // Initialize client
  useEffect(() => {
    mountedRef.current = true;

    const client = new PushFloClient({
      publishKey,
      baseUrl,
      debug,
      connectionTimeout,
      heartbeatInterval,
      autoReconnect,
      maxReconnectAttempts,
      reconnectDelay,
      maxReconnectDelay,
      autoConnect: false, // We handle auto-connect ourselves
    });

    clientRef.current = client;

    // Listen to connection changes
    const unsubscribe = client.onConnectionChange((state) => {
      if (mountedRef.current) {
        setConnectionState(state);
      }
    });

    // Auto-connect if enabled
    if (autoConnect) {
      client.connect().catch((error) => {
        if (debug) {
          console.error('[PushFlo] Auto-connect failed:', error);
        }
      });
    }

    return () => {
      mountedRef.current = false;
      unsubscribe();
      client.destroy();
      clientRef.current = null;
    };
  }, [
    publishKey,
    baseUrl,
    debug,
    connectionTimeout,
    heartbeatInterval,
    autoReconnect,
    maxReconnectAttempts,
    reconnectDelay,
    maxReconnectDelay,
    autoConnect,
  ]);

  const connect = useCallback(async () => {
    if (clientRef.current) {
      await clientRef.current.connect();
    }
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
  }, []);

  const subscribe = useCallback((channel: string, options?: SubscriptionOptions) => {
    if (clientRef.current) {
      return clientRef.current.subscribe(channel, options);
    }
    return null;
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    if (clientRef.current) {
      clientRef.current.unsubscribe(channel);
    }
  }, []);

  const value: PushFloContextValue = {
    connectionState,
    client: clientRef.current,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };

  return (
    <PushFloContext.Provider value={value}>
      {children}
    </PushFloContext.Provider>
  );
}

/**
 * Hook to access PushFlo context
 * @throws Error if used outside PushFloProvider
 */
export function usePushFloContext(): PushFloContextValue {
  const context = useContext(PushFloContext);
  if (!context) {
    throw new Error('usePushFloContext must be used within a PushFloProvider');
  }
  return context;
}
