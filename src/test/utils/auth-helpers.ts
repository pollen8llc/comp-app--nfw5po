/**
 * @fileoverview Test utility functions for authentication testing
 * Provides helper methods for generating test tokens and sessions with role-based claims
 * @version 1.0.0
 */

import { sign, verify } from 'jsonwebtoken'; // ^9.0.0
import { AuthUser, AuthSession, UserRole } from '../../web/src/types/auth';

// Test environment constants
const TEST_SECRET = 'test-jwt-secret-key-for-unit-tests';
const ONE_HOUR = 60 * 60;
const SEVEN_DAYS = 60 * 60 * 24 * 7;

/**
 * Interface for token generation options
 */
interface TokenOptions {
  expiresIn?: string;
  secret?: string;
}

/**
 * Generates a JWT token for testing purposes with role-based claims
 * @param payload User data to encode in token
 * @param options Token configuration options
 * @returns Generated JWT token string
 */
export const generateTestToken = (
  payload: { id: string; email: string; role: UserRole },
  options: TokenOptions = {}
): string => {
  // Validate required payload fields
  if (!payload.id || !payload.email || !payload.role) {
    throw new Error('Token payload must contain id, email and role');
  }

  const tokenPayload = {
    sub: payload.id,
    email: payload.email,
    role: payload.role,
    iat: Math.floor(Date.now() / 1000),
    // Add standard JWT claims
    iss: 'test-auth-helper',
    aud: 'test-environment'
  };

  const token = sign(
    tokenPayload,
    options.secret || TEST_SECRET,
    {
      expiresIn: options.expiresIn || '1h',
      algorithm: 'HS256'
    }
  );

  // Verify token was generated correctly
  verify(token, options.secret || TEST_SECRET);

  return token;
};

/**
 * Creates a test authentication session with timestamp validation
 * @param user User data to create session for
 * @returns Test session with tokens and expiration
 */
export const createTestSession = (user: AuthUser): AuthSession => {
  const now = Math.floor(Date.now() / 1000);

  // Generate access token with 1-hour expiration
  const token = generateTestToken(user, { expiresIn: '1h' });

  // Generate refresh token with 7-day expiration
  const refreshToken = generateTestToken(user, { expiresIn: '7d' });

  // Calculate session expiration
  const expiresAt = (now + ONE_HOUR) * 1000; // Convert to milliseconds

  const session: AuthSession = {
    token,
    refreshToken,
    expiresAt
  };

  return session;
};

/**
 * Generates an expired JWT token for testing error cases
 * @param payload User data to encode in expired token
 * @returns Expired JWT token string
 */
export const generateExpiredToken = (
  payload: { id: string; email: string; role: UserRole }
): string => {
  // Create token that expired 1 hour ago
  const token = generateTestToken(payload, { 
    expiresIn: '-1h'
  });

  // Verify token is actually expired
  try {
    verify(token, TEST_SECRET);
    throw new Error('Token should be expired');
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return token;
    }
    throw error;
  }
};

/**
 * Jest matcher for asserting successful authentication
 * @param session Authentication session to validate
 */
export const expectAuthenticated = (session: AuthSession): void => {
  // Verify session structure
  expect(session).toBeDefined();
  expect(session.token).toBeDefined();
  expect(session.refreshToken).toBeDefined();
  expect(session.expiresAt).toBeDefined();

  // Validate token format and claims
  const decoded = verify(session.token, TEST_SECRET) as any;
  expect(decoded).toBeDefined();
  expect(decoded.sub).toBeDefined();
  expect(decoded.email).toBeDefined();
  expect(decoded.role).toBeDefined();
  expect(Object.values(UserRole)).toContain(decoded.role);

  // Verify token expiration
  expect(session.expiresAt).toBeGreaterThan(Date.now());
  expect(decoded.exp).toBeDefined();
  expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));

  // Validate refresh token
  const refreshDecoded = verify(session.refreshToken, TEST_SECRET) as any;
  expect(refreshDecoded).toBeDefined();
  expect(refreshDecoded.exp).toBeGreaterThan(decoded.exp);
};

/**
 * Jest matcher for asserting failed authentication
 * @param response Error response to validate
 */
export const expectUnauthenticated = (response: any): void => {
  expect(response).toBeDefined();
  expect(response.error).toBeDefined();
  expect(response.code).toBeDefined();
  
  // Verify error structure
  expect(response.error).toBe('authentication_error');
  expect(response.code).toMatch(/^(invalid_token|expired_token|missing_token)$/);
  expect(response.message).toBeDefined();
  
  // Verify no valid session data
  expect(response.token).toBeUndefined();
  expect(response.session).toBeUndefined();
};