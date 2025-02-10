# Project name for consistent resource naming
variable "project" {
  type        = string
  description = "Project name used for resource naming and tagging"
  default     = "community-platform"
}

# Environment name for deployment isolation
variable "environment" {
  type        = string
  description = "Environment name for resource isolation (dev/staging/prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Domain configuration for Route53 and CloudFront
variable "domain_name" {
  type        = string
  description = "Domain name for the web application (e.g., community-platform.com)"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid domain format"
  }
}

# Container image configuration
variable "container_image" {
  type        = string
  description = "ECR image URI for the web application container (e.g., {account}.dkr.ecr.{region}.amazonaws.com/{project}:{tag})"
}

# Container port configuration
variable "container_port" {
  type        = number
  description = "Container port for the Next.js web application"
  default     = 3000
}

# ECS task configuration
variable "desired_count" {
  type        = number
  description = "Initial number of ECS tasks to run"
  default     = 2
}

variable "min_count" {
  type        = number
  description = "Minimum number of ECS tasks for auto-scaling"
  default     = 2
}

variable "max_count" {
  type        = number
  description = "Maximum number of ECS tasks for auto-scaling"
  default     = 6
}

variable "cpu" {
  type        = number
  description = "CPU units for ECS task (1024 = 1 vCPU)"
  default     = 1024
}

variable "memory" {
  type        = number
  description = "Memory allocation for ECS task in MiB"
  default     = 2048
}

# Health check configuration
variable "health_check_path" {
  type        = string
  description = "Health check endpoint path for ALB target group"
  default     = "/api/health"
}

# SSL/TLS configuration
variable "ssl_certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for HTTPS/TLS termination"
}

# CloudFront configuration
variable "cdn_price_class" {
  type        = string
  description = "CloudFront distribution price class (PriceClass_100, PriceClass_200, PriceClass_All)"
  default     = "PriceClass_100"
}

# VPC configuration imported from networking module
variable "vpc_id" {
  type        = string
  description = "ID of the VPC where resources will be deployed"
}

variable "public_subnet_ids" {
  type        = list(string)
  description = "List of public subnet IDs for ALB deployment"
}

# Tags for resource management
variable "tags" {
  type        = map(string)
  description = "Additional tags for all resources"
  default     = {}
}

# Auto-scaling configuration
variable "cpu_threshold" {
  type        = number
  description = "CPU utilization threshold percentage for auto-scaling"
  default     = 70
}

variable "memory_threshold" {
  type        = number
  description = "Memory utilization threshold percentage for auto-scaling"
  default     = 80
}

# WAF configuration
variable "enable_waf" {
  type        = bool
  description = "Enable AWS WAF for the CloudFront distribution"
  default     = true
}

# CloudFront logging
variable "enable_cdn_logging" {
  type        = bool
  description = "Enable CloudFront access logging to S3"
  default     = true
}

# Route53 configuration
variable "create_dns_record" {
  type        = bool
  description = "Create Route53 DNS record for the domain"
  default     = true
}