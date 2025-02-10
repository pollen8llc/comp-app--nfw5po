import { z } from 'zod'; // v3.22.0
import { parse } from 'csv-parse'; // v5.5.0
import dayjs from 'dayjs'; // v1.11.9
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import { Event, EventPlatform, EventValidationStatus } from '../../../shared/types/event.types';
import { EventModel } from '../models/event.model';
import { validateSchema } from '../../../shared/utils/validation';
import { eventSchema } from '../../../shared/schemas/event.schema';
import { BaseError, ERROR_CODES } from '../../../shared/utils/error-codes';

// Configure dayjs plugins for timezone handling
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Interface for import configuration options
 */
interface ImportOptions {
  batchSize?: number;
  retryAttempts?: number;
  timezone?: string;
  validateDates?: boolean;
  skipInvalid?: boolean;
}

/**
 * Interface for import processing results
 */
interface ProcessImportResult {
  success: boolean;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  errors: Array<{
    index: number;
    error: string;
    data?: Partial<Event>;
  }>;
  processingTime: number;
  validationStats: {
    dateValidations: number;
    schemaValidations: number;
    retryAttempts: number;
  };
}

/**
 * Interface for CSV parsing options
 */
interface CsvParseOptions {
  delimiter?: string;
  columns?: boolean;
  skipEmptyLines?: boolean;
  skipRows?: number;
  maxRows?: number;
  encoding?: string;
}

/**
 * Processes imported events with comprehensive validation and error handling
 * @param events Array of events to process
 * @param platform Source platform of the events
 * @param options Import processing options
 * @returns Detailed processing results
 */
export async function processImportedEvents(
  events: Event[],
  platform: EventPlatform,
  options: ImportOptions = {}
): Promise<ProcessImportResult> {
  const startTime = Date.now();
  const result: ProcessImportResult = {
    success: false,
    totalProcessed: 0,
    successCount: 0,
    failureCount: 0,
    errors: [],
    processingTime: 0,
    validationStats: {
      dateValidations: 0,
      schemaValidations: 0,
      retryAttempts: 0
    }
  };

  const {
    batchSize = 50,
    retryAttempts = 3,
    timezone = 'UTC',
    validateDates = true,
    skipInvalid = false
  } = options;

  try {
    // Process events in batches
    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize);
      
      for (const event of batch) {
        result.totalProcessed++;
        
        try {
          // Normalize and validate dates
          if (validateDates) {
            event.start_date = normalizeEventDate(event.start_date, timezone);
            event.end_date = normalizeEventDate(event.end_date, timezone);
            result.validationStats.dateValidations++;
          }

          // Validate event data
          const validatedEvent = await validateEventData(event, platform, retryAttempts);
          result.validationStats.schemaValidations++;

          // Create EventModel instance
          const eventModel = new EventModel({
            ...validatedEvent,
            platform,
            validationStatus: EventValidationStatus.VALIDATED
          });

          result.successCount++;
        } catch (error) {
          result.failureCount++;
          result.errors.push({
            index: i + batch.indexOf(event),
            error: error instanceof Error ? error.message : 'Unknown error',
            data: event
          });

          if (!skipInvalid) {
            throw error;
          }
        }
      }
    }

    result.success = result.failureCount === 0;
    result.processingTime = Date.now() - startTime;
    return result;
  } catch (error) {
    throw new BaseError(
      ERROR_CODES.EVENT_IMPORT_ERROR,
      'Event import processing failed',
      {
        platform,
        processingStats: result,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    );
  }
}

/**
 * Parses events from CSV file content with streaming support
 * @param fileContent CSV file content as Buffer
 * @param options CSV parsing options
 * @returns Parsed events with validation results
 */
export async function parseCsvEvents(
  fileContent: Buffer,
  options: CsvParseOptions = {}
): Promise<Event[]> {
  const {
    delimiter = ',',
    columns = true,
    skipEmptyLines = true,
    skipRows = 0,
    maxRows = 1000,
    encoding = 'utf-8'
  } = options;

  return new Promise((resolve, reject) => {
    const events: Event[] = [];
    let rowCount = 0;

    const parser = parse(fileContent, {
      delimiter,
      columns,
      skip_empty_lines: skipEmptyLines,
      from_line: skipRows + 1,
      encoding
    });

    parser.on('readable', () => {
      let record;
      while ((record = parser.read()) !== null && rowCount < maxRows) {
        try {
          const event = transformCsvRecord(record);
          events.push(event);
          rowCount++;
        } catch (error) {
          reject(new BaseError(
            ERROR_CODES.EVENT_IMPORT_ERROR,
            'CSV parsing failed',
            { row: rowCount + 1, error: error instanceof Error ? error.message : 'Unknown error' }
          ));
        }
      }
    });

    parser.on('error', (error) => {
      reject(new BaseError(
        ERROR_CODES.EVENT_IMPORT_ERROR,
        'CSV parsing failed',
        { error: error.message }
      ));
    });

    parser.on('end', () => {
      resolve(events);
    });
  });
}

/**
 * Validates event data with retry mechanism
 * @param event Event data to validate
 * @param platform Source platform
 * @param retryAttempts Number of retry attempts
 * @returns Validated event data
 */
async function validateEventData(
  event: Event,
  platform: EventPlatform,
  retryAttempts: number
): Promise<Event> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    try {
      const validatedEvent = await validateSchema(eventSchema, {
        ...event,
        platform
      });
      return validatedEvent;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown validation error');
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }

  throw lastError || new Error('Event validation failed after retry attempts');
}

/**
 * Normalizes event date with timezone handling
 * @param date Date to normalize
 * @param timezone Target timezone
 * @returns Normalized Date object
 */
function normalizeEventDate(date: Date | string, timezone: string): Date {
  try {
    const parsedDate = dayjs.tz(date, timezone);
    if (!parsedDate.isValid()) {
      throw new Error('Invalid date format');
    }
    return parsedDate.toDate();
  } catch (error) {
    throw new BaseError(
      ERROR_CODES.EVENT_IMPORT_ERROR,
      'Date normalization failed',
      { date, timezone, error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Transforms CSV record to Event object
 * @param record CSV record object
 * @returns Transformed Event object
 */
function transformCsvRecord(record: Record<string, string>): Event {
  const requiredFields = ['title', 'start_date', 'end_date', 'location'];
  
  for (const field of requiredFields) {
    if (!record[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return {
    id: record.id || crypto.randomUUID(),
    title: record.title.trim(),
    description: record.description?.trim(),
    start_date: new Date(record.start_date),
    end_date: new Date(record.end_date),
    location: record.location.trim(),
    platform: EventPlatform.PARTIFUL,
    validationStatus: EventValidationStatus.PENDING,
    metadata: {
      tags: {},
      categories: record.categories?.split(',').map(c => c.trim()) || [],
      capacity: parseInt(record.capacity) || 0,
      is_private: record.is_private?.toLowerCase() === 'true',
      dataClassification: record.data_classification || 'PUBLIC',
      lastModifiedBy: 'CSV_IMPORT',
      lastModifiedAt: new Date()
    },
    participants: [],
    created_at: new Date(),
    updated_at: new Date(),
    created_by: 'CSV_IMPORT',
    updated_by: 'CSV_IMPORT'
  };
}