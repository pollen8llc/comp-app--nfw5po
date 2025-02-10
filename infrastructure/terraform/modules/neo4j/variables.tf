# Terraform variable definitions for Neo4j Enterprise cluster deployment
# Version: ~> 1.0

variable "cluster_name" {
  type        = string
  description = "Name identifier for the Neo4j Enterprise cluster"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where Neo4j cluster will be deployed"
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs for Neo4j cluster deployment across availability zones"
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type for ECS container instances running Neo4j nodes"
  default     = "r6i.2xlarge"  # Recommended for production Neo4j workloads
}

variable "cluster_size" {
  type        = number
  description = "Number of nodes in the Neo4j cluster (minimum 3 for HA)"
  default     = 3

  validation {
    condition     = var.cluster_size >= 3
    error_message = "Cluster size must be at least 3 nodes for high availability."
  }
}

variable "neo4j_version" {
  type        = string
  description = "Neo4j Enterprise version to deploy (must be 5.0 or higher)"
  default     = "5.11.0"

  validation {
    condition     = can(regex("^5\\.", var.neo4j_version))
    error_message = "Neo4j version must be 5.x.x or higher."
  }
}

variable "volume_size" {
  type        = number
  description = "Size in GB for EBS volume used for Neo4j data storage"
  default     = 500

  validation {
    condition     = var.volume_size >= 100
    error_message = "Volume size must be at least 100 GB."
  }
}

variable "backup_retention_days" {
  type        = number
  description = "Number of days to retain automated Neo4j backups"
  default     = 30

  validation {
    condition     = var.backup_retention_days >= 7
    error_message = "Backup retention must be at least 7 days."
  }
}

variable "encryption_key_arn" {
  type        = string
  description = "ARN of KMS key for encrypting Neo4j data at rest (AES-256)"
}

variable "monitoring_interval" {
  type        = number
  description = "Interval in seconds for CloudWatch monitoring metrics collection"
  default     = 60

  validation {
    condition     = contains([30, 60, 120], var.monitoring_interval)
    error_message = "Monitoring interval must be 30, 60, or 120 seconds."
  }
}

variable "enable_audit_logging" {
  type        = bool
  description = "Enable detailed audit logging for Neo4j operations"
  default     = true
}

variable "ssl_certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for TLS termination"
}

variable "allowed_cidr_blocks" {
  type        = list(string)
  description = "List of CIDR blocks allowed to access Neo4j cluster"
  default     = []
}

variable "tags" {
  type        = map(string)
  description = "Resource tags for Neo4j infrastructure components"
  default = {
    Terraform   = "true"
    Service     = "neo4j"
    Managed-by  = "terraform"
  }
}

variable "maintenance_window" {
  type        = string
  description = "Preferred maintenance window for Neo4j cluster updates (UTC)"
  default     = "sun:03:00-sun:05:00"

  validation {
    condition     = can(regex("^[a-z]{3}:[0-2][0-9]:[0-5][0-9]-[a-z]{3}:[0-2][0-9]:[0-5][0-9]$", var.maintenance_window))
    error_message = "Maintenance window must be in format 'ddd:hh:mm-ddd:hh:mm'."
  }
}