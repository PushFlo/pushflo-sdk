import { describe, it, expect } from 'vitest';
import { PushFloError } from '../../src/errors/PushFloError.js';
import { ConnectionError } from '../../src/errors/ConnectionError.js';
import { AuthenticationError } from '../../src/errors/AuthenticationError.js';
import { NetworkError } from '../../src/errors/NetworkError.js';

describe('PushFloError', () => {
  it('should create error with message and code', () => {
    const error = new PushFloError('Test error', 'TEST_CODE');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('PushFloError');
    expect(error.retryable).toBe(false);
  });

  it('should support retryable option', () => {
    const error = new PushFloError('Test', 'CODE', { retryable: true });
    expect(error.retryable).toBe(true);
  });

  it('should support cause option', () => {
    const cause = new Error('Original error');
    const error = new PushFloError('Test', 'CODE', { cause });

    expect(error.cause).toBe(cause);
  });

  it('should serialize to JSON', () => {
    const error = new PushFloError('Test error', 'TEST_CODE', { retryable: true });
    const json = error.toJSON();

    expect(json.name).toBe('PushFloError');
    expect(json.message).toBe('Test error');
    expect(json.code).toBe('TEST_CODE');
    expect(json.retryable).toBe(true);
  });

  it('should have proper toString', () => {
    const error = new PushFloError('Test error', 'TEST_CODE');
    expect(error.toString()).toBe('PushFloError [TEST_CODE]: Test error');
  });
});

describe('ConnectionError', () => {
  it('should create connection error', () => {
    const error = new ConnectionError('Connection failed', 'CONN_FAIL');

    expect(error.name).toBe('ConnectionError');
    expect(error.retryable).toBe(true); // Default for connection errors
  });

  it('should create timeout error', () => {
    const error = ConnectionError.timeout(5000);

    expect(error.message).toBe('Connection timed out after 5000ms');
    expect(error.code).toBe('CONNECTION_TIMEOUT');
    expect(error.retryable).toBe(true);
  });

  it('should create closed error', () => {
    const error = ConnectionError.closed('Server shutdown');

    expect(error.message).toBe('Connection closed: Server shutdown');
    expect(error.code).toBe('CONNECTION_CLOSED');
  });

  it('should create failed error', () => {
    const cause = new Error('Network issue');
    const error = ConnectionError.failed('Could not connect', cause);

    expect(error.message).toBe('Connection failed: Could not connect');
    expect(error.cause).toBe(cause);
  });
});

describe('AuthenticationError', () => {
  it('should create auth error', () => {
    const error = new AuthenticationError('Invalid credentials', 'AUTH_FAIL');

    expect(error.name).toBe('AuthenticationError');
    expect(error.retryable).toBe(false); // Auth errors not retryable
  });

  it('should create invalid key error', () => {
    const error = AuthenticationError.invalidKey('secret');

    expect(error.message).toBe('Invalid secret API key');
    expect(error.code).toBe('INVALID_API_KEY');
  });

  it('should create unauthorized error', () => {
    const error = AuthenticationError.unauthorized();

    expect(error.message).toBe('Unauthorized - check your API key');
    expect(error.code).toBe('UNAUTHORIZED');
  });

  it('should create forbidden error', () => {
    const error = AuthenticationError.forbidden('publish');

    expect(error.message).toBe('Access forbidden: insufficient permissions for publish');
    expect(error.code).toBe('FORBIDDEN');
  });
});

describe('NetworkError', () => {
  it('should create network error', () => {
    const error = new NetworkError('Request failed', 'NET_FAIL');

    expect(error.name).toBe('NetworkError');
    expect(error.retryable).toBe(true);
  });

  it('should create from fetch error', () => {
    const cause = new TypeError('Failed to fetch');
    const error = NetworkError.fromFetch(cause);

    expect(error.message).toBe('Network request failed: Failed to fetch');
    expect(error.cause).toBe(cause);
  });

  it('should create timeout error', () => {
    const error = NetworkError.timeout(30000);

    expect(error.message).toBe('Request timed out after 30000ms');
    expect(error.code).toBe('REQUEST_TIMEOUT');
  });

  it('should create from status code', () => {
    const error404 = NetworkError.fromStatus(404);
    expect(error404.code).toBe('NOT_FOUND');
    expect(error404.retryable).toBe(false);

    const error429 = NetworkError.fromStatus(429);
    expect(error429.code).toBe('RATE_LIMITED');
    expect(error429.retryable).toBe(true);

    const error500 = NetworkError.fromStatus(500);
    expect(error500.code).toBe('SERVER_ERROR');
    expect(error500.retryable).toBe(true);
  });

  it('should include status code in JSON', () => {
    const error = NetworkError.fromStatus(503, 'Service unavailable');
    const json = error.toJSON();

    expect(json.statusCode).toBe(503);
  });
});
