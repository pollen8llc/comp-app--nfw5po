# AWS Provider version ~> 5.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Data source to fetch available AZs in the region
data "aws_availability_zones" "available" {
  state = "available"

  filter {
    name   = "opt-in-status"
    values = ["opt-in-not-required"]
  }
}

# VPC Module with enhanced security and HA configuration
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${var.environment}-community-platform-vpc"
  cidr = var.vpc_cidr

  # Multi-AZ configuration for high availability
  azs             = var.availability_zones
  private_subnets = var.private_subnets
  public_subnets  = var.public_subnets

  # NAT Gateway configuration for private subnet internet access
  enable_nat_gateway     = var.enable_nat_gateway
  single_nat_gateway     = var.single_nat_gateway
  enable_dns_hostnames   = true
  enable_dns_support     = true
  
  # VPN Gateway for secure remote access
  enable_vpn_gateway = var.enable_vpn_gateway

  # VPC Flow Logs configuration
  enable_flow_log                      = var.enable_flow_logs
  create_flow_log_cloudwatch_log_group = true
  create_flow_log_cloudwatch_iam_role  = true
  flow_log_max_aggregation_interval    = 60
  flow_log_cloudwatch_log_group_retention_in_days = var.flow_logs_retention_days

  # VPC Endpoints for secure AWS service access
  enable_s3_endpoint       = true
  enable_dynamodb_endpoint = true
  
  # Enhanced security group rules for VPC endpoints
  vpc_endpoint_security_group_ids = {
    s3       = [aws_security_group.vpc_endpoints.id]
    dynamodb = [aws_security_group.vpc_endpoints.id]
  }

  # Subnet configurations
  public_subnet_tags = {
    Type                                        = "Public"
    "kubernetes.io/role/elb"                    = 1
    "kubernetes.io/cluster/${var.environment}"  = "shared"
  }

  private_subnet_tags = {
    Type                                        = "Private"
    "kubernetes.io/role/internal-elb"           = 1
    "kubernetes.io/cluster/${var.environment}"  = "shared"
  }

  # Resource tagging strategy
  tags = {
    Environment = var.environment
    Terraform   = "true"
    Project     = "community-platform"
    ManagedBy   = "terraform"
  }
}

# Security group for VPC endpoints
resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "${var.environment}-vpc-endpoints"
  description = "Security group for VPC endpoints"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Allow HTTPS from VPC CIDR"
  }

  tags = {
    Name        = "${var.environment}-vpc-endpoints"
    Environment = var.environment
    Terraform   = "true"
    Project     = "community-platform"
  }
}

# Outputs for use by other modules
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnets
}

output "vpc_cidr_block" {
  description = "The CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "nat_public_ips" {
  description = "List of public Elastic IPs created for NAT Gateway"
  value       = module.vpc.nat_public_ips
}

output "vpc_flow_log_id" {
  description = "The ID of VPC Flow Log"
  value       = module.vpc.vpc_flow_log_id
}