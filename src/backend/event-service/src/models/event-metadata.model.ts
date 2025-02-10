import { z } from 'zod'; // v3.22.0
import { EventMetadata } from '../../shared/types/event.types';
import { eventMetadataSchema } from '../../shared/schemas/event.schema';
import { DataClassification } from '../../shared/types/event.types';

/**
 * Model class for handling event metadata with comprehensive validation,
 * secure Neo4j integration, and platform-specific transformations.
 * Implements data classification requirements from section 7.2.2
 */
export class EventMetadataModel {
  private readonly tags: Record<string, string>;
  private readonly categories: string[];
  private readonly capacity: number;
  private readonly is_private: boolean;
  private readonly dataClassification: DataClassification;
  private readonly lastModifiedAt: Date;
  private readonly lastModifiedBy: string;
  private readonly version: string = '1.0.0';

  /**
   * Creates a new event metadata instance with enhanced validation and security checks
   * @param data The event metadata input data
   * @throws {Error} If validation fails or security constraints are not met
   */
  constructor(data: EventMetadata) {
    // Validate input data using schema
    const validatedData = eventMetadataSchema.parse({
      ...data,
      version: this.version
    });

    // Validate and normalize tags
    this.validateTags(validatedData.tags);
    this.tags = this.normalizeTags(validatedData.tags);

    // Validate categories
    this.validateCategories(validatedData.categories);
    this.categories = [...validatedData.categories];

    // Validate capacity
    this.validateCapacity(validatedData.capacity);
    this.capacity = validatedData.capacity;

    // Set privacy flag
    this.is_private = validatedData.is_private;

    // Set audit fields
    this.dataClassification = validatedData.dataClassification;
    this.lastModifiedAt = new Date();
    this.lastModifiedBy = validatedData.lastModifiedBy;
  }

  /**
   * Converts metadata to a secure JSON representation with proper type handling
   * @returns Sanitized JSON representation of metadata
   */
  public toJSON(): EventMetadata {
    return {
      tags: { ...this.tags },
      categories: [...this.categories],
      capacity: this.capacity,
      is_private: this.is_private,
      dataClassification: this.dataClassification,
      lastModifiedBy: this.lastModifiedBy,
      lastModifiedAt: this.lastModifiedAt
    };
  }

  /**
   * Transforms metadata to optimized Neo4j node properties with security considerations
   * @returns Neo4j optimized property object
   */
  public toNeo4j(): Record<string, any> {
    return {
      tags: JSON.stringify(this.tags), // Neo4j doesn't support native objects
      categories: this.categories,
      capacity: this.capacity,
      is_private: this.is_private,
      dataClassification: this.dataClassification,
      lastModifiedBy: this.lastModifiedBy,
      lastModifiedAt: this.lastModifiedAt.toISOString(),
      version: this.version,
      _type: 'EventMetadata' // Type discriminator for Neo4j
    };
  }

  /**
   * Performs comprehensive validation of metadata with enhanced security checks
   * @returns boolean indicating if the metadata is valid
   * @throws {Error} If validation fails with detailed context
   */
  public validate(): boolean {
    try {
      // Revalidate using schema
      eventMetadataSchema.parse(this.toJSON());

      // Additional security validations
      this.validateSecurityConstraints();

      // Additional Neo4j compatibility checks
      this.validateNeo4jConstraints();

      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Validates and normalizes tag data
   * @param tags Raw tag data
   * @throws {Error} If tag validation fails
   */
  private validateTags(tags: Record<string, string>): void {
    const tagCount = Object.keys(tags).length;
    if (tagCount > 20) {
      throw new Error('Maximum of 20 tags allowed per event');
    }

    // Validate tag keys and values
    for (const [key, value] of Object.entries(tags)) {
      if (key.length > 50) {
        throw new Error(`Tag key '${key}' exceeds maximum length of 50 characters`);
      }
      if (value.length > 100) {
        throw new Error(`Tag value for '${key}' exceeds maximum length of 100 characters`);
      }
      // Check for invalid characters that might cause Neo4j issues
      if (!/^[\w\s-]+$/.test(key) || !/^[\w\s-]+$/.test(value)) {
        throw new Error(`Tag '${key}' or its value contains invalid characters`);
      }
    }
  }

  /**
   * Normalizes tags for consistent storage and retrieval
   * @param tags Raw tag data
   * @returns Normalized tag object
   */
  private normalizeTags(tags: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags)) {
      normalized[key.trim().toLowerCase()] = value.trim();
    }
    return normalized;
  }

  /**
   * Validates category data
   * @param categories Array of categories
   * @throws {Error} If category validation fails
   */
  private validateCategories(categories: string[]): void {
    if (categories.length === 0) {
      throw new Error('At least one category is required');
    }
    if (categories.length > 5) {
      throw new Error('Maximum of 5 categories allowed');
    }

    const validCategories = new Set([
      'conference', 'workshop', 'networking', 'social',
      'professional', 'education', 'other'
    ]);

    for (const category of categories) {
      if (!validCategories.has(category.toLowerCase())) {
        throw new Error(`Invalid category: ${category}`);
      }
    }
  }

  /**
   * Validates capacity constraints
   * @param capacity Event capacity number
   * @throws {Error} If capacity validation fails
   */
  private validateCapacity(capacity: number): void {
    if (!Number.isInteger(capacity)) {
      throw new Error('Capacity must be an integer');
    }
    if (capacity <= 0) {
      throw new Error('Capacity must be positive');
    }
    if (capacity > 10000) {
      throw new Error('Capacity cannot exceed 10000');
    }
  }

  /**
   * Validates security constraints for the metadata
   * @throws {Error} If security validation fails
   */
  private validateSecurityConstraints(): void {
    // Validate data classification
    if (!Object.values(DataClassification).includes(this.dataClassification)) {
      throw new Error('Invalid data classification level');
    }

    // Validate audit fields
    if (!this.lastModifiedBy || !this.lastModifiedAt) {
      throw new Error('Audit fields are required');
    }

    // Additional security checks based on privacy setting
    if (this.is_private && this.dataClassification === DataClassification.PUBLIC) {
      throw new Error('Private events cannot have PUBLIC data classification');
    }
  }

  /**
   * Validates Neo4j specific constraints
   * @throws {Error} If Neo4j compatibility validation fails
   */
  private validateNeo4jConstraints(): void {
    // Validate property names for Neo4j compatibility
    const neo4jData = this.toNeo4j();
    for (const key of Object.keys(neo4jData)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        throw new Error(`Invalid property name for Neo4j: ${key}`);
      }
    }

    // Validate property values for Neo4j compatibility
    for (const value of Object.values(neo4jData)) {
      if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        if (!this.isValidNeo4jObject(value)) {
          throw new Error('Invalid property value for Neo4j');
        }
      }
    }
  }

  /**
   * Checks if an object is valid for Neo4j storage
   * @param obj Object to validate
   * @returns boolean indicating if the object is valid for Neo4j
   */
  private isValidNeo4jObject(obj: any): boolean {
    try {
      JSON.stringify(obj);
      return true;
    } catch {
      return false;
    }
  }
}