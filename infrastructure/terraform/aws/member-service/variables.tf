# Member Service AWS Infrastructure Variables
# Terraform Version: ~> 1.5

# Common variables imported from parent module
variable "environment" {
  type        = string
  description = "Deployment environment (development, staging, production)"
}

variable "aws_region" {
  type        = string
  description = "AWS region for resource deployment"
}

variable "project_name" {
  type        = string
  description = "Project name for resource naming and tagging"
}

# Service-specific variables
variable "service_name" {
  type        = string
  default     = "member-service"
  description = "Name of the member service for resource identification"
}

variable "container_image" {
  type        = string
  description = "Docker image URL for the member service container"
}

variable "container_port" {
  type        = number
  default     = 4000
  description = "Port number exposed by the member service container"
}

variable "cpu_limit" {
  type        = number
  default     = 1024  # 1 vCPU
  description = "CPU units (1024 = 1 vCPU) allocated to member service tasks"
}

variable "memory_limit" {
  type        = number
  default     = 2048  # 2 GB
  description = "Memory (in MiB) allocated to member service tasks"
}

variable "desired_count" {
  type        = number
  default     = 2
  description = "Desired number of member service tasks to run"
}

variable "min_count" {
  type        = number
  default     = 2
  description = "Minimum number of member service tasks to maintain"
}

variable "max_count" {
  type        = number
  default     = 4
  description = "Maximum number of member service tasks to scale to"
}

variable "cpu_utilization_threshold" {
  type        = number
  default     = 70
  description = "CPU utilization percentage threshold for auto-scaling"
}

variable "memory_utilization_threshold" {
  type        = number
  default     = 80
  description = "Memory utilization percentage threshold for auto-scaling"
}

variable "health_check_path" {
  type        = string
  default     = "/health"
  description = "Path for ALB health checks on the member service"
}

variable "health_check_interval" {
  type        = number
  default     = 30
  description = "Interval (in seconds) between health checks"
}

variable "health_check_timeout" {
  type        = number
  default     = 5
  description = "Timeout (in seconds) for health check response"
}

variable "health_check_healthy_threshold" {
  type        = number
  default     = 2
  description = "Number of consecutive successful health checks before considering healthy"
}

variable "health_check_unhealthy_threshold" {
  type        = number
  default     = 3
  description = "Number of consecutive failed health checks before considering unhealthy"
}

variable "neo4j_connection" {
  type = object({
    host     = string
    port     = number
    user     = string
    password = string
    database = string
  })
  sensitive   = true
  description = "Neo4j database connection details including credentials"
}

variable "service_discovery_namespace" {
  type        = string
  description = "AWS Cloud Map namespace for service discovery"
}

variable "vpc_id" {
  type        = string
  description = "ID of the VPC where the service will be deployed"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "List of private subnet IDs where the service will be deployed"
}

variable "enable_monitoring" {
  type        = bool
  default     = true
  description = "Flag to enable detailed monitoring and observability"
}

variable "log_retention_days" {
  type        = number
  default     = 30
  description = "Number of days to retain CloudWatch logs"
}