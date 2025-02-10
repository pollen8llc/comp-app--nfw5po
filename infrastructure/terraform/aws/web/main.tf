# AWS Web Infrastructure Configuration for Community Management Platform
# Version: ~> 5.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Enhanced local variables for resource configuration
locals {
  name_prefix = "${var.project}-${var.environment}"
  
  common_tags = {
    Environment = var.environment
    Project     = var.project
    ManagedBy   = "terraform"
    Component   = "web"
  }

  # CloudFront origin configuration with WebSocket support
  origin_config = {
    origin_id   = "${local.name_prefix}-alb"
    domain_name = module.ecs_service.target_group_arn
    custom_headers = {
      "X-Custom-Header" = "secure-header-value"
    }
    origin_shield_enabled = true
  }

  # Enhanced security headers
  security_headers = {
    "X-Frame-Options"           = "DENY"
    "X-Content-Type-Options"    = "nosniff"
    "X-XSS-Protection"         = "1; mode=block"
    "Strict-Transport-Security" = "max-age=31536000; includeSubDomains"
    "Content-Security-Policy"   = "default-src 'self'"
  }
}

# ECS Service deployment with enhanced monitoring
module "ecs_service" {
  source = "../../modules/ecs-service"

  service_name = "${local.name_prefix}-web"
  cluster_id   = var.ecs_cluster_id
  
  task_definition = {
    family                   = "${local.name_prefix}-web"
    container_definitions    = jsonencode([{
      name  = "web"
      image = var.container_image
      portMappings = [{
        containerPort = var.container_port
        protocol      = "tcp"
      }]
      environment = [
        { name = "NODE_ENV", value = var.environment }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${local.name_prefix}-web"
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "web"
        }
      }
    }])
    cpu                     = var.cpu
    memory                  = var.memory
    network_mode           = "awsvpc"
    requires_compatibilities = ["FARGATE"]
    execution_role_arn     = var.execution_role_arn
    task_role_arn         = var.task_role_arn
  }

  vpc_id          = var.vpc_id
  subnet_ids      = var.public_subnet_ids
  security_groups = [aws_security_group.web.id]
  
  desired_count = var.desired_count
  min_capacity  = var.min_count
  max_capacity  = var.max_count
  
  cpu_threshold    = var.cpu_threshold
  memory_threshold = var.memory_threshold
  
  health_check_path = var.health_check_path
  
  tags = local.common_tags
}

# CloudFront distribution with enhanced security
resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled    = true
  comment            = "${local.name_prefix} web distribution"
  price_class        = var.cdn_price_class
  aliases            = [var.domain_name]
  web_acl_id         = var.enable_waf ? aws_wafv2_web_acl.web[0].id : null
  
  origin {
    domain_name = module.ecs_service.target_group_arn
    origin_id   = local.origin_config.origin_id
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
    
    custom_header {
      name  = "X-Custom-Header"
      value = local.origin_config.custom_headers["X-Custom-Header"]
    }
  }
  
  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = local.origin_config.origin_id
    
    forwarded_values {
      query_string = true
      headers      = ["Host", "Origin", "Authorization"]
      
      cookies {
        forward = "all"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
    
    function_association {
      event_type   = "viewer-response"
      function_arn = aws_cloudfront_function.security_headers.arn
    }
  }
  
  viewer_certificate {
    acm_certificate_arn      = var.ssl_certificate_arn
    minimum_protocol_version = "TLSv1.2_2021"
    ssl_support_method       = "sni-only"
  }
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  dynamic "logging_config" {
    for_each = var.enable_cdn_logging ? [1] : []
    content {
      include_cookies = false
      bucket         = aws_s3_bucket.logs[0].bucket_domain_name
      prefix         = "cdn/"
    }
  }
  
  tags = local.common_tags
}

# Route53 DNS configuration with health checks
resource "aws_route53_record" "web" {
  count = var.create_dns_record ? 1 : 0
  
  zone_id = data.aws_route53_zone.selected[0].zone_id
  name    = var.domain_name
  type    = "A"
  
  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = true
  }
  
  health_check_id = aws_route53_health_check.web[0].id
  
  failover_routing_policy {
    type = "PRIMARY"
  }
  
  set_identifier = "primary"
}

# CloudFront security headers function
resource "aws_cloudfront_function" "security_headers" {
  name    = "${local.name_prefix}-security-headers"
  runtime = "cloudfront-js-1.0"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var response = event.response;
      var headers = response.headers;
      
      headers['x-frame-options'] = {value: '${local.security_headers["X-Frame-Options"]}'};
      headers['x-content-type-options'] = {value: '${local.security_headers["X-Content-Type-Options"]}'};
      headers['x-xss-protection'] = {value: '${local.security_headers["X-XSS-Protection"]}'};
      headers['strict-transport-security'] = {value: '${local.security_headers["Strict-Transport-Security"]}'};
      headers['content-security-policy'] = {value: '${local.security_headers["Content-Security-Policy"]}'};
      
      return response;
    }
  EOT
}

# Outputs for reference
output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.web.id
}

output "cloudfront_domain_name" {
  description = "CloudFront domain name"
  value       = aws_cloudfront_distribution.web.domain_name
}

output "website_url" {
  description = "Complete website URL"
  value       = "https://${var.domain_name}"
}

output "health_check_id" {
  description = "Route53 health check ID"
  value       = var.create_dns_record ? aws_route53_health_check.web[0].id : null
}