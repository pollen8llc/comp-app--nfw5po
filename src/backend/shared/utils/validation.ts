import { z } from 'zod'; // v3.22.0
import { ERROR_CODES, BaseError } from './error-codes';

/**
 * Custom error class for validation failures with detailed error information
 */
export class ValidationError extends BaseError {
  public readonly validationErrors: Record<string, unknown>;

  constructor(message: string, validationErrors: Record<string, unknown>) {
    super(
      ERROR_CODES.VALIDATION_ERROR,
      message,
      validationErrors,
      {
        component: 'validation',
        service: 'shared-utils',
        additionalMetadata: {
          errorCount: Object.keys(validationErrors).length,
          errorFields: Object.keys(validationErrors)
        }
      }
    );
    this.validationErrors = validationErrors;
  }
}

/**
 * Generic schema validation function using Zod with enhanced error handling
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated and typed data
 * @throws ValidationError if validation fails
 */
export async function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<T> {
  try {
    // Ensure schema is a valid Zod schema
    if (!(schema instanceof z.ZodSchema)) {
      throw new Error('Invalid schema provided');
    }

    // Parse and validate data
    const validatedData = await schema.parseAsync(data);
    return validatedData;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = formatValidationErrors(error);
      throw new ValidationError(
        'Validation failed',
        formattedErrors
      );
    }
    throw error;
  }
}

/**
 * Validates partial data against a schema for update operations
 * @param schema - Base Zod schema
 * @param data - Partial data to validate
 * @returns Validated partial data
 * @throws ValidationError if validation fails
 */
export async function validatePartial<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<Partial<T>> {
  try {
    // Create partial schema
    const partialSchema = schema.partial();

    // Additional validation for partial updates
    const enhancedPartialSchema = partialSchema.superRefine((data, ctx) => {
      // Ensure at least one field is provided
      if (Object.keys(data as object).length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one field must be provided for partial update',
          path: []
        });
      }
    });

    // Validate partial data
    const validatedData = await enhancedPartialSchema.parseAsync(data);
    return validatedData;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = formatValidationErrors(error);
      throw new ValidationError(
        'Partial validation failed',
        formattedErrors
      );
    }
    throw error;
  }
}

/**
 * Formats Zod validation errors into a standardized structure
 * @param error - Zod validation error
 * @returns Formatted validation error object
 */
export function formatValidationErrors(error: z.ZodError): Record<string, unknown> {
  const formattedErrors: Record<string, unknown> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    const fieldName = path || '_base';

    // Format the error message
    let message = err.message;
    if (err.code === z.ZodIssueCode.invalid_type) {
      message = `Expected ${err.expected}, received ${err.received}`;
    }

    // Handle nested errors
    if (formattedErrors[fieldName]) {
      if (Array.isArray(formattedErrors[fieldName])) {
        (formattedErrors[fieldName] as string[]).push(message);
      } else {
        formattedErrors[fieldName] = [formattedErrors[fieldName], message];
      }
    } else {
      formattedErrors[fieldName] = message;
    }

    // Add additional context if available
    if (err.code === z.ZodIssueCode.custom) {
      formattedErrors[`${fieldName}_context`] = err.params || {};
    }
  });

  return {
    fields: formattedErrors,
    errorCount: error.errors.length,
    isValid: false
  };
}