import { AxiosError } from 'axios'; // ^1.4.0
import { Member } from './members';
import { Event } from './events';
import { TDAParameters } from './analytics';

/**
 * HTTP methods supported by the API
 */
export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
  PATCH = 'PATCH'
}

/**
 * Supported request signing methods
 */
export enum SigningMethod {
  HMAC_SHA256 = 'HMAC_SHA256'
}

/**
 * Sort order for paginated queries
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc'
}

/**
 * Filter operators for advanced querying
 */
export enum FilterOperator {
  EQUALS = 'eq',
  NOT_EQUALS = 'neq',
  GREATER_THAN = 'gt',
  LESS_THAN = 'lt',
  CONTAINS = 'contains',
  IN = 'in',
  NOT_IN = 'not_in'
}

/**
 * Generic API response wrapper with rate limiting metadata
 */
export interface APIResponse<T> {
  data: T;
  status: number;
  message: string;
  rateLimitInfo: RateLimitInfo;
}

/**
 * Enhanced error response with validation details
 */
export interface APIError extends AxiosError {
  code: string;
  message: string;
  details: Record<string, unknown>;
  status: number;
  stack?: string;
  validationErrors?: ValidationError[];
}

/**
 * Detailed validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Enhanced pagination parameters with cursor support
 */
export interface PaginationParams {
  page: number;
  limit: number;
  cursor?: string;
  sort_by?: string[];
  sort_order?: SortOrder[];
  filters?: FilterParams[];
}

/**
 * Advanced filtering parameters
 */
export interface FilterParams {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Rate limiting metadata
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Request signing information
 */
export interface RequestSignature {
  signature: string;
  timestamp: number;
  method: SigningMethod;
}

/**
 * GraphQL error structure
 */
export interface GraphQLError {
  message: string;
  path?: string[];
  extensions?: Record<string, unknown>;
}

/**
 * GraphQL response structure
 */
export interface GraphQLResponse<T> {
  data: T | null;
  errors?: GraphQLError[];
}

/**
 * Member-related API endpoints
 */
export interface MemberAPI {
  getMembers(params: PaginationParams): Promise<APIResponse<Member[]>>;
  getMemberById(id: string): Promise<APIResponse<Member>>;
  createMember(data: Omit<Member, 'id'>): Promise<APIResponse<Member>>;
  updateMember(id: string, data: Partial<Member>): Promise<APIResponse<Member>>;
  deleteMember(id: string): Promise<APIResponse<void>>;
}

/**
 * Event-related API endpoints
 */
export interface EventAPI {
  getEvents(params: PaginationParams): Promise<APIResponse<Event[]>>;
  getEventById(id: string): Promise<APIResponse<Event>>;
  createEvent(data: Omit<Event, 'id'>): Promise<APIResponse<Event>>;
  updateEvent(id: string, data: Partial<Event>): Promise<APIResponse<Event>>;
  deleteEvent(id: string): Promise<APIResponse<void>>;
}

/**
 * Analytics-related API endpoints
 */
export interface AnalyticsAPI {
  computeTDA(params: TDAParameters): Promise<APIResponse<unknown>>;
  getNetworkMetrics(memberId: string): Promise<APIResponse<unknown>>;
  getGraphVisualization(params: unknown): Promise<APIResponse<unknown>>;
}

/**
 * HTTP error status codes with descriptions
 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503
}

/**
 * Error codes for API responses
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST'
}

/**
 * API version information
 */
export interface APIVersion {
  version: string;
  deprecated: boolean;
  sunset?: Date;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: Record<string, {
    status: string;
    latency: number;
  }>;
}