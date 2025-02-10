# Backend configuration for Terraform state management
# Version: ~> 1.5

terraform {
  # Configure S3 backend for storing Terraform state files
  backend "s3" {
    # S3 bucket for storing Terraform state files
    bucket = "${var.project_name}-terraform-state"
    
    # State file path based on environment
    key = "${var.environment}/terraform.tfstate"
    
    # AWS region for state storage
    region = "us-west-2"
    
    # Enable state file encryption at rest
    encrypt = true
    
    # DynamoDB table for state locking
    dynamodb_table = "${var.project_name}-terraform-locks"
    
    # Support for Terraform workspaces
    workspace_key_prefix = "workspaces"
  }
}