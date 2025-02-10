// Neo4j database constraints migration for Community Management Platform
// Implements comprehensive data integrity and security constraints for knowledge graph

// ===== Member Node Advanced Constraints =====

// Create uniqueness constraints for Member nodes
CREATE CONSTRAINT member_id_unique IF NOT EXISTS
FOR (m:Member) REQUIRE m.id IS UNIQUE;

CREATE CONSTRAINT member_email_unique IF NOT EXISTS
FOR (m:Member) REQUIRE m.email IS UNIQUE;

// Create existence constraints for required Member properties
CREATE CONSTRAINT member_required_properties IF NOT EXISTS
FOR (m:Member) REQUIRE
  m.id IS NOT NULL AND
  m.email IS NOT NULL AND
  m.name IS NOT NULL AND
  m.created_at IS NOT NULL AND
  m.updated_at IS NOT NULL AND
  m.data_classification IS NOT NULL AND
  m.encryption_level IS NOT NULL;

// Create property type constraints for Member nodes
CREATE CONSTRAINT member_email_type IF NOT EXISTS
FOR (m:Member) REQUIRE m.email IS STRING;

CREATE CONSTRAINT member_name_length IF NOT EXISTS
FOR (m:Member) REQUIRE size(m.name) >= 2;

// ===== Event Node Advanced Constraints =====

// Create uniqueness constraints for Event nodes
CREATE CONSTRAINT event_id_unique IF NOT EXISTS
FOR (e:Event) REQUIRE e.id IS UNIQUE;

// Create composite uniqueness constraint for platform events
CREATE CONSTRAINT event_platform_external_id IF NOT EXISTS
FOR (e:Event) REQUIRE (e.platform, e.external_id) IS UNIQUE;

// Create existence constraints for required Event properties
CREATE CONSTRAINT event_required_properties IF NOT EXISTS
FOR (e:Event) REQUIRE
  e.id IS NOT NULL AND
  e.title IS NOT NULL AND
  e.start_date IS NOT NULL AND
  e.end_date IS NOT NULL AND
  e.location IS NOT NULL AND
  e.platform IS NOT NULL AND
  e.created_at IS NOT NULL AND
  e.updated_at IS NOT NULL;

// Create temporal constraint for Event dates
CREATE CONSTRAINT event_date_validity IF NOT EXISTS
FOR (e:Event) REQUIRE e.start_date <= e.end_date;

// Create property type constraints for Event nodes
CREATE CONSTRAINT event_platform_type IF NOT EXISTS
FOR (e:Event) REQUIRE e.platform IS STRING;

// ===== SocialProfile Node Advanced Constraints =====

// Create uniqueness constraints for SocialProfile nodes
CREATE CONSTRAINT social_profile_id_unique IF NOT EXISTS
FOR (s:SocialProfile) REQUIRE s.id IS UNIQUE;

// Create composite uniqueness constraint for platform profiles
CREATE CONSTRAINT social_profile_platform_external_id IF NOT EXISTS
FOR (s:SocialProfile) REQUIRE (s.platform, s.external_id) IS UNIQUE;

// Create existence constraints for required SocialProfile properties
CREATE CONSTRAINT social_profile_required_properties IF NOT EXISTS
FOR (s:SocialProfile) REQUIRE
  s.id IS NOT NULL AND
  s.platform IS NOT NULL AND
  s.external_id IS NOT NULL AND
  s.created_at IS NOT NULL AND
  s.updated_at IS NOT NULL AND
  s.encryption_level IS NOT NULL AND
  s.data_classification IS NOT NULL;

// Create property type constraints for SocialProfile nodes
CREATE CONSTRAINT social_profile_platform_type IF NOT EXISTS
FOR (s:SocialProfile) REQUIRE s.platform IS STRING;

// ===== EventMetadata Node Advanced Constraints =====

// Create uniqueness constraints for EventMetadata nodes
CREATE CONSTRAINT event_metadata_id_unique IF NOT EXISTS
FOR (em:EventMetadata) REQUIRE em.id IS UNIQUE;

// Create existence constraints for required EventMetadata properties
CREATE CONSTRAINT event_metadata_required_properties IF NOT EXISTS
FOR (em:EventMetadata) REQUIRE
  em.id IS NOT NULL AND
  em.key IS NOT NULL AND
  em.value IS NOT NULL AND
  em.created_at IS NOT NULL;

// Create property type constraints for EventMetadata nodes
CREATE CONSTRAINT event_metadata_key_type IF NOT EXISTS
FOR (em:EventMetadata) REQUIRE em.key IS STRING;

CREATE CONSTRAINT event_metadata_value_type IF NOT EXISTS
FOR (em:EventMetadata) REQUIRE em.value IS STRING;

// Create property length constraint for metadata keys
CREATE CONSTRAINT event_metadata_key_length IF NOT EXISTS
FOR (em:EventMetadata) REQUIRE size(em.key) <= 100;

// ===== Relationship Advanced Constraints =====

// Create existence constraints for KNOWS relationship properties
CREATE CONSTRAINT knows_relationship_properties IF NOT EXISTS
FOR ()-[r:KNOWS]-() REQUIRE
  r.strength IS NOT NULL AND
  r.last_interaction IS NOT NULL;

// Create existence constraints for ATTENDED relationship properties
CREATE CONSTRAINT attended_relationship_properties IF NOT EXISTS
FOR ()-[r:ATTENDED]-() REQUIRE
  r.role IS NOT NULL AND
  r.timestamp IS NOT NULL;

// Create existence constraints for HAS_PROFILE relationship properties
CREATE CONSTRAINT has_profile_relationship_properties IF NOT EXISTS
FOR ()-[r:HAS_PROFILE]-() REQUIRE
  r.verified IS NOT NULL AND
  r.last_sync IS NOT NULL;

// Create existence constraints for HAS_METADATA relationship properties
CREATE CONSTRAINT has_metadata_relationship_properties IF NOT EXISTS
FOR ()-[r:HAS_METADATA]-() REQUIRE
  r.source IS NOT NULL AND
  r.timestamp IS NOT NULL;

// ===== Data Classification Constraints =====

// Create property value constraints for data classification
CREATE CONSTRAINT data_classification_values IF NOT EXISTS
FOR (n) WHERE n.data_classification IS NOT NULL
REQUIRE n.data_classification IN ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];

// Create property value constraints for encryption levels
CREATE CONSTRAINT encryption_level_values IF NOT EXISTS
FOR (n) WHERE n.encryption_level IS NOT NULL
REQUIRE n.encryption_level IN ['NONE', 'STANDARD', 'HIGH'];

// Create property value constraints for platform types
CREATE CONSTRAINT platform_type_values IF NOT EXISTS
FOR (n) WHERE n.platform IS NOT NULL
REQUIRE n.platform IN ['LINKEDIN', 'GMAIL', 'LUMA', 'EVENTBRITE', 'PARTIFUL'];