// Initial Neo4j database schema migration for Community Management Platform
// Implements secure graph database schema with audit capabilities and data classification

// ===== Member Node Constraints =====

// Unique constraints
CREATE CONSTRAINT member_id_unique IF NOT EXISTS
FOR (m:Member) REQUIRE m.id IS UNIQUE;

CREATE CONSTRAINT member_email_unique IF NOT EXISTS 
FOR (m:Member) REQUIRE m.email IS UNIQUE;

// Property existence constraints
CREATE CONSTRAINT member_required_properties IF NOT EXISTS
FOR (m:Member) REQUIRE
  m.id IS NOT NULL AND
  m.email IS NOT NULL AND
  m.name IS NOT NULL AND
  m.data_classification IS NOT NULL AND
  m.created_at IS NOT NULL AND
  m.updated_at IS NOT NULL AND
  m.created_by IS NOT NULL AND
  m.updated_by IS NOT NULL AND
  m.encryption_key_version IS NOT NULL;

// ===== Event Node Constraints =====

// Unique constraints
CREATE CONSTRAINT event_id_unique IF NOT EXISTS
FOR (e:Event) REQUIRE e.id IS UNIQUE;

// Composite constraint for platform events
CREATE CONSTRAINT event_platform_external_id IF NOT EXISTS
FOR (e:Event) REQUIRE (e.platform, e.external_id) IS UNIQUE;

// Property existence constraints
CREATE CONSTRAINT event_required_properties IF NOT EXISTS
FOR (e:Event) REQUIRE
  e.id IS NOT NULL AND
  e.title IS NOT NULL AND
  e.start_date IS NOT NULL AND
  e.end_date IS NOT NULL AND
  e.location IS NOT NULL AND
  e.platform IS NOT NULL AND
  e.data_classification IS NOT NULL AND
  e.created_at IS NOT NULL AND
  e.updated_at IS NOT NULL AND
  e.created_by IS NOT NULL AND
  e.updated_by IS NOT NULL;

// ===== SocialProfile Node Constraints =====

// Unique constraints
CREATE CONSTRAINT social_profile_id_unique IF NOT EXISTS
FOR (s:SocialProfile) REQUIRE s.id IS UNIQUE;

// Composite constraint for platform profiles
CREATE CONSTRAINT social_profile_platform_external_id IF NOT EXISTS
FOR (s:SocialProfile) REQUIRE (s.platform, s.external_id) IS UNIQUE;

// Property existence constraints
CREATE CONSTRAINT social_profile_required_properties IF NOT EXISTS
FOR (s:SocialProfile) REQUIRE
  s.id IS NOT NULL AND
  s.platform IS NOT NULL AND
  s.external_id IS NOT NULL AND
  s.auth_data IS NOT NULL AND
  s.data_classification IS NOT NULL AND
  s.created_at IS NOT NULL AND
  s.updated_at IS NOT NULL AND
  s.created_by IS NOT NULL AND
  s.updated_by IS NOT NULL AND
  s.encryption_key_version IS NOT NULL;

// ===== EventMetadata Node Constraints =====

// Unique constraints
CREATE CONSTRAINT event_metadata_id_unique IF NOT EXISTS
FOR (em:EventMetadata) REQUIRE em.id IS UNIQUE;

// Property existence constraints
CREATE CONSTRAINT event_metadata_required_properties IF NOT EXISTS
FOR (em:EventMetadata) REQUIRE
  em.id IS NOT NULL AND
  em.key IS NOT NULL AND
  em.value IS NOT NULL AND
  em.data_classification IS NOT NULL AND
  em.created_at IS NOT NULL AND
  em.created_by IS NOT NULL;

// ===== Relationship Property Constraints =====

// KNOWS relationship
CREATE CONSTRAINT knows_relationship_required_properties IF NOT EXISTS
FOR ()-[r:KNOWS]-() REQUIRE
  r.created_at IS NOT NULL AND
  r.created_by IS NOT NULL;

// ATTENDED relationship
CREATE CONSTRAINT attended_relationship_required_properties IF NOT EXISTS
FOR ()-[r:ATTENDED]-() REQUIRE
  r.timestamp IS NOT NULL AND
  r.created_at IS NOT NULL AND
  r.created_by IS NOT NULL;

// HAS_PROFILE relationship
CREATE CONSTRAINT has_profile_relationship_required_properties IF NOT EXISTS
FOR ()-[r:HAS_PROFILE]-() REQUIRE
  r.verified IS NOT NULL AND
  r.last_sync IS NOT NULL AND
  r.created_at IS NOT NULL AND
  r.created_by IS NOT NULL;

// HAS_METADATA relationship
CREATE CONSTRAINT has_metadata_relationship_required_properties IF NOT EXISTS
FOR ()-[r:HAS_METADATA]-() REQUIRE
  r.timestamp IS NOT NULL AND
  r.created_at IS NOT NULL AND
  r.created_by IS NOT NULL;

// ===== Indexes for Performance =====

// Member indexes
CREATE INDEX member_name_index IF NOT EXISTS FOR (m:Member) ON (m.name);
CREATE INDEX member_location_index IF NOT EXISTS FOR (m:Member) ON (m.location);
CREATE INDEX member_data_classification_index IF NOT EXISTS FOR (m:Member) ON (m.data_classification);

// Event indexes
CREATE INDEX event_title_index IF NOT EXISTS FOR (e:Event) ON (e.title);
CREATE INDEX event_platform_index IF NOT EXISTS FOR (e:Event) ON (e.platform);
CREATE INDEX event_date_index IF NOT EXISTS FOR (e:Event) ON (e.start_date, e.end_date);
CREATE INDEX event_data_classification_index IF NOT EXISTS FOR (e:Event) ON (e.data_classification);

// SocialProfile indexes
CREATE INDEX social_profile_platform_index IF NOT EXISTS FOR (s:SocialProfile) ON (s.platform);
CREATE INDEX social_profile_data_classification_index IF NOT EXISTS FOR (s:SocialProfile) ON (s.data_classification);

// EventMetadata indexes
CREATE INDEX event_metadata_key_index IF NOT EXISTS FOR (em:EventMetadata) ON (em.key);
CREATE INDEX event_metadata_data_classification_index IF NOT EXISTS FOR (em:EventMetadata) ON (em.data_classification);