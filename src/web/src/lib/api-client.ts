import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios'; // ^1.4.0
import CryptoJS from 'crypto-js'; // ^4.1.1
import CircuitBreaker from 'circuit-breaker-js'; // ^0.0.1
import { APIResponse, APIError, HttpMethod, SigningMethod } from '../types/api';
import { apiConfig } from '../config/api';
import { getAuthUser } from './clerk';

// Cache implementation with TTL
interface CachedResponse {
  data: any;
  timestamp: number;
  ttl: number;
}

// Global instances
let apiInstance: AxiosInstance | null = null;
const requestCache = new Map<string, CachedResponse>();
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000
});

// Rate limiting state
const rateLimitState = {
  requests: 0,
  windowStart: Date.now(),
  windowMs: 3600000, // 1 hour
  limit: 100 // requests per window
};

/**
 * Creates and configures an enhanced Axios instance with security and monitoring features
 */
const createApiClient = (): AxiosInstance => {
  if (apiInstance) return apiInstance;

  const instance = axios.create({
    baseURL: apiConfig.baseURL,
    timeout: apiConfig.timeout,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Version': apiConfig.version
    }
  });

  // Request interceptor for authentication and security
  instance.interceptors.request.use(async (config) => {
    // Add correlation ID
    config.headers['X-Correlation-ID'] = generateCorrelationId();

    // Add authentication token
    const user = await getAuthUser();
    if (user) {
      config.headers['Authorization'] = `Bearer ${user.session?.token}`;
    }

    // Add request signature
    if (apiConfig.security.enableHMACSignature) {
      const signature = signRequest(config);
      config.headers[apiConfig.security.signatureHeader] = signature;
    }

    // Rate limiting check
    if (isRateLimited()) {
      throw new Error('Rate limit exceeded');
    }
    updateRateLimitState();

    return config;
  });

  // Response interceptor for caching and error handling
  instance.interceptors.response.use(
    (response) => {
      // Cache successful GET requests
      if (response.config.method?.toLowerCase() === 'get') {
        const cacheKey = generateCacheKey(response.config);
        cacheResponse(cacheKey, response.data);
      }

      return response;
    },
    async (error: AxiosError) => {
      const enhancedError = await handleApiError(error);
      throw enhancedError;
    }
  );

  apiInstance = instance;
  return instance;
};

/**
 * Generates HMAC signature for request authentication
 */
const signRequest = (config: AxiosRequestConfig): string => {
  const timestamp = Date.now().toString();
  const method = config.method?.toUpperCase() || 'GET';
  const path = config.url || '';
  const body = config.data ? JSON.stringify(config.data) : '';

  const signatureContent = `${method}${path}${timestamp}${body}`;
  const signature = CryptoJS.HmacSHA256(
    signatureContent,
    process.env.NEXT_PUBLIC_API_SECRET || ''
  ).toString();

  return `t=${timestamp},v1=${signature}`;
};

/**
 * Generates unique correlation ID for request tracing
 */
const generateCorrelationId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Checks if current request would exceed rate limit
 */
const isRateLimited = (): boolean => {
  const now = Date.now();
  if (now - rateLimitState.windowStart > rateLimitState.windowMs) {
    rateLimitState.requests = 0;
    rateLimitState.windowStart = now;
  }
  return rateLimitState.requests >= rateLimitState.limit;
};

/**
 * Updates rate limiting state with new request
 */
const updateRateLimitState = (): void => {
  rateLimitState.requests++;
};

/**
 * Generates cache key for request
 */
const generateCacheKey = (config: AxiosRequestConfig): string => {
  return `${config.method}-${config.url}-${JSON.stringify(config.params)}`;
};

/**
 * Caches response with TTL
 */
const cacheResponse = (key: string, data: any, ttl: number = 300000): void => {
  requestCache.set(key, {
    data,
    timestamp: Date.now(),
    ttl
  });
};

/**
 * Enhanced error handler with detailed error transformation
 */
const handleApiError = async (error: AxiosError): Promise<APIError> => {
  const apiError: APIError = {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    details: {},
    status: error.response?.status || 500,
    correlationId: error.config?.headers?.['X-Correlation-ID'] as string,
    ...error
  };

  if (error.response) {
    apiError.code = error.response.data?.code || `HTTP_${error.response.status}`;
    apiError.message = error.response.data?.message || error.message;
    apiError.details = error.response.data?.details || {};
  }

  // Log error with context
  console.error('API Error:', {
    correlationId: apiError.correlationId,
    code: apiError.code,
    status: apiError.status,
    message: apiError.message,
    details: apiError.details,
    stack: error.stack
  });

  return apiError;
};

/**
 * Type-safe request wrapper with circuit breaker and caching
 */
const makeRequest = async <T>(
  method: HttpMethod,
  url: string,
  config?: AxiosRequestConfig
): Promise<APIResponse<T>> => {
  const cacheKey = generateCacheKey({ ...config, method, url });

  // Check cache for GET requests
  if (method === HttpMethod.GET) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
  }

  return new Promise((resolve, reject) => {
    circuitBreaker.run(
      async () => {
        const instance = createApiClient();
        const response = await instance.request<APIResponse<T>>({
          method,
          url,
          ...config
        });
        return response.data;
      },
      (err: Error) => reject(err),
      (result: APIResponse<T>) => resolve(result)
    );
  });
};

// Export enhanced HTTP client with type safety
export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    makeRequest<T>(HttpMethod.GET, url, config),
    
  post: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
    makeRequest<T>(HttpMethod.POST, url, { ...config, data }),
    
  put: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
    makeRequest<T>(HttpMethod.PUT, url, { ...config, data }),
    
  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    makeRequest<T>(HttpMethod.DELETE, url, config),
    
  graphql: async <T>(query: string, variables?: Record<string, any>) =>
    makeRequest<T>(HttpMethod.POST, '/graphql', {
      data: { query, variables }
    })
};