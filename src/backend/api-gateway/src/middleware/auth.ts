import { Request, Response, NextFunction } from 'express'; // v4.18.2
import { StatusCodes } from 'http-status-codes'; // v2.2.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import { ClerkService } from '../services/clerk.service';
import { logger } from '../utils/logger';
import { BaseError, ERROR_CODES } from '../../../shared/utils/error-codes';

// Constants for authentication configuration
const EXCLUDED_PATHS = ['/health', '/metrics', '/favicon.ico'];
const SESSION_CONFIG = {
  maxAge: 3600000, // 1 hour
  inactivityTimeout: 1800000 // 30 minutes
};

// Role-based access control configuration
const ROLE_PERMISSIONS = new Map<string, { resources: string[], actions: string[] }>([
  ['admin', {
    resources: ['*'],
    actions: ['*']
  }],
  ['member', {
    resources: ['profile', 'network', 'events'],
    actions: ['read', 'write']
  }],
  ['analyst', {
    resources: ['network', 'analytics'],
    actions: ['read']
  }],
  ['guest', {
    resources: ['public'],
    actions: ['read']
  }]
]);

/**
 * Interface for enhanced request with user data
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    permissions: string[];
    sessionId: string;
  };
}

/**
 * Authentication middleware with comprehensive security features
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();

  try {
    // Skip authentication for excluded paths
    if (EXCLUDED_PATHS.includes(req.path)) {
      return next();
    }

    // Extract authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new BaseError(
        ERROR_CODES.AUTHENTICATION_ERROR,
        'Invalid authorization header',
        { path: req.path }
      );
    }

    const token = authHeader.split(' ')[1];
    const clerkService = new ClerkService(null); // Redis service is handled internally

    // Validate rate limiting
    const isRateLimited = await clerkService.checkRateLimit(`auth:${req.ip}`);
    if (!isRateLimited) {
      throw new BaseError(
        ERROR_CODES.RATE_LIMIT_ERROR,
        'Rate limit exceeded',
        { ip: req.ip }
      );
    }

    // Verify token and extract user data
    const decodedToken = await clerkService.validateToken(token);
    if (!decodedToken) {
      throw new BaseError(
        ERROR_CODES.AUTHENTICATION_ERROR,
        'Invalid token',
        { token: '[REDACTED]' }
      );
    }

    // Validate session
    const sessionValid = await clerkService.manageSession(
      decodedToken.sub as string,
      decodedToken.sid as string
    );

    if (!sessionValid) {
      throw new BaseError(
        ERROR_CODES.SESSION_ERROR,
        'Invalid or expired session',
        { userId: decodedToken.sub }
      );
    }

    // Get user details and attach to request
    const userData = await clerkService.getUser(decodedToken.sub as string);
    req.user = {
      id: userData.id,
      role: userData.metadata?.role || 'guest',
      permissions: ROLE_PERMISSIONS.get(userData.metadata?.role || 'guest')?.actions || [],
      sessionId: decodedToken.sid as string
    };

    // Log successful authentication
    logger.info('Authentication successful', {
      userId: req.user.id,
      role: req.user.role,
      path: req.path,
      duration: Date.now() - startTime
    });

    // Apply security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    next();
  } catch (error) {
    logger.error(error, {
      path: req.path,
      ip: req.ip,
      duration: Date.now() - startTime
    });

    res.status(
      error.code === ERROR_CODES.RATE_LIMIT_ERROR
        ? StatusCodes.TOO_MANY_REQUESTS
        : StatusCodes.UNAUTHORIZED
    ).json({
      error: {
        code: error.code,
        message: error.message
      }
    });
  }
};

/**
 * Authorization middleware factory for role-based access control
 */
export const authorize = (allowedRoles: string[], requiredPermissions: string[] = []) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new BaseError(
          ERROR_CODES.AUTHORIZATION_ERROR,
          'User not authenticated',
          { path: req.path }
        );
      }

      // Check role authorization
      const hasRole = allowedRoles.includes(req.user.role) || req.user.role === 'admin';
      if (!hasRole) {
        throw new BaseError(
          ERROR_CODES.AUTHORIZATION_ERROR,
          'Insufficient role permissions',
          {
            userRole: req.user.role,
            requiredRoles: allowedRoles
          }
        );
      }

      // Check specific permissions if required
      if (requiredPermissions.length > 0) {
        const hasPermissions = requiredPermissions.every(
          permission => req.user.permissions.includes(permission)
        );
        if (!hasPermissions) {
          throw new BaseError(
            ERROR_CODES.AUTHORIZATION_ERROR,
            'Insufficient permissions',
            {
              userPermissions: req.user.permissions,
              requiredPermissions
            }
          );
        }
      }

      // Log successful authorization
      logger.info('Authorization successful', {
        userId: req.user.id,
        role: req.user.role,
        path: req.path,
        permissions: requiredPermissions
      });

      next();
    } catch (error) {
      logger.error(error, {
        path: req.path,
        userId: req.user?.id,
        role: req.user?.role
      });

      res.status(StatusCodes.FORBIDDEN).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }
  };
};

/**
 * Session validation with enhanced security checks
 */
export const validateSession = async (
  sessionId: string,
  userId: string
): Promise<boolean> => {
  try {
    const clerkService = new ClerkService(null);
    const sessionValid = await clerkService.manageSession(userId, sessionId);

    if (!sessionValid) {
      logger.warn('Invalid session detected', {
        userId,
        sessionId: '[REDACTED]'
      });
      return false;
    }

    return true;
  } catch (error) {
    logger.error(error, {
      userId,
      sessionId: '[REDACTED]'
    });
    return false;
  }
};