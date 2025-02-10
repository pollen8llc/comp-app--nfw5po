import { z } from 'zod'; // v3.22.0
import { validateSchema, validatePartial, ValidationError } from '../../../shared/utils/validation';
import { 
  memberSchema, 
  createMemberSchema, 
  updateMemberSchema, 
  resolveMemberEntitySchema 
} from '../../../shared/schemas/member.schema';

/**
 * Validates complete member data against the member schema
 * @param data - Raw member data to validate
 * @returns Promise resolving to validated member data
 * @throws ValidationError if validation fails
 */
export async function validateMemberData(data: unknown): Promise<z.infer<typeof memberSchema>> {
  try {
    const validatedData = await validateSchema(memberSchema, data);
    return validatedData;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      'Member data validation failed',
      { error: error.message }
    );
  }
}

/**
 * Validates member creation data ensuring required fields and proper formats
 * @param data - Raw member creation data
 * @returns Promise resolving to validated member creation data
 * @throws ValidationError if validation fails
 */
export async function validateCreateMember(
  data: unknown
): Promise<z.infer<typeof createMemberSchema>> {
  try {
    const validatedData = await validateSchema(createMemberSchema, data);

    // Additional validation for social profiles
    if (!validatedData.socialProfiles.some(profile => profile.verified)) {
      throw new ValidationError(
        'At least one verified social profile is required',
        { socialProfiles: 'No verified profiles found' }
      );
    }

    return validatedData;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      'Member creation validation failed',
      { error: error.message }
    );
  }
}

/**
 * Validates partial member update data
 * @param data - Raw update data
 * @returns Promise resolving to validated partial update data
 * @throws ValidationError if validation fails
 */
export async function validateUpdateMember(
  data: unknown
): Promise<Partial<z.infer<typeof updateMemberSchema>>> {
  try {
    const validatedData = await validatePartial(updateMemberSchema, data);

    // Ensure social profiles array operations are valid
    if (validatedData.socialProfiles) {
      if (!Array.isArray(validatedData.socialProfiles)) {
        throw new ValidationError(
          'Social profiles must be an array',
          { socialProfiles: 'Invalid format' }
        );
      }

      // Validate maximum number of social profiles
      const maxProfiles = 10;
      if (validatedData.socialProfiles.length > maxProfiles) {
        throw new ValidationError(
          `Cannot exceed ${maxProfiles} social profiles`,
          { socialProfiles: 'Too many profiles' }
        );
      }
    }

    return validatedData;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      'Member update validation failed',
      { error: error.message }
    );
  }
}

/**
 * Validates entity resolution request data with confidence thresholds
 * @param data - Raw entity resolution data
 * @returns Promise resolving to validated resolution data
 * @throws ValidationError if validation fails
 */
export async function validateEntityResolution(
  data: unknown
): Promise<z.infer<typeof resolveMemberEntitySchema>> {
  try {
    const validatedData = await validateSchema(resolveMemberEntitySchema, data);

    // Enforce minimum confidence threshold for auto-merge
    const AUTO_MERGE_THRESHOLD = 0.95;
    if (
      validatedData.resolution === 'MERGE' && 
      validatedData.confidence < AUTO_MERGE_THRESHOLD
    ) {
      throw new ValidationError(
        'Confidence threshold not met for auto-merge',
        {
          confidence: `Must be >= ${AUTO_MERGE_THRESHOLD} for auto-merge`,
          currentConfidence: validatedData.confidence
        }
      );
    }

    // Validate that source and target are different
    if (validatedData.sourceId === validatedData.targetId) {
      throw new ValidationError(
        'Source and target members must be different',
        {
          sourceId: validatedData.sourceId,
          targetId: validatedData.targetId
        }
      );
    }

    return validatedData;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      'Entity resolution validation failed',
      { error: error.message }
    );
  }
}