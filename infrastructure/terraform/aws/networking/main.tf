# AWS Provider configuration
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws" # ~> 5.0
      version = "~> 5.0"
    }
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.region
}

# Data source for available Availability Zones
data "aws_availability_zones" "available" {
  state = "available"

  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

# VPC Module configuration with enhanced security features
module "vpc" {
  source = "../../modules/vpc"

  environment        = var.environment
  region            = var.region
  vpc_cidr          = var.vpc_cidr
  availability_zones = var.availability_zones

  # Subnet CIDR configurations
  private_subnets = [
    cidrsubnet(var.vpc_cidr, 4, 0),
    cidrsubnet(var.vpc_cidr, 4, 1),
    cidrsubnet(var.vpc_cidr, 4, 2)
  ]
  public_subnets = [
    cidrsubnet(var.vpc_cidr, 4, 4),
    cidrsubnet(var.vpc_cidr, 4, 5),
    cidrsubnet(var.vpc_cidr, 4, 6)
  ]

  # NAT Gateway configuration
  enable_nat_gateway = true
  single_nat_gateway = var.environment != "prod" # Use single NAT Gateway for non-prod environments

  # VPN Gateway for secure access
  enable_vpn_gateway = var.environment == "prod" # Enable VPN Gateway only in production

  # Enable VPC Flow Logs for network monitoring
  enable_flow_logs = true
  flow_logs_retention_days = lookup({
    prod = 365,
    staging = 90,
    dev = 30
  }, var.environment, 30)

  # VPC Endpoints for secure AWS service access
  vpc_endpoints = {
    s3 = {
      service_name = "com.amazonaws.${var.region}.s3"
      service_type = "Gateway"
      route_table_ids = ["*"]
    },
    dynamodb = {
      service_name = "com.amazonaws.${var.region}.dynamodb"
      service_type = "Gateway"
      route_table_ids = ["*"]
    },
    ecr_api = {
      service_name = "com.amazonaws.${var.region}.ecr.api"
      service_type = "Interface"
      private_dns_enabled = true
    },
    ecr_dkr = {
      service_name = "com.amazonaws.${var.region}.ecr.dkr"
      service_type = "Interface"
      private_dns_enabled = true
    },
    logs = {
      service_name = "com.amazonaws.${var.region}.logs"
      service_type = "Interface"
      private_dns_enabled = true
    }
  }
}

# Output the created VPC and subnet IDs
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

output "availability_zones" {
  description = "List of availability zones used"
  value       = var.availability_zones
}