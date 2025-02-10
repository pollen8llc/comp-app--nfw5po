# AWS Provider Configuration for Community Management Platform
# Version: ~> 5.0

terraform {
  # Terraform version constraint
  required_version = "~> 1.5"

  # Required provider configuration
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# AWS Provider configuration with region and default tags
provider "aws" {
  # AWS region configuration from variables
  region = var.aws_region

  # Default tags to be applied to all AWS resources
  default_tags {
    tags = var.tags
  }

  # Additional provider settings for enterprise-grade configuration
  default_tags {
    tags = {
      Environment = var.environment
      Project     = var.project_name
      ManagedBy   = "terraform"
      LastUpdated = timestamp()
    }
  }
}