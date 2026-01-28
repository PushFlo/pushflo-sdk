import { describe, it, expect, vi } from 'vitest';
import { ConnectionStateMachine } from '../../src/client/ConnectionStateMachine.js';

describe('ConnectionStateMachine', () => {
  it('should start in disconnected state', () => {
    const machine = new ConnectionStateMachine();

    expect(machine.state).toBe('disconnected');
    expect(machine.isDisconnected).toBe(true);
    expect(machine.isConnected).toBe(false);
    expect(machine.isConnecting).toBe(false);
    expect(machine.isError).toBe(false);
  });

  it('should allow valid transitions', () => {
    const machine = new ConnectionStateMachine();

    // disconnected -> connecting
    expect(machine.transition('connecting')).toBe(true);
    expect(machine.state).toBe('connecting');

    // connecting -> connected
    expect(machine.transition('connected')).toBe(true);
    expect(machine.state).toBe('connected');

    // connected -> disconnected
    expect(machine.transition('disconnected')).toBe(true);
    expect(machine.state).toBe('disconnected');
  });

  it('should reject invalid transitions', () => {
    const machine = new ConnectionStateMachine();

    // Cannot go directly from disconnected to connected
    expect(machine.transition('connected')).toBe(false);
    expect(machine.state).toBe('disconnected');
  });

  it('should allow transition to same state', () => {
    const machine = new ConnectionStateMachine();
    machine.transition('connecting');

    expect(machine.transition('connecting')).toBe(true);
    expect(machine.state).toBe('connecting');
  });

  it('should handle error state transitions', () => {
    const machine = new ConnectionStateMachine();

    // connecting -> error
    machine.transition('connecting');
    expect(machine.transition('error')).toBe(true);
    expect(machine.isError).toBe(true);

    // error -> connecting (retry)
    expect(machine.transition('connecting')).toBe(true);
    expect(machine.state).toBe('connecting');
  });

  it('should notify listeners on state change', () => {
    const machine = new ConnectionStateMachine();
    const listener = vi.fn();

    machine.onChange(listener);
    machine.transition('connecting');

    expect(listener).toHaveBeenCalledWith('connecting');
  });

  it('should not notify listeners when staying in same state', () => {
    const machine = new ConnectionStateMachine();
    const listener = vi.fn();

    machine.onChange(listener);
    machine.transition('disconnected'); // Already in disconnected

    expect(listener).not.toHaveBeenCalled();
  });

  it('should allow unsubscribing from state changes', () => {
    const machine = new ConnectionStateMachine();
    const listener = vi.fn();

    const unsubscribe = machine.onChange(listener);
    unsubscribe();
    machine.transition('connecting');

    expect(listener).not.toHaveBeenCalled();
  });

  it('should force transition regardless of validity', () => {
    const machine = new ConnectionStateMachine();

    // Force invalid transition
    machine.forceTransition('connected');
    expect(machine.state).toBe('connected');
  });

  it('should reset to disconnected', () => {
    const machine = new ConnectionStateMachine();
    machine.transition('connecting');
    machine.transition('connected');

    machine.reset();
    expect(machine.state).toBe('disconnected');
  });

  it('should check state with is()', () => {
    const machine = new ConnectionStateMachine();

    expect(machine.is('disconnected')).toBe(true);
    expect(machine.is('connecting')).toBe(false);

    machine.transition('connecting');
    expect(machine.is('connecting')).toBe(true);
  });

  it('should remove all listeners', () => {
    const machine = new ConnectionStateMachine();
    const listener1 = vi.fn();
    const listener2 = vi.fn();

    machine.onChange(listener1);
    machine.onChange(listener2);
    machine.removeAllListeners();
    machine.transition('connecting');

    expect(listener1).not.toHaveBeenCalled();
    expect(listener2).not.toHaveBeenCalled();
  });

  it('should catch errors in listeners', () => {
    const machine = new ConnectionStateMachine();
    const errorListener = vi.fn(() => {
      throw new Error('Listener error');
    });
    const goodListener = vi.fn();

    machine.onChange(errorListener);
    machine.onChange(goodListener);
    machine.transition('connecting');

    expect(errorListener).toHaveBeenCalled();
    expect(goodListener).toHaveBeenCalled();
  });
});
