import { DEFAULTS } from '../utils/constants.js';

export interface HeartbeatOptions {
  /** Interval between heartbeats in milliseconds */
  interval?: number;

  /** Function to send ping */
  onPing: () => void;

  /** Function called when heartbeat times out */
  onTimeout?: () => void;

  /** Timeout for pong response (default: interval * 2) */
  pongTimeout?: number;
}

/**
 * Manages WebSocket heartbeat/keepalive
 */
export class Heartbeat {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly interval: number;
  private readonly pongTimeout: number;
  private readonly onPing: () => void;
  private readonly onTimeout?: () => void;
  private running = false;

  constructor(options: HeartbeatOptions) {
    this.interval = options.interval ?? DEFAULTS.HEARTBEAT_INTERVAL;
    this.pongTimeout = options.pongTimeout ?? this.interval * 2;
    this.onPing = options.onPing;
    this.onTimeout = options.onTimeout;
  }

  /**
   * Start the heartbeat
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.scheduleNextPing();
  }

  /**
   * Stop the heartbeat
   */
  stop(): void {
    this.running = false;
    this.clearTimers();
  }

  /**
   * Called when a pong is received
   */
  receivedPong(): void {
    if (!this.running) {
      return;
    }

    // Clear the timeout and schedule next ping
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.scheduleNextPing();
  }

  /**
   * Reset the heartbeat (e.g., after any activity)
   */
  reset(): void {
    if (!this.running) {
      return;
    }

    this.clearTimers();
    this.scheduleNextPing();
  }

  private scheduleNextPing(): void {
    if (!this.running) {
      return;
    }

    this.intervalId = setTimeout(() => {
      if (!this.running) {
        return;
      }

      // Send ping
      this.onPing();

      // Set timeout for pong
      this.timeoutId = setTimeout(() => {
        if (this.running && this.onTimeout) {
          this.onTimeout();
        }
      }, this.pongTimeout);
    }, this.interval);
  }

  private clearTimers(): void {
    if (this.intervalId !== null) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
