# Environment name for resource tagging
variable "environment" {
  type        = string
  description = "Environment name for deployment (dev, staging, prod)"
}

# AWS region for infrastructure deployment
variable "region" {
  type        = string
  description = "AWS region where network infrastructure will be deployed"
}

# VPC network configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC network space"
  default     = "10.0.0.0/16"
}

# Availability zones for multi-AZ deployment
variable "availability_zones" {
  type        = list(string)
  description = "List of AWS availability zones for multi-AZ deployment within the selected region"
}

# Private subnet configuration for ECS services and databases
variable "private_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for private subnets hosting ECS services, databases and other internal resources"
}

# Public subnet configuration for load balancers
variable "public_subnet_cidrs" {
  type        = list(string)
  description = "CIDR blocks for public subnets hosting load balancers and public-facing resources"
}

# NAT Gateway configuration for private subnet internet access
variable "enable_nat_gateway" {
  type        = bool
  description = "Enable NAT Gateway to allow private subnet resources to access the internet"
  default     = true
}

# Cost optimization for NAT Gateway deployment
variable "single_nat_gateway" {
  type        = bool
  description = "Use a single NAT Gateway instead of one per AZ to optimize costs (recommended for non-prod)"
  default     = false
}

# VPN Gateway for secure VPC access
variable "enable_vpn_gateway" {
  type        = bool
  description = "Enable VPN Gateway for secure VPC access from external networks"
  default     = false
}