# ECS Service Module with enhanced security and monitoring
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
  # Service naming with environment prefix for security
  service_identifier = "${var.service_name}-${terraform.workspace}"
  
  # Enhanced health check configuration
  health_check = {
    path                = var.health_check_path
    healthy_threshold   = 3
    unhealthy_threshold = 2
    timeout             = 5
    interval            = 30
    matcher             = "200-299"
  }

  # Security-enhanced network configuration
  network_configuration = {
    subnets          = var.subnet_ids
    security_groups  = var.security_groups
    assign_public_ip = false
  }

  # Enhanced deployment configuration
  deployment_config = {
    maximum_percent         = 200
    minimum_healthy_percent = 100
    deployment_circuit_breaker = {
      enable   = true
      rollback = true
    }
  }
}

# Enhanced ECS Service with security and monitoring
resource "aws_ecs_service" "main" {
  name                              = local.service_identifier
  cluster                          = var.cluster_id
  task_definition                  = aws_ecs_task_definition.main.arn
  desired_count                    = var.desired_count
  launch_type                      = "FARGATE"
  platform_version                 = "LATEST"
  health_check_grace_period_seconds = var.health_check_grace_period
  enable_execute_command           = false # Security: Disable execute command
  enable_ecs_managed_tags         = true
  propagate_tags                  = "SERVICE"
  
  # Enhanced network configuration
  network_configuration {
    subnets          = local.network_configuration.subnets
    security_groups  = local.network_configuration.security_groups
    assign_public_ip = local.network_configuration.assign_public_ip
  }

  # Secure deployment configuration
  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = local.deployment_config.deployment_circuit_breaker.enable
    rollback = local.deployment_config.deployment_circuit_breaker.rollback
  }

  # Load balancer configuration with enhanced health checks
  load_balancer {
    target_group_arn = aws_lb_target_group.main.arn
    container_name   = var.task_definition.family
    container_port   = jsondecode(var.task_definition.container_definitions)[0].portMappings[0].containerPort
  }

  # Enable service discovery
  service_registries {
    registry_arn = aws_service_discovery_service.main.arn
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = var.tags
}

# Enhanced Task Definition with security configurations
resource "aws_ecs_task_definition" "main" {
  family                   = var.task_definition.family
  container_definitions    = var.task_definition.container_definitions
  cpu                     = var.task_definition.cpu
  memory                  = var.task_definition.memory
  network_mode            = var.task_definition.network_mode
  requires_compatibilities = var.task_definition.requires_compatibilities
  execution_role_arn      = var.task_definition.execution_role_arn
  task_role_arn           = var.task_definition.task_role_arn

  # Enhanced security configurations
  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture       = "X86_64"
  }

  tags = var.tags
}

# Enhanced Application Load Balancer Target Group
resource "aws_lb_target_group" "main" {
  name                 = substr(local.service_identifier, 0, 32)
  port                = jsondecode(var.task_definition.container_definitions)[0].portMappings[0].containerPort
  protocol            = "HTTP"
  vpc_id              = var.vpc_id
  target_type         = "ip"
  deregistration_delay = 30

  # Enhanced health check configuration
  health_check {
    path                = local.health_check.path
    healthy_threshold   = local.health_check.healthy_threshold
    unhealthy_threshold = local.health_check.unhealthy_threshold
    timeout             = local.health_check.timeout
    interval            = local.health_check.interval
    matcher             = local.health_check.matcher
  }

  tags = var.tags
}

# Auto-scaling target configuration
resource "aws_appautoscaling_target" "main" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${var.cluster_id}/${aws_ecs_service.main.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  tags = var.tags
}

# CPU-based auto-scaling policy
resource "aws_appautoscaling_policy" "cpu" {
  name               = "${local.service_identifier}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.main.resource_id
  scalable_dimension = aws_appautoscaling_target.main.scalable_dimension
  service_namespace  = aws_appautoscaling_target.main.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = var.cpu_threshold
    scale_in_cooldown  = var.scaling_cooldown
    scale_out_cooldown = var.scaling_cooldown
  }
}

# Memory-based auto-scaling policy
resource "aws_appautoscaling_policy" "memory" {
  name               = "${local.service_identifier}-memory-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.main.resource_id
  scalable_dimension = aws_appautoscaling_target.main.scalable_dimension
  service_namespace  = aws_appautoscaling_target.main.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value       = var.memory_threshold
    scale_in_cooldown  = var.scaling_cooldown
    scale_out_cooldown = var.scaling_cooldown
  }
}

# Service Discovery configuration
resource "aws_service_discovery_service" "main" {
  name = local.service_identifier

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    
    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }

  tags = var.tags
}

# Private DNS namespace for service discovery
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${var.service_name}.local"
  vpc         = var.vpc_id
  description = "Private DNS namespace for ${var.service_name} service discovery"

  tags = var.tags
}

# Output values
output "service_arn" {
  description = "ARN of the created ECS service"
  value       = aws_ecs_service.main.id
}

output "task_definition_arn" {
  description = "ARN of the task definition"
  value       = aws_ecs_task_definition.main.arn
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = aws_lb_target_group.main.arn
}

output "service_name" {
  description = "Name of the deployed ECS service"
  value       = aws_ecs_service.main.name
}

output "security_group_id" {
  description = "ID of the service security group"
  value       = local.network_configuration.security_groups[0]
}