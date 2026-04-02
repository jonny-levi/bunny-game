# Variables for Monitoring Module

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "alb_arn_suffix" {
  description = "ALB ARN suffix for monitoring"
  type        = string
}

variable "ecs_service_name" {
  description = "ECS service name"
  type        = string
}

variable "ecs_cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "redis_cluster_id" {
  description = "Redis cluster ID"
  type        = string
}

variable "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  type        = string
}

variable "ecs_log_group_name" {
  description = "ECS log group name"
  type        = string
}

variable "enable_cloudfront_realtime_logs" {
  description = "Enable CloudFront real-time logs"
  type        = bool
  default     = false
}

variable "enable_application_monitoring" {
  description = "Enable application-specific monitoring"
  type        = bool
  default     = true
}

variable "notification_email" {
  description = "Email address for notifications"
  type        = string
  default     = ""
}