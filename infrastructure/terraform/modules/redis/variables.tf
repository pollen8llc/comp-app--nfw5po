# Terraform variables definition file for Redis Enterprise module configuration
# Defines required and optional parameters for Redis cluster deployment in AWS
# Version: hashicorp/terraform ~> 1.0

# Required Variables

variable "vpc_id" {
  description = "ID of the VPC where Redis cluster will be deployed"
  type        = string

  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must start with 'vpc-'."
  }
}

variable "subnet_ids" {
  description = "List of subnet IDs for Redis cluster deployment across multiple AZs"
  type        = list(string)

  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "At least 2 subnet IDs are required for high availability."
  }

  validation {
    condition     = alltrue([for s in var.subnet_ids : can(regex("^subnet-", s))])
    error_message = "All subnet IDs must start with 'subnet-'."
  }
}

# Optional Variables with Defaults

variable "environment" {
  description = "Deployment environment for resource naming and tagging"
  type        = string
  default     = "development"

  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production."
  }
}

variable "node_type" {
  description = "AWS ElastiCache node type for Redis instances"
  type        = string
  default     = "cache.t3.medium"

  validation {
    condition     = can(regex("^cache\\.", var.node_type))
    error_message = "Node type must be a valid AWS ElastiCache instance type starting with 'cache.'."
  }
}

variable "num_cache_clusters" {
  description = "Number of cache clusters in the replication group for high availability"
  type        = number
  default     = 2

  validation {
    condition     = var.num_cache_clusters >= 2 && var.num_cache_clusters <= 6 && var.num_cache_clusters % 2 == 0
    error_message = "Number of cache clusters must be an even number between 2 and 6."
  }
}

variable "port" {
  description = "Port number for Redis connections"
  type        = number
  default     = 6379

  validation {
    condition     = var.port >= 1024 && var.port <= 65535
    error_message = "Port number must be between 1024 and 65535."
  }
}

variable "parameter_group_family" {
  description = "Redis parameter group family version"
  type        = string
  default     = "redis7"

  validation {
    condition     = can(regex("^redis[7-9]", var.parameter_group_family))
    error_message = "Parameter group family must be redis7 or later."
  }
}

variable "automatic_failover_enabled" {
  description = "Enable automatic failover for multi-AZ deployment"
  type        = bool
  default     = true
}

variable "multi_az_enabled" {
  description = "Enable multi-AZ deployment for high availability"
  type        = bool
  default     = true
}

variable "at_rest_encryption_enabled" {
  description = "Enable encryption at rest for data security"
  type        = bool
  default     = true
}

variable "transit_encryption_enabled" {
  description = "Enable TLS encryption for data in transit"
  type        = bool
  default     = true
}

variable "snapshot_retention_limit" {
  description = "Number of days to retain automatic Redis snapshots"
  type        = number
  default     = 7

  validation {
    condition     = var.snapshot_retention_limit >= 0 && var.snapshot_retention_limit <= 35
    error_message = "Snapshot retention limit must be between 0 and 35 days."
  }
}

variable "maintenance_window" {
  description = "Weekly time range for system maintenance"
  type        = string
  default     = "sun:05:00-sun:09:00"

  validation {
    condition     = can(regex("^[a-z]{3}:[0-2][0-9]:[0-5][0-9]-[a-z]{3}:[0-2][0-9]:[0-5][0-9]$", var.maintenance_window))
    error_message = "Maintenance window must be in format ddd:hh24:mi-ddd:hh24:mi."
  }
}

variable "tags" {
  description = "Additional resource tags for Redis cluster"
  type        = map(string)
  default     = {}

  validation {
    condition     = can(lookup(var.tags, "environment", null)) && can(lookup(var.tags, "owner", null))
    error_message = "Tags must include 'environment' and 'owner' keys."
  }
}