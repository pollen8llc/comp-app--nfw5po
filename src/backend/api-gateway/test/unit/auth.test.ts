import { Request, Response } from 'express'; // v4.18.2
import { MockRequest, MockResponse } from 'jest-mock-express'; // v0.2.0
import { authenticate, authorize } from '../../src/middleware/auth';
import { ClerkService } from '../../src/services/clerk.service';
import { SecurityLogger } from '@internal/security-logger'; // v1.0.0
import { ERROR_CODES } from '../../../shared/utils/error-codes';

// Mock dependencies
jest.mock('../../src/services/clerk.service');
jest.mock('@internal/security-logger');

describe('Authentication Middleware', () => {
  let mockRequest: MockRequest;
  let mockResponse: MockResponse;
  let mockNext: jest.Mock;
  let mockClerkService: jest.Mocked<ClerkService>;
  let mockSecurityLogger: jest.Mocked<typeof SecurityLogger>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize mock request and response
    mockRequest = new MockRequest({
      headers: {
        authorization: 'Bearer valid.jwt.token'
      },
      ip: '127.0.0.1'
    });

    mockResponse = new MockResponse();
    mockNext = jest.fn();

    // Setup ClerkService mocks
    mockClerkService = {
      validateToken: jest.fn(),
      verifySession: jest.fn(),
      checkConcurrentSessions: jest.fn(),
      validateSecurityContext: jest.fn()
    } as unknown as jest.Mocked<ClerkService>;

    // Setup security logger mocks
    mockSecurityLogger.logAuthAttempt = jest.fn();
    mockSecurityLogger.logSecurityEvent = jest.fn();
  });

  describe('authenticate middleware', () => {
    it('should pass authentication for valid JWT token', async () => {
      const decodedToken = {
        sub: 'user123',
        sid: 'session456',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockClerkService.validateToken.mockResolvedValueOnce(decodedToken);
      mockClerkService.verifySession.mockResolvedValueOnce(true);
      mockClerkService.checkConcurrentSessions.mockResolvedValueOnce(true);

      await authenticate(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.id).toBe('user123');
      expect(mockSecurityLogger.logAuthAttempt).toHaveBeenCalledWith({
        userId: 'user123',
        success: true,
        ip: '127.0.0.1'
      });
    });

    it('should reject expired tokens', async () => {
      const expiredToken = {
        sub: 'user123',
        sid: 'session456',
        exp: Math.floor(Date.now() / 1000) - 3600
      };

      mockClerkService.validateToken.mockResolvedValueOnce(expiredToken);

      await authenticate(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: ERROR_CODES.AUTHENTICATION_ERROR,
          message: 'Token expired'
        }
      });
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith({
        eventType: 'TOKEN_EXPIRED',
        severity: 'WARNING',
        metadata: { token: '[REDACTED]' }
      });
    });

    it('should handle rate limiting', async () => {
      mockClerkService.validateToken.mockRejectedValueOnce(new Error('Rate limit exceeded'));

      await authenticate(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: ERROR_CODES.RATE_LIMIT_ERROR,
          message: 'Rate limit exceeded'
        }
      });
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith({
        eventType: 'RATE_LIMIT_EXCEEDED',
        severity: 'WARNING',
        metadata: { ip: '127.0.0.1' }
      });
    });

    it('should validate security headers', async () => {
      const decodedToken = {
        sub: 'user123',
        sid: 'session456',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockClerkService.validateToken.mockResolvedValueOnce(decodedToken);
      mockClerkService.verifySession.mockResolvedValueOnce(true);

      await authenticate(mockRequest, mockResponse, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockResponse.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    });

    it('should handle concurrent session limits', async () => {
      const decodedToken = {
        sub: 'user123',
        sid: 'session456',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockClerkService.validateToken.mockResolvedValueOnce(decodedToken);
      mockClerkService.verifySession.mockResolvedValueOnce(true);
      mockClerkService.checkConcurrentSessions.mockResolvedValueOnce(false);

      await authenticate(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: ERROR_CODES.SESSION_ERROR,
          message: 'Maximum concurrent sessions exceeded'
        }
      });
    });
  });

  describe('authorize middleware', () => {
    beforeEach(() => {
      mockRequest.user = {
        id: 'user123',
        role: 'member',
        permissions: ['read', 'write'],
        sessionId: 'session456'
      };
    });

    it('should allow access for users with required role', () => {
      const authorizeMiddleware = authorize(['member', 'admin']);
      authorizeMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith({
        eventType: 'AUTHORIZATION_SUCCESS',
        severity: 'INFO',
        metadata: {
          userId: 'user123',
          role: 'member',
          resource: mockRequest.path
        }
      });
    });

    it('should deny access for insufficient role', () => {
      const authorizeMiddleware = authorize(['admin']);
      authorizeMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          message: 'Insufficient role permissions'
        }
      });
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith({
        eventType: 'AUTHORIZATION_FAILURE',
        severity: 'WARNING',
        metadata: {
          userId: 'user123',
          role: 'member',
          requiredRole: 'admin'
        }
      });
    });

    it('should validate specific permissions', () => {
      const authorizeMiddleware = authorize(['member'], ['read', 'write']);
      authorizeMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockSecurityLogger.logSecurityEvent).toHaveBeenCalledWith({
        eventType: 'PERMISSION_CHECK_SUCCESS',
        severity: 'INFO',
        metadata: {
          userId: 'user123',
          permissions: ['read', 'write']
        }
      });
    });

    it('should handle missing permissions', () => {
      const authorizeMiddleware = authorize(['member'], ['admin']);
      authorizeMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: {
          code: ERROR_CODES.AUTHORIZATION_ERROR,
          message: 'Insufficient permissions'
        }
      });
    });

    it('should allow admin role to bypass permission checks', () => {
      mockRequest.user.role = 'admin';
      const authorizeMiddleware = authorize(['member'], ['super_admin']);
      authorizeMiddleware(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});