# Redis Enterprise cluster configuration for AWS ElastiCache
# Provider version: hashicorp/aws ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for resource naming and tagging
locals {
  name_prefix = format("redis-%s", var.environment)
  common_tags = merge(var.tags, {
    Environment = var.environment
    Service     = "redis"
    ManagedBy   = "terraform"
  })
}

# Subnet group for Redis cluster deployment
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-subnet-group"
  subnet_ids = var.subnet_ids
  tags       = local.common_tags
}

# Parameter group for Redis Enterprise 7+ configuration
resource "aws_elasticache_parameter_group" "main" {
  family      = "redis7"
  name        = "${local.name_prefix}-params"
  description = "Redis Enterprise parameter group for ${var.environment}"

  parameter {
    name  = "maxmemory-policy"
    value = "volatile-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"
  }

  tags = local.common_tags
}

# Security group for Redis cluster with strict access controls
resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-sg"
  description = "Security group for Redis Enterprise cluster"
  vpc_id      = var.vpc_id

  ingress {
    description = "Redis access from VPC"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

# Redis Enterprise replication group with high availability
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.name_prefix}-cluster"
  description         = "Redis Enterprise cluster for ${var.environment}"
  node_type           = "cache.r6g.xlarge"
  port                = 6379

  # Cluster configuration
  parameter_group_name       = aws_elasticache_parameter_group.main.name
  automatic_failover_enabled = true
  multi_az_enabled          = true
  num_cache_clusters        = 2
  subnet_group_name         = aws_elasticache_subnet_group.main.name
  security_group_ids        = [aws_security_group.redis.id]

  # Maintenance and backup
  maintenance_window      = "sun:05:00-sun:09:00"
  snapshot_retention_limit = 7
  snapshot_window         = "00:00-03:00"

  # Security
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auto_minor_version_upgrade = true
  apply_immediately          = false

  tags = local.common_tags
}

# Output values for other modules
output "redis_endpoint" {
  description = "Primary endpoint for Redis cluster"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis.id
}

output "redis_port" {
  description = "Port number for Redis connections"
  value       = aws_elasticache_replication_group.main.port
}