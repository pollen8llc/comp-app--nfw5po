import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.4.0
import { print, DocumentNode } from 'graphql'; // ^16.6.0
import { APIResponse, APIError, HttpStatus, ErrorCode, GraphQLResponse, RequestSignature, SigningMethod, RateLimitInfo } from '../../web/src/types/api';

/**
 * Configuration for request signing
 */
interface RequestSigningConfig {
  secret: string;
  method: SigningMethod;
  headerName: string;
  timestampHeader: string;
}

/**
 * Configuration for response caching
 */
interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
}

/**
 * Mock response configuration
 */
interface MockResponse {
  status: number;
  data: unknown;
  headers?: Record<string, string>;
  delay?: number;
}

/**
 * Request pattern for mock matching
 */
interface RequestPattern {
  method?: string;
  path?: string | RegExp;
  query?: Record<string, string>;
  body?: unknown;
}

/**
 * Advanced test API client for comprehensive API testing scenarios
 */
export class TestAPIClient {
  private axiosInstance: AxiosInstance;
  private baseURL: string;
  private authToken?: string;
  private requestInterceptors: number[] = [];
  private responseInterceptors: number[] = [];
  private rateLimitTracking: Map<string, RateLimitInfo> = new Map();
  private responseCache: Map<string, { data: unknown; expires: number }> = new Map();
  private signingConfig?: RequestSigningConfig;
  private mockRegistry: Map<string, MockResponse> = new Map();

  constructor(
    baseURL: string,
    timeout = 30000,
    signingConfig?: RequestSigningConfig,
    cacheConfig?: CacheConfig
  ) {
    this.baseURL = baseURL;
    this.signingConfig = signingConfig;

    this.axiosInstance = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
    this.setupErrorHandling();
    this.setupRateLimitTracking();

    if (cacheConfig?.enabled) {
      this.setupCache(cacheConfig);
    }
  }

  /**
   * Executes a GraphQL query with variables
   */
  public async graphqlQuery<T>(
    query: string | DocumentNode,
    variables?: Record<string, unknown>
  ): Promise<GraphQLResponse<T>> {
    const queryString = typeof query === 'string' ? query : print(query);
    
    try {
      const cacheKey = this.generateCacheKey('query', queryString, variables);
      const cachedResponse = this.getCachedResponse<T>(cacheKey);
      
      if (cachedResponse) {
        return cachedResponse;
      }

      const signature = this.generateRequestSignature('POST', '/graphql');
      
      const response = await this.axiosInstance.post<GraphQLResponse<T>>('/graphql', {
        query: queryString,
        variables,
      }, {
        headers: this.getSignatureHeaders(signature),
      });

      this.cacheResponse(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this.handleGraphQLError(error);
    }
  }

  /**
   * Executes a GraphQL mutation with variables
   */
  public async graphqlMutation<T>(
    mutation: string | DocumentNode,
    variables?: Record<string, unknown>
  ): Promise<GraphQLResponse<T>> {
    const mutationString = typeof mutation === 'string' ? mutation : print(mutation);
    
    try {
      const signature = this.generateRequestSignature('POST', '/graphql');
      
      const response = await this.axiosInstance.post<GraphQLResponse<T>>('/graphql', {
        query: mutationString,
        variables,
      }, {
        headers: this.getSignatureHeaders(signature),
      });

      this.invalidateRelatedCache(mutationString);
      return response.data;
    } catch (error) {
      throw this.handleGraphQLError(error);
    }
  }

  /**
   * Sets authentication token for requests
   */
  public setAuthToken(token: string): void {
    this.authToken = token;
    this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Configures request signing parameters
   */
  public setRequestSigning(config: RequestSigningConfig): void {
    this.signingConfig = config;
  }

  /**
   * Registers a mock response for a request pattern
   */
  public mockResponse(pattern: RequestPattern, response: MockResponse): void {
    const key = this.generateMockKey(pattern);
    this.mockRegistry.set(key, response);
  }

  /**
   * Clears all registered mocks
   */
  public clearMocks(): void {
    this.mockRegistry.clear();
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication and signing
    this.requestInterceptors.push(
      this.axiosInstance.interceptors.request.use((config) => {
        if (this.authToken) {
          config.headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        
        const mockResponse = this.findMockResponse(config);
        if (mockResponse) {
          return Promise.reject({
            config,
            response: mockResponse,
            isMock: true,
          });
        }

        return config;
      })
    );

    // Response interceptor for rate limit tracking
    this.responseInterceptors.push(
      this.axiosInstance.interceptors.response.use((response) => {
        this.updateRateLimitInfo(response);
        return response;
      })
    );
  }

  private setupErrorHandling(): void {
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.isMock) {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({ data: error.response.data, status: error.response.status });
            }, error.response.delay || 0);
          });
        }

        const apiError: APIError = {
          code: error.response?.data?.code || ErrorCode.INTERNAL_ERROR,
          message: error.response?.data?.message || 'An unexpected error occurred',
          details: error.response?.data?.details || {},
          status: error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
          validationErrors: error.response?.data?.validationErrors,
        };

        return Promise.reject(apiError);
      }
    );
  }

  private setupRateLimitTracking(): void {
    this.axiosInstance.interceptors.response.use((response) => {
      const rateLimitInfo: RateLimitInfo = {
        limit: parseInt(response.headers['x-ratelimit-limit'] || '0'),
        remaining: parseInt(response.headers['x-ratelimit-remaining'] || '0'),
        reset: parseInt(response.headers['x-ratelimit-reset'] || '0'),
      };

      const endpoint = response.config.url || '';
      this.rateLimitTracking.set(endpoint, rateLimitInfo);

      return response;
    });
  }

  private setupCache(config: CacheConfig): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.responseCache.entries()) {
        if (value.expires < now) {
          this.responseCache.delete(key);
        }
      }
    }, config.ttl / 2);
  }

  private generateRequestSignature(method: string, path: string): RequestSignature {
    if (!this.signingConfig) {
      return { signature: '', timestamp: Date.now(), method: SigningMethod.HMAC_SHA256 };
    }

    const timestamp = Date.now();
    const stringToSign = `${method}${path}${timestamp}`;
    
    // Implementation would use crypto for actual HMAC generation
    const signature = `test-signature-${stringToSign}`;

    return {
      signature,
      timestamp,
      method: this.signingConfig.method,
    };
  }

  private getSignatureHeaders(signature: RequestSignature): Record<string, string> {
    if (!this.signingConfig) {
      return {};
    }

    return {
      [this.signingConfig.headerName]: signature.signature,
      [this.signingConfig.timestampHeader]: signature.timestamp.toString(),
    };
  }

  private generateCacheKey(type: string, operation: string, variables?: Record<string, unknown>): string {
    return `${type}:${operation}:${JSON.stringify(variables || {})}`;
  }

  private getCachedResponse<T>(key: string): GraphQLResponse<T> | null {
    const cached = this.responseCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data as GraphQLResponse<T>;
    }
    return null;
  }

  private cacheResponse(key: string, data: unknown, ttl = 300000): void {
    this.responseCache.set(key, {
      data,
      expires: Date.now() + ttl,
    });
  }

  private invalidateRelatedCache(mutation: string): void {
    // Simple cache invalidation strategy - could be more sophisticated
    this.responseCache.clear();
  }

  private generateMockKey(pattern: RequestPattern): string {
    return JSON.stringify({
      method: pattern.method,
      path: pattern.path?.toString(),
      query: pattern.query,
      body: pattern.body,
    });
  }

  private findMockResponse(config: AxiosRequestConfig): MockResponse | null {
    for (const [key, response] of this.mockRegistry.entries()) {
      const pattern = JSON.parse(key) as RequestPattern;
      
      if (this.matchesPattern(config, pattern)) {
        return response;
      }
    }
    return null;
  }

  private matchesPattern(config: AxiosRequestConfig, pattern: RequestPattern): boolean {
    if (pattern.method && pattern.method !== config.method?.toUpperCase()) {
      return false;
    }

    if (pattern.path) {
      const pathMatches = pattern.path instanceof RegExp
        ? pattern.path.test(config.url || '')
        : config.url?.includes(pattern.path);
      
      if (!pathMatches) {
        return false;
      }
    }

    if (pattern.query && !this.matchesQuery(config.params, pattern.query)) {
      return false;
    }

    if (pattern.body && !this.matchesBody(config.data, pattern.body)) {
      return false;
    }

    return true;
  }

  private matchesQuery(params: unknown, query: Record<string, string>): boolean {
    return Object.entries(query).every(([key, value]) => 
      params && typeof params === 'object' && key in params && params[key as keyof typeof params] === value
    );
  }

  private matchesBody(data: unknown, body: unknown): boolean {
    return JSON.stringify(data) === JSON.stringify(body);
  }

  private handleGraphQLError(error: unknown): Error {
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as { response?: { data?: unknown } }).response;
      if (response?.data) {
        return new Error(JSON.stringify(response.data));
      }
    }
    return new Error('GraphQL request failed');
  }
}