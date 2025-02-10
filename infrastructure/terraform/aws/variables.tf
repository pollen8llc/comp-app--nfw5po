# Terraform AWS variables configuration
# Version: ~> 1.5

# Environment variable with validation
variable "environment" {
  type        = string
  description = "Deployment environment (development, staging, production)"
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be one of: development, staging, production"
  }
}

# AWS region configuration
variable "aws_region" {
  type        = string
  description = "AWS region for resource deployment"
  default     = "us-west-2"
}

# Project name for resource identification
variable "project_name" {
  type        = string
  description = "Project name for resource naming and tagging"
  default     = "community-platform"
}

# Common resource tags
variable "tags" {
  type        = map(string)
  description = "Common tags to be applied to all resources"
  default = {
    Project    = "community-platform"
    ManagedBy  = "terraform"
  }
}

# Monitoring configuration flag
variable "enable_monitoring" {
  type        = bool
  description = "Flag to enable monitoring and observability tools"
  default     = true
}

# Backup retention configuration
variable "backup_retention_days" {
  type        = number
  description = "Number of days to retain backups for databases and storage"
  default     = 7
}