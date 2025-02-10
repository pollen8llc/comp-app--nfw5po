// Neo4j database index creation script for Community Management Platform
// Implements optimized btree indexes for high-performance graph operations

// ===== Member Node Indexes =====

// Primary email lookup index with uniqueness
CREATE BTREE INDEX member_email_btree IF NOT EXISTS
FOR (m:Member) ON (m.email);

// Location-based member query index
CREATE BTREE INDEX member_location_btree IF NOT EXISTS
FOR (m:Member) ON (m.location);

// Temporal member query indexes
CREATE BTREE INDEX member_created_at_btree IF NOT EXISTS
FOR (m:Member) ON (m.created_at);

CREATE BTREE INDEX member_updated_at_btree IF NOT EXISTS
FOR (m:Member) ON (m.updated_at);

// ===== Event Node Indexes =====

// Text search index for event titles
CREATE BTREE INDEX event_title_btree IF NOT EXISTS
FOR (e:Event) ON (e.title);

// Composite index for platform integration
CREATE BTREE INDEX event_platform_external_id_btree IF NOT EXISTS
FOR (e:Event) ON (e.platform, e.external_id);

// Temporal event query indexes
CREATE BTREE INDEX event_start_date_btree IF NOT EXISTS
FOR (e:Event) ON (e.start_date);

// Location-based event query index
CREATE BTREE INDEX event_location_btree IF NOT EXISTS
FOR (e:Event) ON (e.location);

// ===== SocialProfile Node Indexes =====

// Composite index for profile resolution
CREATE BTREE INDEX social_profile_platform_external_id_btree IF NOT EXISTS
FOR (s:SocialProfile) ON (s.platform, s.external_id);

// Temporal profile sync tracking index
CREATE BTREE INDEX social_profile_created_at_btree IF NOT EXISTS
FOR (s:SocialProfile) ON (s.created_at);

// ===== EventMetadata Node Indexes =====

// Metadata lookup index
CREATE BTREE INDEX event_metadata_key_btree IF NOT EXISTS
FOR (em:EventMetadata) ON (em.key);

// Temporal metadata query index
CREATE BTREE INDEX event_metadata_created_at_btree IF NOT EXISTS
FOR (em:EventMetadata) ON (em.created_at);

// ===== Drop Legacy Indexes =====

// Drop any legacy indexes that may conflict with new btree indexes
DROP INDEX member_name_index IF EXISTS;
DROP INDEX member_location_index IF EXISTS;
DROP INDEX member_data_classification_index IF EXISTS;
DROP INDEX event_title_index IF EXISTS;
DROP INDEX event_platform_index IF EXISTS;
DROP INDEX event_date_index IF EXISTS;
DROP INDEX event_data_classification_index IF EXISTS;
DROP INDEX social_profile_platform_index IF EXISTS;
DROP INDEX social_profile_data_classification_index IF EXISTS;
DROP INDEX event_metadata_key_index IF EXISTS;
DROP INDEX event_metadata_data_classification_index IF EXISTS;