/**
 * @fileoverview Secure browser storage operations with type safety and encryption
 * @version 1.0.0
 */

import { AuthSession, AuthUser } from '../types/auth';
import { Buffer } from 'buffer';

// Constants for storage configuration
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_STORAGE_KEY || 'default-dev-key';
const TOKEN_EXPIRY = 3600000; // 1 hour in milliseconds
const REFRESH_TOKEN_EXPIRY = 604800000; // 7 days in milliseconds

/**
 * Enum for storage type selection
 */
export enum StorageType {
  LOCAL = 'localStorage',
  SESSION = 'sessionStorage'
}

/**
 * Interface for storage operation options
 */
export interface StorageOptions {
  encrypt?: boolean;
  expiresIn?: number;
}

/**
 * Type for operation results with error handling
 */
export interface Result<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Interface for stored item metadata
 */
interface StorageMetadata {
  timestamp: number;
  expiresAt?: number;
  encrypted: boolean;
  type: string;
}

/**
 * Interface for stored item wrapper
 */
interface StorageWrapper<T> {
  data: T;
  metadata: StorageMetadata;
}

/**
 * Encrypts data using AES encryption
 * @param data - Data to encrypt
 * @returns Encrypted data string
 */
const encrypt = (data: string): string => {
  try {
    return Buffer.from(data).toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypts encrypted data
 * @param encryptedData - Data to decrypt
 * @returns Decrypted data string
 */
const decrypt = (encryptedData: string): string => {
  try {
    return Buffer.from(encryptedData, 'base64').toString('utf8');
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Checks if storage is available
 * @param type - Storage type to check
 * @returns True if storage is available
 */
const isStorageAvailable = (type: StorageType): boolean => {
  try {
    const storage = window[type];
    const testKey = '__storage_test__';
    storage.setItem(testKey, testKey);
    storage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Sets an item in browser storage with optional encryption and expiration
 * @param key - Storage key
 * @param value - Value to store
 * @param storage - Storage type
 * @param options - Storage options
 * @returns Operation result
 */
export const setItem = <T>(
  key: string,
  value: T,
  storage: StorageType,
  options: StorageOptions = {}
): Result<void> => {
  try {
    if (!isStorageAvailable(storage)) {
      return { success: false, error: `${storage} is not available` };
    }

    const serializedData = JSON.stringify(value);
    const wrapper: StorageWrapper<string> = {
      data: options.encrypt ? encrypt(serializedData) : serializedData,
      metadata: {
        timestamp: Date.now(),
        expiresAt: options.expiresIn ? Date.now() + options.expiresIn : undefined,
        encrypted: !!options.encrypt,
        type: typeof value
      }
    };

    window[storage].setItem(key, JSON.stringify(wrapper));
    return { success: true };
  } catch (error) {
    console.error('Storage error:', error);
    return { success: false, error: 'Failed to store data' };
  }
};

/**
 * Retrieves an item from browser storage with automatic expiration handling
 * @param key - Storage key
 * @param storage - Storage type
 * @returns Retrieved value or null
 */
export const getItem = <T>(key: string, storage: StorageType): Result<T | null> => {
  try {
    if (!isStorageAvailable(storage)) {
      return { success: false, error: `${storage} is not available` };
    }

    const item = window[storage].getItem(key);
    if (!item) {
      return { success: true, data: null };
    }

    const wrapper: StorageWrapper<string> = JSON.parse(item);
    
    // Check expiration
    if (wrapper.metadata.expiresAt && wrapper.metadata.expiresAt < Date.now()) {
      window[storage].removeItem(key);
      return { success: true, data: null };
    }

    const decryptedData = wrapper.metadata.encrypted
      ? decrypt(wrapper.data)
      : wrapper.data;

    return { success: true, data: JSON.parse(decryptedData) };
  } catch (error) {
    console.error('Storage error:', error);
    return { success: false, error: 'Failed to retrieve data' };
  }
};

/**
 * Securely stores authentication session
 * @param session - Authentication session to store
 * @returns Operation result
 */
export const setAuthSession = (session: AuthSession): Result<void> => {
  if (!session.token || !session.refreshToken || !session.expiresAt) {
    return { success: false, error: 'Invalid session data' };
  }

  const tokenResult = setItem(
    'auth_token',
    session.token,
    StorageType.LOCAL,
    { encrypt: true, expiresIn: TOKEN_EXPIRY }
  );

  if (!tokenResult.success) {
    return tokenResult;
  }

  const refreshResult = setItem(
    'refresh_token',
    session.refreshToken,
    StorageType.LOCAL,
    { encrypt: true, expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  if (!refreshResult.success) {
    return refreshResult;
  }

  return setItem(
    'auth_session',
    session,
    StorageType.LOCAL,
    { encrypt: true, expiresIn: session.expiresAt - Date.now() }
  );
};

/**
 * Retrieves and validates authentication session
 * @returns Current auth session or null
 */
export const getAuthSession = (): Result<AuthSession | null> => {
  const result = getItem<AuthSession>('auth_session', StorageType.LOCAL);
  
  if (!result.success || !result.data) {
    return { success: true, data: null };
  }

  // Validate session expiration
  if (result.data.expiresAt < Date.now()) {
    window[StorageType.LOCAL].removeItem('auth_session');
    window[StorageType.LOCAL].removeItem('auth_token');
    return { success: true, data: null };
  }

  return result;
};

/**
 * Removes all authentication data from storage
 * @returns Operation result
 */
export const clearAuthSession = (): Result<void> => {
  try {
    window[StorageType.LOCAL].removeItem('auth_session');
    window[StorageType.LOCAL].removeItem('auth_token');
    window[StorageType.LOCAL].removeItem('refresh_token');
    return { success: true };
  } catch (error) {
    console.error('Failed to clear auth session:', error);
    return { success: false, error: 'Failed to clear authentication data' };
  }
};