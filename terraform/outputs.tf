# Terraform Outputs for Bunny Family Game

# Application URLs
output "application_url" {
  description = "Primary application URL"
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "https://${aws_lb.main.dns_name}"
}

output "load_balancer_dns" {
  description = "Application Load Balancer DNS name"
  value       = aws_lb.main.dns_name
}

output "cloudfront_distribution_url" {
  description = "CloudFront distribution URL for static assets"
  value       = aws_cloudfront_distribution.static_assets.domain_name
}

# Infrastructure Details
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = module.networking.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = module.networking.public_subnet_ids
}

# ECS Information
output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs.service_name
}

output "ecs_task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = module.ecs.task_definition_arn
}

# Database Information
output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.database.redis_endpoint
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = module.database.redis_port
}

# Security Groups
output "alb_security_group_id" {
  description = "Security group ID for ALB"
  value       = aws_security_group.alb.id
}

output "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  value       = aws_security_group.ecs_tasks.id
}

# S3 Information
output "static_assets_bucket_name" {
  description = "Name of S3 bucket for static assets"
  value       = aws_s3_bucket.static_assets.bucket
}

output "static_assets_bucket_domain" {
  description = "Domain name of S3 bucket"
  value       = aws_s3_bucket.static_assets.bucket_domain_name
}

# CloudWatch Information
output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.app.name
}

# SSL Certificate
output "ssl_certificate_arn" {
  description = "ACM SSL certificate ARN"
  value       = var.enable_ssl ? aws_acm_certificate.main[0].arn : null
}

# Route53 Information (if applicable)
output "route53_zone_id" {
  description = "Route53 hosted zone ID"
  value       = var.create_route53_zone ? aws_route53_zone.main[0].zone_id : null
}

output "route53_name_servers" {
  description = "Route53 name servers"
  value       = var.create_route53_zone ? aws_route53_zone.main[0].name_servers : null
}

# Auto Scaling Information
output "autoscaling_target_arn" {
  description = "Application Auto Scaling target ARN"
  value       = aws_appautoscaling_target.ecs_target.arn
}

# ECR Repository (if needed)
output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.app.repository_url
}

# Environment Information
output "environment" {
  description = "Deployment environment"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

# Cost tracking tags
output "common_tags" {
  description = "Common tags applied to resources"
  value = {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "Terraform"
  }
}

# Debugging information
output "deployment_summary" {
  description = "Summary of deployment configuration"
  value = {
    environment           = var.environment
    region               = var.aws_region
    ecs_cpu              = var.ecs_cpu
    ecs_memory           = var.ecs_memory
    desired_count        = var.ecs_desired_count
    use_fargate_spot     = var.use_fargate_spot
    redis_node_type      = var.redis_node_type
    ssl_enabled          = var.enable_ssl
    domain_configured    = var.domain_name != ""
    route53_zone_created = var.create_route53_zone
  }
}