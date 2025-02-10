# Environment variable with validation for allowed values
variable "environment" {
  type        = string
  description = "Deployment environment (dev/staging/prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# AWS region specification
variable "aws_region" {
  type        = string
  description = "AWS region for service deployment"
}

# VPC configuration
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where the service will be deployed"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs for service deployment"
}

# ECS configuration
variable "ecs_cluster_id" {
  type        = string
  description = "ID of the ECS cluster for service deployment"
}

variable "container_image" {
  type        = string
  description = "Docker image for the event service container"
}

variable "container_port" {
  type        = number
  default     = 4001
  description = "Port exposed by the event service container"
}

# Service scaling configuration
variable "min_capacity" {
  type        = number
  default     = 2
  description = "Minimum number of tasks for the service"
}

variable "max_capacity" {
  type        = number
  default     = 4
  description = "Maximum number of tasks for the service"
}

# Container resource allocation
variable "cpu_units" {
  type        = number
  default     = 1024
  description = "CPU units allocated to the event service container (1024 = 1 vCPU)"
}

variable "memory_mb" {
  type        = number
  default     = 2048
  description = "Memory allocated to the event service container in MB"
}

# Event platform integration keys
variable "eventbrite_api_key" {
  type        = string
  description = "Eventbrite API key for event integration"
  sensitive   = true
}

variable "luma_api_key" {
  type        = string
  description = "Luma API key for event integration"
  sensitive   = true
}

variable "partiful_api_key" {
  type        = string
  description = "Partiful API key for event integration"
  sensitive   = true
}

# Resource tagging
variable "tags" {
  type        = map(string)
  description = "Resource tags to be applied to all created resources"
  default     = {
    Service     = "event-service"
    Terraform   = "true"
  }
}