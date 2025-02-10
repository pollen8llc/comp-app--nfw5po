# Event Service Terraform Configuration
# Version: ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for service configuration
locals {
  service_name = "${var.environment}-event-service"
  
  # Container definition with enhanced logging and monitoring
  container_definition = jsonencode([
    {
      name         = local.service_name
      image        = var.container_image
      cpu          = var.cpu_units
      memory       = var.memory_mb
      essential    = true
      
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = var.environment
        },
        {
          name  = "PORT"
          value = tostring(var.container_port)
        }
      ]

      secrets = [
        {
          name      = "EVENTBRITE_API_KEY"
          valueFrom = aws_ssm_parameter.eventbrite_api_key.arn
        },
        {
          name      = "LUMA_API_KEY"
          valueFrom = aws_ssm_parameter.luma_api_key.arn
        },
        {
          name      = "PARTIFUL_API_KEY"
          valueFrom = aws_ssm_parameter.partiful_api_key.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.event_service.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  # Task definition configuration
  task_definition = {
    family                   = local.service_name
    container_definitions    = local.container_definition
    cpu                     = var.cpu_units
    memory                  = var.memory_mb
    network_mode            = "awsvpc"
    requires_compatibilities = ["FARGATE"]
    execution_role_arn      = aws_iam_role.execution_role.arn
    task_role_arn           = aws_iam_role.task_role.arn
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "event_service" {
  name              = "/ecs/${local.service_name}"
  retention_in_days = 30

  tags = merge(var.tags, {
    Name = "${local.service_name}-logs"
  })
}

# SSM Parameters for API keys
resource "aws_ssm_parameter" "eventbrite_api_key" {
  name        = "/${var.environment}/event-service/eventbrite-api-key"
  description = "Eventbrite API key for event integration"
  type        = "SecureString"
  value       = var.eventbrite_api_key

  tags = var.tags
}

resource "aws_ssm_parameter" "luma_api_key" {
  name        = "/${var.environment}/event-service/luma-api-key"
  description = "Luma API key for event integration"
  type        = "SecureString"
  value       = var.luma_api_key

  tags = var.tags
}

resource "aws_ssm_parameter" "partiful_api_key" {
  name        = "/${var.environment}/event-service/partiful-api-key"
  description = "Partiful API key for event integration"
  type        = "SecureString"
  value       = var.partiful_api_key

  tags = var.tags
}

# ECS Service deployment using the reusable module
module "event_service" {
  source = "../../../modules/ecs-service"

  service_name = local.service_name
  cluster_id   = var.ecs_cluster_id
  
  task_definition = local.task_definition
  
  vpc_id      = var.vpc_id
  subnet_ids  = var.private_subnet_ids
  security_groups = [aws_security_group.event_service.id]

  desired_count = var.min_capacity
  min_capacity  = var.min_capacity
  max_capacity  = var.max_capacity

  cpu_threshold    = 70
  memory_threshold = 80
  scaling_cooldown = 300

  health_check_path = "/health"
  health_check_grace_period = 60

  tags = var.tags
}

# Security Group for event service
resource "aws_security_group" "event_service" {
  name        = "${local.service_name}-sg"
  description = "Security group for event service"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Allow inbound traffic from ALB"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [module.event_service.security_group_id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${local.service_name}-sg"
  })
}

# IAM Execution Role
resource "aws_iam_role" "execution_role" {
  name = "${local.service_name}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Task Role
resource "aws_iam_role" "task_role" {
  name = "${local.service_name}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM Role Policies
resource "aws_iam_role_policy_attachment" "execution_role_policy" {
  role       = aws_iam_role.execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ssm_access" {
  name = "${local.service_name}-ssm-policy"
  role = aws_iam_role.execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Resource = [
          aws_ssm_parameter.eventbrite_api_key.arn,
          aws_ssm_parameter.luma_api_key.arn,
          aws_ssm_parameter.partiful_api_key.arn
        ]
      }
    ]
  })
}

# Outputs
output "service_name" {
  description = "Name of the deployed event service"
  value       = module.event_service.service_name
}

output "service_arn" {
  description = "ARN of the deployed event service"
  value       = module.event_service.service_arn
}

output "task_definition_arn" {
  description = "ARN of the event service task definition"
  value       = module.event_service.task_definition_arn
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.event_service.name
}