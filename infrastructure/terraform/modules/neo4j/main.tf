# Neo4j Enterprise Cluster Terraform Module
# AWS Provider version: ~> 4.0
# Random Provider version: ~> 3.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Random password generation for Neo4j admin user
resource "random_password" "neo4j_password" {
  length  = 32
  special = true
}

# KMS key for encryption at rest
resource "aws_kms_key" "neo4j" {
  description             = "KMS key for Neo4j data encryption"
  deletion_window_in_days = 7
  enable_key_rotation    = true
  tags                   = var.tags
}

# ECS Cluster for Neo4j
resource "aws_ecs_cluster" "neo4j" {
  name = "${var.cluster_name}-neo4j"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.tags
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "neo4j" {
  name              = "/ecs/neo4j"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.neo4j.arn
  tags              = var.tags
}

# ECS Task Definition
resource "aws_ecs_task_definition" "neo4j" {
  family                   = "${var.cluster_name}-neo4j"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = 2048
  memory                  = 4096
  execution_role_arn      = aws_iam_role.ecs_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "neo4j"
      image = "neo4j:${var.neo4j_version}-enterprise"
      essential = true
      
      portMappings = [
        {
          containerPort = 7474
          protocol      = "tcp"
        },
        {
          containerPort = 7687
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NEO4J_ACCEPT_LICENSE_AGREEMENT"
          value = "yes"
        },
        {
          name  = "NEO4J_AUTH"
          value = "neo4j/${random_password.neo4j_password.result}"
        },
        {
          name  = "NEO4J_dbms_ssl_policy_bolt_enabled"
          value = "true"
        },
        {
          name  = "NEO4J_dbms_ssl_policy_https_enabled"
          value = "true"
        },
        {
          name  = "NEO4J_dbms_mode"
          value = "CORE"
        },
        {
          name  = "NEO4J_initial_discovery_members"
          value = join(",", [for i in range(var.cluster_size) : "${var.cluster_name}-neo4j-${i}.${aws_service_discovery_private_dns_namespace.neo4j.name}:5000"])
        }
      ]

      mountPoints = [
        {
          sourceVolume  = "neo4j-data"
          containerPath = "/data"
          readOnly     = false
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.neo4j.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "neo4j"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:7474 || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  volume {
    name = "neo4j-data"
    efs_volume_configuration {
      file_system_id = aws_efs_file_system.neo4j.id
      root_directory = "/"
    }
  }

  tags = var.tags
}

# ECS Service
resource "aws_ecs_service" "neo4j" {
  name                               = "${var.cluster_name}-neo4j"
  cluster                           = aws_ecs_cluster.neo4j.id
  task_definition                   = aws_ecs_task_definition.neo4j.arn
  desired_count                     = var.cluster_size
  launch_type                       = "FARGATE"
  platform_version                  = "1.4.0"
  health_check_grace_period_seconds = 120

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [aws_security_group.neo4j.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.neo4j.arn
  }

  deployment_configuration {
    maximum_percent         = 200
    minimum_healthy_percent = 100
  }

  tags = var.tags
}

# Security Group
resource "aws_security_group" "neo4j" {
  name_prefix = "${var.cluster_name}-neo4j-"
  vpc_id      = var.vpc_id
  description = "Security group for Neo4j cluster"

  ingress {
    from_port       = 7474
    to_port         = 7474
    protocol        = "tcp"
    cidr_blocks     = var.allowed_cidr_blocks
    description     = "HTTP interface"
  }

  ingress {
    from_port       = 7687
    to_port         = 7687
    protocol        = "tcp"
    cidr_blocks     = var.allowed_cidr_blocks
    description     = "Bolt interface"
  }

  ingress {
    from_port       = 5000
    to_port         = 5000
    protocol        = "tcp"
    self            = true
    description     = "Cluster communication"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

# Service Discovery
resource "aws_service_discovery_private_dns_namespace" "neo4j" {
  name        = "${var.cluster_name}-neo4j.local"
  vpc         = var.vpc_id
  description = "Service discovery namespace for Neo4j cluster"
  tags        = var.tags
}

resource "aws_service_discovery_service" "neo4j" {
  name = "neo4j"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.neo4j.id
    
    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {
    failure_threshold = 3
  }

  tags = var.tags
}

# Backup Configuration
resource "aws_backup_vault" "neo4j" {
  name        = "${var.cluster_name}-neo4j-backup"
  kms_key_arn = aws_kms_key.neo4j.arn
  tags        = var.tags
}

resource "aws_backup_plan" "neo4j" {
  name = "${var.cluster_name}-neo4j-backup"

  rule {
    rule_name         = "daily_backup"
    target_vault_name = aws_backup_vault.neo4j.name
    schedule          = "cron(0 5 ? * * *)"
    
    lifecycle {
      delete_after = var.backup_retention_days
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.neo4j.arn
    }
  }

  tags = var.tags
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "neo4j_cpu" {
  alarm_name          = "${var.cluster_name}-neo4j-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name        = "CPUUtilization"
  namespace          = "AWS/ECS"
  period             = var.monitoring_interval
  statistic          = "Average"
  threshold          = 80
  alarm_description  = "Neo4j cluster CPU utilization"
  alarm_actions      = []

  dimensions = {
    ClusterName = aws_ecs_cluster.neo4j.name
    ServiceName = aws_ecs_service.neo4j.name
  }

  tags = var.tags
}

# Outputs
output "neo4j_endpoints" {
  description = "Neo4j cluster endpoints"
  value = {
    http = "http://${aws_service_discovery_service.neo4j.name}.${aws_service_discovery_private_dns_namespace.neo4j.name}:7474"
    bolt = "bolt://${aws_service_discovery_service.neo4j.name}.${aws_service_discovery_private_dns_namespace.neo4j.name}:7687"
  }
}

output "neo4j_security_group_id" {
  description = "ID of the Neo4j security group"
  value       = aws_security_group.neo4j.id
}

output "neo4j_password" {
  description = "Generated password for Neo4j admin user"
  value       = random_password.neo4j_password.result
  sensitive   = true
}