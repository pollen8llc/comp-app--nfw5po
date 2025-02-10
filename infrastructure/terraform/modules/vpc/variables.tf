# Terraform ~> 1.0

variable "environment" {
  type        = string
  description = "Environment name for resource tagging (dev, staging, prod)"
}

variable "region" {
  type        = string
  description = "AWS region for VPC deployment"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC network space"
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  type        = list(string)
  description = "List of AWS availability zones for multi-AZ deployment"
}

variable "private_subnets" {
  type        = list(string)
  description = "CIDR blocks for private subnets hosting ECS services and databases"
}

variable "public_subnets" {
  type        = list(string)
  description = "CIDR blocks for public subnets hosting load balancers"
}

variable "enable_nat_gateway" {
  type        = bool
  description = "Flag to enable NAT Gateway for private subnet internet access"
  default     = true
}

variable "single_nat_gateway" {
  type        = bool
  description = "Flag to use single NAT Gateway instead of one per AZ for cost optimization"
  default     = false
}

variable "enable_vpn_gateway" {
  type        = bool
  description = "Flag to enable VPN Gateway for secure VPC access"
  default     = false
}