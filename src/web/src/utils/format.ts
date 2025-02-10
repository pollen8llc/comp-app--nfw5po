import { format as numeralFormat } from 'numeral'; // v2.0.6
import { Event, EventMetadata } from '../types/events';
import { formatEventDate } from './date';

// Global formatting constants
const NUMBER_FORMAT_DEFAULT = '0,0.00';
const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'];
const TIME_UNITS = {
  ms: 1,
  s: 1000,
  m: 60000,
  h: 3600000,
  d: 86400000
};
const FORMAT_CACHE_SIZE = 100;

// LRU cache for number formatting
const formatCache = new Map<string, string>();

/**
 * Formats a number with configurable precision and localization
 * @param value - Number to format
 * @param format - Optional numeral.js format pattern
 * @returns Formatted number string
 * @throws Error if value is invalid
 */
export const formatNumber = (value: number, format: string = NUMBER_FORMAT_DEFAULT): string => {
  if (!Number.isFinite(value)) {
    throw new Error('Invalid number provided for formatting');
  }

  const cacheKey = `${value}-${format}`;
  const cached = formatCache.get(cacheKey);
  if (cached) return cached;

  try {
    const formatted = numeralFormat(value, format);
    
    if (formatCache.size >= FORMAT_CACHE_SIZE) {
      const firstKey = formatCache.keys().next().value;
      formatCache.delete(firstKey);
    }
    formatCache.set(cacheKey, formatted);
    
    return formatted;
  } catch (error) {
    console.error('Error formatting number:', error);
    return value.toString();
  }
};

/**
 * Formats event metadata with type-safe handling
 * @param metadata - Event metadata object
 * @returns Record of formatted metadata values
 */
export const formatMetadata = (metadata: EventMetadata): Record<string, string> => {
  const formatted: Record<string, string> = {};

  try {
    // Format capacity with thousands separator
    formatted.capacity = formatNumber(metadata.capacity, '0,0');

    // Format tags as comma-separated list
    formatted.tags = Object.entries(metadata.tags)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    // Format categories with proper hierarchy
    formatted.categories = metadata.categories.join(' > ');

    // Format privacy status
    formatted.privacy = metadata.is_private ? 'Private' : 'Public';

    return formatted;
  } catch (error) {
    console.error('Error formatting metadata:', error);
    throw new Error('Failed to format event metadata');
  }
};

/**
 * Formats a decimal as a percentage with configurable precision
 * @param value - Decimal value to format as percentage
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export const formatPercentage = (value: number, decimals: number = 2): string => {
  if (!Number.isFinite(value)) {
    throw new Error('Invalid value provided for percentage formatting');
  }

  try {
    const percentage = value * 100;
    const format = `0,0.${Array(decimals).fill('0').join('')}`;
    return `${formatNumber(percentage, format)}%`;
  } catch (error) {
    console.error('Error formatting percentage:', error);
    return `${value * 100}%`;
  }
};

/**
 * Formats file size with automatic unit selection
 * @param bytes - Size in bytes
 * @returns Human-readable file size string
 */
export const formatFileSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new Error('Invalid file size value');
  }

  if (bytes === 0) return '0 B';

  try {
    const exp = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      FILE_SIZE_UNITS.length - 1
    );
    const size = bytes / Math.pow(1024, exp);
    const formatted = formatNumber(size, '0,0.00');
    return `${formatted} ${FILE_SIZE_UNITS[exp]}`;
  } catch (error) {
    console.error('Error formatting file size:', error);
    return `${bytes} B`;
  }
};

/**
 * Formats duration in milliseconds to human-readable string
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted duration string
 */
export const formatDuration = (milliseconds: number): string => {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new Error('Invalid duration value');
  }

  if (milliseconds === 0) return '0ms';

  try {
    let remaining = milliseconds;
    const parts: string[] = [];

    // Process each time unit from largest to smallest
    for (const [unit, ms] of Object.entries(TIME_UNITS).sort((a, b) => b[1] - a[1])) {
      const value = Math.floor(remaining / ms);
      if (value > 0) {
        parts.push(`${value}${unit}`);
        remaining %= ms;
      }
    }

    return parts.join(' ') || '0ms';
  } catch (error) {
    console.error('Error formatting duration:', error);
    return `${milliseconds}ms`;
  }
};