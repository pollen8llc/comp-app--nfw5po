# AWS Infrastructure Outputs for Community Management Platform
# Provider version: hashicorp/terraform ~> 1.5

# VPC and Networking Outputs
output "vpc_id" {
  description = "ID of the VPC where all infrastructure resources are deployed"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs where services and databases are deployed"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "List of public subnet IDs where load balancers are deployed"
  value       = module.vpc.public_subnet_ids
}

output "vpc_cidr" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

# Database Endpoints
output "neo4j_endpoint" {
  description = "Neo4j Enterprise database endpoint for application connection"
  value       = module.neo4j.neo4j_endpoints.bolt
  sensitive   = true
}

output "neo4j_http_endpoint" {
  description = "Neo4j Enterprise HTTP endpoint for browser interface"
  value       = module.neo4j.neo4j_endpoints.http
  sensitive   = true
}

output "neo4j_security_group_id" {
  description = "Security group ID for Neo4j cluster access"
  value       = module.neo4j.neo4j_security_group_id
}

# Cache Endpoints
output "redis_endpoint" {
  description = "Redis Enterprise cache endpoint for application connection"
  value       = module.redis.redis_endpoint
  sensitive   = true
}

output "redis_port" {
  description = "Redis Enterprise port number for connections"
  value       = module.redis.redis_port
}

output "redis_security_group_id" {
  description = "Security group ID for Redis cluster access"
  value       = module.redis.redis_security_group_id
}

# Storage Resources
output "storage_bucket_name" {
  description = "Name of the S3 bucket for file storage"
  value       = module.storage.s3_bucket_name
}

# Monitoring and Logging
output "cloudwatch_log_group" {
  description = "CloudWatch log group name for application logs"
  value       = "/aws/ecs/community-platform"
}

output "metrics_namespace" {
  description = "CloudWatch metrics namespace for application metrics"
  value       = "CommunityPlatform"
}

# Service Discovery
output "service_discovery_namespace" {
  description = "Service discovery namespace for internal service communication"
  value       = aws_service_discovery_private_dns_namespace.main.name
}

# Load Balancer
output "alb_dns_name" {
  description = "DNS name of the application load balancer"
  value       = module.alb.dns_name
}

output "alb_zone_id" {
  description = "Route53 zone ID of the application load balancer"
  value       = module.alb.zone_id
}

# Network Access
output "nat_public_ips" {
  description = "List of public Elastic IPs created for NAT Gateway"
  value       = module.vpc.nat_public_ips
}

# Security
output "kms_key_arn" {
  description = "ARN of KMS key used for encryption"
  value       = module.kms.key_arn
  sensitive   = true
}

# Tags
output "resource_tags" {
  description = "Common resource tags applied to all infrastructure components"
  value = {
    Environment = var.environment
    Project     = "community-platform"
    ManagedBy   = "terraform"
  }
}