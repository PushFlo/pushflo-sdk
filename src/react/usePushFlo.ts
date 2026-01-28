import { usePushFloContext } from './PushFloProvider.js';
import type { ConnectionState } from '../types/connection.js';
import type { SubscriptionOptions, Subscription } from '../types/message.js';

export interface UsePushFloResult {
  /** Current connection state */
  connectionState: ConnectionState;

  /** Whether currently connected */
  isConnected: boolean;

  /** Whether currently connecting */
  isConnecting: boolean;

  /** Connect to PushFlo */
  connect: () => Promise<void>;

  /** Disconnect from PushFlo */
  disconnect: () => void;

  /** Subscribe to a channel */
  subscribe: (channel: string, options?: SubscriptionOptions) => Subscription | null;

  /** Unsubscribe from a channel */
  unsubscribe: (channel: string) => void;
}

/**
 * Hook for accessing PushFlo connection and subscription methods
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { connectionState, connect, disconnect } = usePushFlo();
 *
 *   return (
 *     <div>
 *       <p>Status: {connectionState}</p>
 *       <button onClick={connect}>Connect</button>
 *       <button onClick={disconnect}>Disconnect</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function usePushFlo(): UsePushFloResult {
  const { connectionState, connect, disconnect, subscribe, unsubscribe } = usePushFloContext();

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    connect,
    disconnect,
    subscribe,
    unsubscribe,
  };
}
