import { injectable } from 'inversify';
import { Clerk } from '@clerk/clerk-sdk-node'; // v4.10.0
import * as jwt from 'jsonwebtoken'; // v9.0.0
import rateLimit from 'express-rate-limit'; // v6.0.0
import { ERROR_CODES } from '../../../shared/utils/error-codes';
import { RedisService } from '../services/redis.service';

// Constants for token and session management
const TOKEN_EXPIRY_TIME = 3600; // 1 hour
const SESSION_TIMEOUT = 1800; // 30 minutes
const MAX_CONCURRENT_SESSIONS = 3;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100;

@injectable()
export class ClerkService {
  private clerkClient: Clerk;
  private redisService: RedisService;
  private rateLimiter: any;
  private readonly apiKey: string;
  private readonly tokenExpiryTime: number;
  private readonly sessionTimeout: number;
  private readonly maxConcurrentSessions: number;

  constructor(redisService: RedisService) {
    // Initialize Clerk client with API key
    this.apiKey = process.env.CLERK_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('CLERK_API_KEY is required');
    }
    this.clerkClient = Clerk({ apiKey: this.apiKey });
    
    // Initialize dependencies and configuration
    this.redisService = redisService;
    this.tokenExpiryTime = TOKEN_EXPIRY_TIME;
    this.sessionTimeout = SESSION_TIMEOUT;
    this.maxConcurrentSessions = MAX_CONCURRENT_SESSIONS;

    // Configure rate limiter
    this.rateLimiter = rateLimit({
      windowMs: RATE_LIMIT_WINDOW,
      max: RATE_LIMIT_MAX,
      message: { 
        error: ERROR_CODES.RATE_LIMIT_ERROR,
        message: 'Too many authentication attempts'
      }
    });
  }

  /**
   * Validates JWT token with enhanced security checks
   */
  public async validateToken(token: string): Promise<object> {
    try {
      // Check rate limit
      if (!await this.redisService.checkRateLimit(`auth:${token}`)) {
        throw new Error(ERROR_CODES.RATE_LIMIT_ERROR);
      }

      // Verify token with Clerk
      const decodedToken = await this.clerkClient.verifyToken(token);
      
      if (!decodedToken) {
        throw new Error(ERROR_CODES.AUTHENTICATION_ERROR);
      }

      // Validate token expiration
      const tokenExp = (decodedToken as any).exp * 1000;
      if (Date.now() >= tokenExp) {
        throw new Error(ERROR_CODES.AUTHENTICATION_ERROR);
      }

      // Check token against blacklist
      const isBlacklisted = await this.redisService.getCache(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new Error(ERROR_CODES.AUTHENTICATION_ERROR);
      }

      // Verify session is still active
      const sessionValid = await this.manageSession(
        (decodedToken as any).sub,
        (decodedToken as any).sid
      );

      if (!sessionValid) {
        throw new Error(ERROR_CODES.SESSION_ERROR);
      }

      return decodedToken;
    } catch (error) {
      throw new Error(
        error.message === ERROR_CODES.RATE_LIMIT_ERROR
          ? ERROR_CODES.RATE_LIMIT_ERROR
          : ERROR_CODES.AUTHENTICATION_ERROR
      );
    }
  }

  /**
   * Manages user sessions with concurrent session limits
   */
  public async manageSession(userId: string, sessionId: string): Promise<boolean> {
    try {
      // Get active sessions for user
      const activeSessions = await this.redisService.getCache<string[]>(`sessions:${userId}`);
      
      if (activeSessions) {
        // Enforce concurrent session limit
        if (activeSessions.length >= this.maxConcurrentSessions && 
            !activeSessions.includes(sessionId)) {
          return false;
        }

        // Update session activity timestamp
        await this.redisService.setSession(sessionId, {
          userId,
          lastActivity: Date.now()
        });

        // Clean up expired sessions
        const validSessions = await Promise.all(
          activeSessions.map(async (sid) => {
            const session = await this.redisService.getCache(`session:${sid}`);
            return session ? sid : null;
          })
        );

        await this.redisService.setCache(
          `sessions:${userId}`,
          validSessions.filter(Boolean),
          this.tokenExpiryTime
        );
      } else {
        // Initialize new session list
        await this.redisService.setCache(
          `sessions:${userId}`,
          [sessionId],
          this.tokenExpiryTime
        );
      }

      return true;
    } catch (error) {
      throw new Error(ERROR_CODES.SESSION_ERROR);
    }
  }

  /**
   * Retrieves user details with caching
   */
  public async getUser(userId: string): Promise<object> {
    try {
      // Check cache first
      const cachedUser = await this.redisService.getCache(`user:${userId}`);
      if (cachedUser) {
        return cachedUser;
      }

      // Retrieve from Clerk if not cached
      const user = await this.clerkClient.users.getUser(userId);
      
      if (!user) {
        throw new Error(ERROR_CODES.AUTHENTICATION_ERROR);
      }

      // Transform user data to internal format
      const userData = {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        firstName: user.firstName,
        lastName: user.lastName,
        imageUrl: user.imageUrl,
        metadata: user.publicMetadata,
        createdAt: user.createdAt
      };

      // Cache user data
      await this.redisService.setCache(
        `user:${userId}`,
        userData,
        this.tokenExpiryTime
      );

      return userData;
    } catch (error) {
      throw new Error(ERROR_CODES.AUTHENTICATION_ERROR);
    }
  }
}