import { afterEach, vi } from 'vitest';

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
});

// Mock console.error to not pollute test output (but still track calls)
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});

// Suppress unhandled rejection warnings for test promises that are caught
// by expect().rejects.toThrow() but appear as unhandled briefly
process.on('unhandledRejection', () => {
  // Silently ignore - these are expected in retry tests
});
