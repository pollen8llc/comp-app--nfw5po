# Analytics Service Terraform Configuration for Community Management Platform
# Version: ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for analytics service configuration
locals {
  # Service naming with environment prefix
  service_name = "${var.service_name}-${terraform.workspace}"

  # Container definition for Python analytics service
  container_definition = jsonencode([
    {
      name  = var.service_name
      image = var.container_image
      cpu   = var.container_cpu
      memory = var.container_memory
      essential = true
      
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        for key, value in var.environment_variables : {
          name  = key
          value = value
        }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}${var.health_check_path} || exit 1"]
        interval    = 60
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.analytics.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "analytics"
        }
      }

      # Enable container insights for detailed monitoring
      dockerLabels = {
        "com.amazonaws.ecs.capability.logging-driver.awslogs" = "true"
        "com.amazonaws.ecs.capability.monitoring"             = "true"
      }
    }
  ])

  # Task definition configuration for TDA computations
  task_definition = {
    family                   = local.service_name
    container_definitions    = local.container_definition
    cpu                     = var.container_cpu
    memory                  = var.container_memory
    network_mode            = "awsvpc"
    requires_compatibilities = ["FARGATE"]
    execution_role_arn      = var.execution_role_arn
    task_role_arn           = var.task_role_arn
  }

  # Auto-scaling configuration based on technical requirements
  auto_scaling = {
    min_capacity     = var.min_capacity
    max_capacity     = var.max_capacity
    cpu_threshold    = var.cpu_threshold
    memory_threshold = 80
    scaling_cooldown = var.scaling_cooldown
  }
}

# Data source for current AWS region
data "aws_region" "current" {}

# CloudWatch Log Group for analytics service
resource "aws_cloudwatch_log_group" "analytics" {
  name              = "/ecs/${local.service_name}"
  retention_in_days = 30
  
  # Enable encryption for sensitive analytics data
  kms_key_id = aws_kms_key.analytics_logs.arn

  tags = var.tags
}

# KMS key for log encryption
resource "aws_kms_key" "analytics_logs" {
  description             = "KMS key for analytics service logs encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = var.tags
}

# ECS Service deployment using the shared module
module "ecs_service" {
  source = "../../modules/ecs-service"

  service_name               = local.service_name
  task_definition           = local.task_definition
  desired_count             = var.desired_count
  cluster_id                = data.aws_ecs_cluster.main.id
  vpc_id                    = data.aws_vpc.main.id
  subnet_ids                = data.aws_subnets.private.ids
  security_groups           = [aws_security_group.analytics.id]
  health_check_path         = var.health_check_path
  health_check_grace_period = var.health_check_grace_period
  
  # Auto-scaling configuration
  min_capacity     = local.auto_scaling.min_capacity
  max_capacity     = local.auto_scaling.max_capacity
  cpu_threshold    = local.auto_scaling.cpu_threshold
  memory_threshold = local.auto_scaling.memory_threshold
  scaling_cooldown = local.auto_scaling.scaling_cooldown

  tags = var.tags
}

# Security group for analytics service
resource "aws_security_group" "analytics" {
  name_prefix = "${local.service_name}-"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [data.aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${local.service_name}-sg"
  })
}

# CloudWatch metric alarm for TDA computation duration
resource "aws_cloudwatch_metric_alarm" "tda_duration" {
  alarm_name          = "${local.service_name}-tda-duration"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TDAComputationDuration"
  namespace           = "Analytics"
  period             = 60
  statistic          = "Average"
  threshold          = 5000  # 5 seconds as per performance requirements
  alarm_description  = "TDA computation duration exceeds 5 seconds"
  alarm_actions      = [data.aws_sns_topic.alerts.arn]

  dimensions = {
    ServiceName = local.service_name
  }

  tags = var.tags
}

# Data sources for existing resources
data "aws_vpc" "main" {
  tags = {
    Environment = terraform.workspace
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  tags = {
    Tier = "private"
  }
}

data "aws_ecs_cluster" "main" {
  cluster_name = "community-platform-${terraform.workspace}"
}

data "aws_security_group" "alb" {
  tags = {
    Name = "alb-${terraform.workspace}"
  }
}

data "aws_sns_topic" "alerts" {
  name = "service-alerts-${terraform.workspace}"
}

# Outputs
output "service_arn" {
  description = "ARN of the deployed analytics service"
  value       = module.ecs_service.service_arn
}

output "task_definition_arn" {
  description = "ARN of the task definition"
  value       = module.ecs_service.task_definition_arn
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.analytics.name
}