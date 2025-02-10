# API Gateway Infrastructure Configuration
# Version: ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for enhanced configuration
locals {
  service_name = "${var.project_name}-api-gateway-${var.environment}"
  
  # Container port mappings with health check
  container_port = 3000
  
  # Enhanced auto-scaling configuration
  autoscaling_config = {
    min_capacity     = 2
    max_capacity     = 6
    cpu_threshold    = 70
    memory_threshold = 80
    scaling_cooldown = 300
  }

  # Environment variables for API Gateway
  environment_variables = {
    NODE_ENV            = var.environment
    PORT               = local.container_port
    LOG_LEVEL          = var.environment == "production" ? "info" : "debug"
    ENABLE_MONITORING  = var.enable_monitoring
  }

  # Enhanced security configuration
  security_config = {
    enable_waf          = true
    ssl_policy         = "ELBSecurityPolicy-TLS-1-2-2017-01"
    enable_access_logs = true
  }

  # Monitoring and logging configuration
  monitoring_config = {
    metrics_namespace = "APIGateway"
    log_retention    = 30
    alarm_threshold  = 90
  }

  # Circuit breaker configuration
  circuit_breaker_config = {
    enable   = true
    rollback = true
    timeout  = 60
  }
}

# Data sources
data "aws_vpc" "main" {
  tags = {
    Environment = var.environment
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

# ECS Service Module for API Gateway
module "ecs_service" {
  source = "../../modules/ecs-service"

  service_name = local.service_name
  cluster_id   = var.ecs_cluster_id
  vpc_id       = data.aws_vpc.main.id
  subnet_ids   = data.aws_subnets.private.ids

  # Task definition configuration
  task_definition = {
    family = local.service_name
    container_definitions = jsonencode([
      {
        name         = local.service_name
        image        = var.container_image
        cpu         = 256
        memory      = 512
        essential   = true
        portMappings = [
          {
            containerPort = local.container_port
            protocol     = "tcp"
          }
        ]
        environment = [
          for key, value in local.environment_variables : {
            name  = key
            value = value
          }
        ]
        logConfiguration = {
          logDriver = "awslogs"
          options = {
            awslogs-group         = "/ecs/${local.service_name}"
            awslogs-region        = var.aws_region
            awslogs-stream-prefix = "ecs"
          }
        }
        healthCheck = {
          command     = ["CMD-SHELL", "curl -f http://localhost:${local.container_port}/health || exit 1"]
          interval    = 30
          timeout     = 5
          retries     = 3
          startPeriod = 60
        }
      }
    ])
    cpu                     = 256
    memory                  = 512
    network_mode            = "awsvpc"
    requires_compatibilities = ["FARGATE"]
    execution_role_arn      = var.execution_role_arn
    task_role_arn           = var.task_role_arn
  }

  # Enhanced security groups
  security_groups = [aws_security_group.api_gateway.id]

  # Auto-scaling configuration
  desired_count      = 2
  min_capacity       = local.autoscaling_config.min_capacity
  max_capacity       = local.autoscaling_config.max_capacity
  cpu_threshold      = local.autoscaling_config.cpu_threshold
  memory_threshold   = local.autoscaling_config.memory_threshold
  scaling_cooldown   = local.autoscaling_config.scaling_cooldown

  # Health check configuration
  health_check_path = "/health"
  health_check_grace_period = 60

  tags = var.tags
}

# WAF configuration for API Gateway
resource "aws_wafv2_web_acl" "api_gateway" {
  count       = local.security_config.enable_waf ? 1 : 0
  name        = "${local.service_name}-waf"
  description = "WAF rules for API Gateway protection"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "RateLimit"
    priority = 1

    override_action {
      none {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "RateLimitRule"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "APIGatewayWAF"
    sampled_requests_enabled  = true
  }

  tags = var.tags
}

# Security group for API Gateway
resource "aws_security_group" "api_gateway" {
  name        = "${local.service_name}-sg"
  description = "Security group for API Gateway service"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port       = local.container_port
    to_port         = local.container_port
    protocol        = "tcp"
    security_groups = [var.alb_security_group_id]
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

# Outputs
output "api_gateway_url" {
  description = "URL of the API Gateway service"
  value       = module.ecs_service.service_name
}

output "api_gateway_security_group_id" {
  description = "Security group ID for API Gateway"
  value       = aws_security_group.api_gateway.id
}

output "api_gateway_waf_acl_id" {
  description = "WAF ACL ID for API Gateway"
  value       = local.security_config.enable_waf ? aws_wafv2_web_acl.api_gateway[0].id : null
}