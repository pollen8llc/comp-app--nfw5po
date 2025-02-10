# Member Service Terraform Configuration
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
  service_name = "${var.environment}-member-service"
  container_image = "node:18-alpine"
  container_port = 4000
  
  # Task definition configuration
  task_definition = {
    family = local.service_name
    container_definitions = jsonencode([
      {
        name = local.service_name
        image = local.container_image
        cpu = 1024
        memory = 2048
        essential = true
        portMappings = [
          {
            containerPort = local.container_port
            protocol = "tcp"
          }
        ]
        environment = [
          {
            name = "NODE_ENV"
            value = var.environment
          },
          {
            name = "NEO4J_URI"
            value = data.terraform_remote_state.neo4j.outputs.neo4j_endpoints.bolt
          },
          {
            name = "NEO4J_USERNAME"
            value = "neo4j"
          }
        ],
        secrets = [
          {
            name = "NEO4J_PASSWORD"
            valueFrom = data.terraform_remote_state.neo4j.outputs.neo4j_password
          }
        ],
        logConfiguration = {
          logDriver = "awslogs"
          options = {
            awslogs-group = "/ecs/${local.service_name}"
            awslogs-region = var.aws_region
            awslogs-stream-prefix = "member-service"
          }
        },
        healthCheck = {
          command = ["CMD-SHELL", "curl -f http://localhost:${local.container_port}/health || exit 1"]
          interval = 30
          timeout = 5
          retries = 3
          startPeriod = 60
        }
      }
    ])
    cpu = "1024"
    memory = "2048"
    network_mode = "awsvpc"
    requires_compatibilities = ["FARGATE"]
    execution_role_arn = aws_iam_role.ecs_execution.arn
    task_role_arn = aws_iam_role.ecs_task.arn
  }
}

# Security group for Member Service
resource "aws_security_group" "member_service" {
  name = "${local.service_name}-sg"
  description = "Security group for Member Service"
  vpc_id = var.vpc_id

  ingress {
    from_port = local.container_port
    to_port = local.container_port
    protocol = "tcp"
    security_groups = [var.alb_security_group_id]
    description = "Allow inbound traffic from ALB"
  }

  ingress {
    from_port = 0
    to_port = 0
    protocol = "-1"
    self = true
    description = "Allow inbound traffic from self"
  }

  egress {
    from_port = 0
    to_port = 0
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = merge(var.tags, {
    Name = "${local.service_name}-sg"
  })
}

# ECS Service deployment using the module
module "ecs_service" {
  source = "../../../modules/ecs-service"

  service_name = local.service_name
  cluster_id = var.ecs_cluster_id
  task_definition = local.task_definition
  vpc_id = var.vpc_id
  subnet_ids = var.private_subnet_ids
  security_groups = [aws_security_group.member_service.id]
  
  # Auto-scaling configuration
  desired_count = 2
  min_capacity = 2
  max_capacity = 4
  cpu_threshold = 70
  memory_threshold = 80
  scaling_cooldown = 300
  
  # Health check configuration
  health_check_path = "/health"
  health_check_grace_period = 60

  tags = var.tags
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "member_service" {
  name = "/ecs/${local.service_name}"
  retention_in_days = 30
  
  tags = var.tags
}

# Outputs
output "service_name" {
  description = "Name of the deployed Member Service"
  value = module.ecs_service.service_name
}

output "service_url" {
  description = "Service discovery endpoint URL"
  value = "${module.ecs_service.service_name}.${var.service_discovery_namespace}"
}

output "task_definition_arn" {
  description = "ARN of the task definition"
  value = module.ecs_service.task_definition_arn
}

output "security_group_id" {
  description = "ID of the service security group"
  value = aws_security_group.member_service.id
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name"
  value = aws_cloudwatch_log_group.member_service.name
}