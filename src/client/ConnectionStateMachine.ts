import type { ConnectionState } from '../types/connection.js';

type StateTransition = {
  from: ConnectionState | ConnectionState[];
  to: ConnectionState;
};

const VALID_TRANSITIONS: StateTransition[] = [
  { from: 'disconnected', to: 'connecting' },
  { from: 'connecting', to: 'connected' },
  { from: 'connecting', to: 'disconnected' },
  { from: 'connecting', to: 'error' },
  { from: 'connected', to: 'disconnected' },
  { from: 'connected', to: 'error' },
  { from: 'error', to: 'connecting' },
  { from: 'error', to: 'disconnected' },
];

/**
 * State machine for managing connection state transitions
 */
export class ConnectionStateMachine {
  private _state: ConnectionState = 'disconnected';
  private listeners: Set<(state: ConnectionState) => void> = new Set();

  /**
   * Get current connection state
   */
  get state(): ConnectionState {
    return this._state;
  }

  /**
   * Check if currently in a specific state
   */
  is(state: ConnectionState): boolean {
    return this._state === state;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this._state === 'connected';
  }

  /**
   * Check if connecting
   */
  get isConnecting(): boolean {
    return this._state === 'connecting';
  }

  /**
   * Check if disconnected
   */
  get isDisconnected(): boolean {
    return this._state === 'disconnected';
  }

  /**
   * Check if in error state
   */
  get isError(): boolean {
    return this._state === 'error';
  }

  /**
   * Transition to a new state
   * @returns true if transition was successful
   */
  transition(to: ConnectionState): boolean {
    if (this._state === to) {
      return true; // Already in target state
    }

    const isValid = VALID_TRANSITIONS.some((t) => {
      const fromStates = Array.isArray(t.from) ? t.from : [t.from];
      return fromStates.includes(this._state) && t.to === to;
    });

    if (!isValid) {
      console.warn(`Invalid state transition: ${this._state} -> ${to}`);
      return false;
    }

    this._state = to;

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(to);
      } catch (error) {
        console.error('Error in connection state listener:', error);
      }
    });

    return true;
  }

  /**
   * Force transition to a state (bypasses validation)
   */
  forceTransition(to: ConnectionState): void {
    if (this._state === to) {
      return;
    }

    this._state = to;

    // Notify listeners
    this.listeners.forEach((listener) => {
      try {
        listener(to);
      } catch (error) {
        console.error('Error in connection state listener:', error);
      }
    });
  }

  /**
   * Reset to disconnected state
   */
  reset(): void {
    this.forceTransition('disconnected');
  }

  /**
   * Subscribe to state changes
   */
  onChange(listener: (state: ConnectionState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove all listeners
   */
  removeAllListeners(): void {
    this.listeners.clear();
  }
}
