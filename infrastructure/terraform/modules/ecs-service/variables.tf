# Variable definitions for ECS service module
# Version: ~> 1.5

# Service name configuration
variable "service_name" {
  type        = string
  description = "Name of the ECS service for deployment"
  
  validation {
    condition     = can(regex("^[a-zA-Z0-9-]+$", var.service_name))
    error_message = "Service name must only contain alphanumeric characters and hyphens"
  }
}

# ECS cluster configuration
variable "cluster_id" {
  type        = string
  description = "ID of the ECS cluster where the service will be deployed"
}

# Task definition configuration
variable "task_definition" {
  type = object({
    family                   = string
    container_definitions    = string
    cpu                     = number
    memory                  = number
    network_mode            = string
    requires_compatibilities = list(string)
    execution_role_arn      = string
    task_role_arn           = string
  })
  description = "Detailed task definition configuration including container settings"
}

# Network configuration
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where the service will be deployed"
}

variable "subnet_ids" {
  type        = list(string)
  description = "List of subnet IDs where the service tasks will be placed"
}

variable "security_groups" {
  type        = list(string)
  description = "List of security group IDs to attach to the service"
}

# Scaling configuration
variable "desired_count" {
  type        = number
  description = "Desired number of tasks to run for the service"
  default     = 2
  
  validation {
    condition     = var.desired_count > 0
    error_message = "Desired count must be greater than 0"
  }
}

variable "min_capacity" {
  type        = number
  description = "Minimum number of tasks for auto-scaling"
  default     = 1
  
  validation {
    condition     = var.min_capacity > 0
    error_message = "Minimum capacity must be greater than 0"
  }
}

variable "max_capacity" {
  type        = number
  description = "Maximum number of tasks for auto-scaling"
  default     = 4
  
  validation {
    condition     = var.max_capacity >= var.min_capacity
    error_message = "Maximum capacity must be greater than or equal to minimum capacity"
  }
}

# Auto-scaling thresholds
variable "cpu_threshold" {
  type        = number
  description = "CPU utilization threshold percentage for auto-scaling"
  default     = 70
  
  validation {
    condition     = var.cpu_threshold > 0 && var.cpu_threshold <= 100
    error_message = "CPU threshold must be between 1 and 100"
  }
}

variable "memory_threshold" {
  type        = number
  description = "Memory utilization threshold percentage for auto-scaling"
  default     = 80
  
  validation {
    condition     = var.memory_threshold > 0 && var.memory_threshold <= 100
    error_message = "Memory threshold must be between 1 and 100"
  }
}

# Health check configuration
variable "health_check_path" {
  type        = string
  description = "Path for the ALB health check endpoint"
  default     = "/health"
}

variable "health_check_grace_period" {
  type        = number
  description = "Grace period in seconds before health checks begin"
  default     = 60
  
  validation {
    condition     = var.health_check_grace_period >= 0
    error_message = "Health check grace period must be greater than or equal to 0"
  }
}

# Scaling cooldown period
variable "scaling_cooldown" {
  type        = number
  description = "Cooldown period in seconds between scaling activities"
  default     = 300
  
  validation {
    condition     = var.scaling_cooldown >= 0
    error_message = "Scaling cooldown must be greater than or equal to 0"
  }
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Resource tags to be applied to all created resources"
  default     = {}
}