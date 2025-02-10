# Analytics Service Variables for Community Management Platform
# Version: ~> 1.5

# Service name configuration
variable "service_name" {
  type        = string
  description = "Name of the analytics service for resource identification"
  default     = "analytics-service"
}

# Container image configuration
variable "container_image" {
  type        = string
  description = "Docker image URI for the Python analytics service (format: {repository_url}:{tag})"
}

# Container CPU configuration (2 vCPU = 2048)
variable "container_cpu" {
  type        = number
  description = "CPU units to allocate to the analytics container (1 vCPU = 1024 units)"
  default     = 2048 # 2 vCPU as per technical specification
}

# Container memory configuration (4GB = 4096)
variable "container_memory" {
  type        = number
  description = "Memory to allocate to the analytics container in MB"
  default     = 4096 # 4GB as per technical specification
}

# Service scaling configuration
variable "desired_count" {
  type        = number
  description = "Desired number of analytics service tasks to run"
  default     = 1
}

variable "min_capacity" {
  type        = number
  description = "Minimum number of tasks for auto-scaling"
  default     = 1 # Minimum 1 task for high availability
}

variable "max_capacity" {
  type        = number
  description = "Maximum number of tasks for auto-scaling"
  default     = 2 # Maximum 2 tasks as per technical specification
}

variable "cpu_threshold" {
  type        = number
  description = "CPU utilization threshold percentage for auto-scaling"
  default     = 80 # Scale when CPU reaches 80% as per technical specification
}

# Environment variables for service configuration
variable "environment_variables" {
  type        = map(string)
  description = "Environment variables for the analytics service"
  default = {
    NEO4J_URI             = ""
    NEO4J_USER           = ""
    REDIS_HOST           = ""
    REDIS_PORT           = "6379"
    TDA_EPSILON          = "0.5"
    TDA_MIN_POINTS       = "15"
    TDA_DIMENSION        = "2"
    MAX_COMPUTATION_TIME = "5000" # 5 seconds as per performance requirements
    HEALTH_CHECK_INTERVAL = "30"
  }
}

# Health check configuration
variable "health_check_path" {
  type        = string
  description = "Health check endpoint path for the analytics service"
  default     = "/health"
}

# Resource tagging configuration
variable "tags" {
  type        = map(string)
  description = "Resource tags for the analytics service infrastructure"
  default = {
    Service     = "analytics"
    Component   = "computation"
    Team        = "data-science"
  }
}

# Port configuration
variable "container_port" {
  type        = number
  description = "Port number the analytics service container listens on"
  default     = 5000
}

# Auto-scaling cooldown period
variable "scaling_cooldown" {
  type        = number
  description = "Cooldown period in seconds between scaling activities"
  default     = 300 # 5 minutes
}

# Health check configuration
variable "health_check_grace_period" {
  type        = number
  description = "Grace period in seconds for health check during task startup"
  default     = 60 # As per technical specification
}

# Task definition configuration
variable "task_role_arn" {
  type        = string
  description = "ARN of the IAM role that the analytics service tasks will use"
}

variable "execution_role_arn" {
  type        = string
  description = "ARN of the IAM role that the ECS service will use to pull container images and publish logs"
}