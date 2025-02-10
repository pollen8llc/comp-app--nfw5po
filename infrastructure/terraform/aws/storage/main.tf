# AWS Storage Infrastructure Configuration for Community Management Platform
# Provider version: hashicorp/aws ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

# Neo4j Enterprise Cluster
module "neo4j" {
  source = "../../modules/neo4j"

  environment            = var.environment
  instance_type         = "r6g.2xlarge"
  cluster_size          = 3
  volume_size           = 500
  backup_retention_days = 2555  # 7 years retention requirement
  multi_az             = true
  encryption_at_rest   = true

  tags = {
    Environment = var.environment
    Project     = "Community Platform"
    ManagedBy   = "Terraform"
  }
}

# Redis Enterprise Cache
module "redis" {
  source = "../../modules/redis"

  environment            = var.environment
  node_type             = "cache.r6g.xlarge"
  num_cache_clusters    = 3
  parameter_group_family = "redis7"
  multi_az             = true
  automatic_failover   = true
  encryption_at_rest   = true

  tags = {
    Environment = var.environment
    Project     = "Community Platform"
    ManagedBy   = "Terraform"
  }
}

# S3 Bucket for File Storage
resource "aws_s3_bucket" "main" {
  bucket = "${var.environment}-community-platform-storage"
  force_destroy = false

  tags = {
    Environment = var.environment
    Project     = "Community Platform"
    ManagedBy   = "Terraform"
  }
}

# Enable Versioning
resource "aws_s3_bucket_versioning" "main" {
  bucket = aws_s3_bucket.main.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle Rules for 7-year Retention
resource "aws_s3_bucket_lifecycle_rule" "retention" {
  bucket = aws_s3_bucket.main.id
  id     = "retention-policy"
  enabled = true

  # Transition to cheaper storage after 90 days
  transition {
    days          = 90
    storage_class = "STANDARD_IA"
  }

  # Archive to Glacier after 1 year
  transition {
    days          = 365
    storage_class = "GLACIER"
  }

  # Expire after 7 years (2555 days)
  expiration {
    days = 2555
  }
}

# Server-side Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Public Access Block
resource "aws_s3_bucket_public_access_block" "main" {
  bucket = aws_s3_bucket.main.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS Configuration
resource "aws_s3_bucket_cors_configuration" "main" {
  bucket = aws_s3_bucket.main.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["https://*.${var.environment}.community-platform.com"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Outputs
output "neo4j_endpoint" {
  description = "Neo4j cluster endpoint URL"
  value       = module.neo4j.cluster_endpoint
}

output "redis_endpoint" {
  description = "Redis cluster endpoint URL"
  value       = module.redis.redis_endpoint
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.main.id
}