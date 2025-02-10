# Environment configuration
variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod"
  }
}

# Service configuration
variable "service_name" {
  type        = string
  default     = "api-gateway"
  description = "Name of the API Gateway service"
}

variable "container_image" {
  type        = string
  description = "Docker image for API Gateway service (format: repository/image:tag)"
}

variable "container_port" {
  type        = number
  default     = 3000
  description = "Container port for API Gateway service"
}

# Scaling configuration
variable "desired_count" {
  type        = number
  default     = 2
  description = "Desired number of API Gateway tasks"
  validation {
    condition     = var.desired_count >= 2
    error_message = "Desired count must be at least 2 for high availability"
  }
}

# Resource allocation
variable "cpu" {
  type        = number
  default     = 1024
  description = "CPU units for API Gateway container (1024 = 1 vCPU)"
}

variable "memory" {
  type        = number
  default     = 2048
  description = "Memory units for API Gateway container in MB"
}

# Health check configuration
variable "health_check_path" {
  type        = string
  default     = "/health"
  description = "Health check endpoint for API Gateway service"
}

# Domain configuration
variable "domain_name" {
  type        = string
  description = "Domain name for API Gateway service"
}

# Auto-scaling configuration
variable "enable_autoscaling" {
  type        = bool
  default     = true
  description = "Flag to enable auto-scaling for API Gateway service"
}

variable "autoscaling_min_capacity" {
  type        = number
  default     = 2
  description = "Minimum number of tasks for auto-scaling"
}

variable "autoscaling_max_capacity" {
  type        = number
  default     = 6
  description = "Maximum number of tasks for auto-scaling"
}

variable "cpu_threshold" {
  type        = number
  default     = 70
  description = "CPU utilization threshold for scaling (percentage)"
}

variable "memory_threshold" {
  type        = number
  default     = 80
  description = "Memory utilization threshold for scaling (percentage)"
}

# Load balancer configuration
variable "deregistration_delay" {
  type        = number
  default     = 30
  description = "Time in seconds to wait before deregistering task"
}

variable "health_check_interval" {
  type        = number
  default     = 30
  description = "Time in seconds between health checks"
}

variable "health_check_timeout" {
  type        = number
  default     = 5
  description = "Time in seconds to wait for health check response"
}

variable "healthy_threshold" {
  type        = number
  default     = 2
  description = "Number of consecutive health check successes before considering target healthy"
}

variable "unhealthy_threshold" {
  type        = number
  default     = 3
  description = "Number of consecutive health check failures before considering target unhealthy"
}

# Resource tagging
variable "tags" {
  type        = map(string)
  default     = {}
  description = "Resource tags for API Gateway infrastructure"
}

# Security configuration
variable "enable_access_logs" {
  type        = bool
  default     = true
  description = "Enable access logs for the load balancer"
}

variable "access_logs_retention" {
  type        = number
  default     = 90
  description = "Number of days to retain access logs"
}

variable "ssl_policy" {
  type        = string
  default     = "ELBSecurityPolicy-TLS-1-2-2017-01"
  description = "SSL policy for HTTPS listeners"
}

# Networking configuration
variable "vpc_config" {
  type = object({
    vpc_id     = string
    subnet_ids = list(string)
  })
  description = "VPC configuration for API Gateway deployment"
}