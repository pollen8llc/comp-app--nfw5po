# Environment variable for resource tagging and configuration
variable "environment" {
  type        = string
  description = "Environment name (e.g., dev, staging, prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# VPC configuration
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where storage resources will be deployed"
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs for storage resources placement"
}

# S3 configuration
variable "s3_bucket_name" {
  type        = string
  description = "Name of the S3 bucket for file storage"
}

variable "s3_versioning_enabled" {
  type        = bool
  description = "Enable versioning for S3 bucket"
  default     = true
}

variable "s3_lifecycle_rules" {
  type = list(object({
    id                       = string
    enabled                 = bool
    prefix                  = string
    transition_days         = number
    transition_storage_class = string
    expiration_days         = number
  }))
  description = "Lifecycle rules for S3 bucket data retention and archival"
  default = [
    {
      id                       = "archive-after-2-years"
      enabled                 = true
      prefix                  = ""
      transition_days         = 730
      transition_storage_class = "GLACIER"
      expiration_days         = 2555  # 7 years retention
    }
  ]
}

# Neo4j configuration
variable "neo4j_instance_type" {
  type        = string
  description = "EC2 instance type for Neo4j Enterprise cluster nodes"
  default     = "r6g.2xlarge"  # Optimized for memory-intensive graph operations
}

variable "neo4j_cluster_size" {
  type        = number
  description = "Number of nodes in Neo4j Enterprise cluster"
  default     = 3  # Minimum recommended for HA
}

variable "neo4j_version" {
  type        = string
  description = "Neo4j Enterprise version to deploy"
  default     = "5.5.0"  # Latest stable Enterprise version
}

# Redis configuration
variable "redis_node_type" {
  type        = string
  description = "ElastiCache node type for Redis Enterprise cluster"
  default     = "cache.r6g.xlarge"  # Memory-optimized for caching
}

variable "redis_version" {
  type        = string
  description = "Redis Enterprise version to deploy"
  default     = "7.0"  # Latest stable Enterprise version
}

variable "redis_num_shards" {
  type        = number
  description = "Number of shards in Redis Enterprise cluster"
  default     = 3  # Balanced for performance and availability
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Tags to apply to all storage resources"
  default     = {
    Terraform   = "true"
    Application = "community-platform"
  }
}