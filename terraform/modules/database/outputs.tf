# Outputs for Database Module

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.main.configuration_endpoint_address != "" ? aws_elasticache_replication_group.main.configuration_endpoint_address : aws_elasticache_replication_group.main.primary_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_replication_group_id" {
  description = "Redis replication group ID"
  value       = aws_elasticache_replication_group.main.replication_group_id
}

output "redis_replication_group_arn" {
  description = "Redis replication group ARN"
  value       = aws_elasticache_replication_group.main.arn
}

output "redis_subnet_group_name" {
  description = "Redis subnet group name"
  value       = aws_elasticache_subnet_group.main.name
}

output "redis_parameter_group_name" {
  description = "Redis parameter group name"
  value       = aws_elasticache_parameter_group.main.name
}

output "redis_cluster_nodes" {
  description = "Redis cluster member nodes"
  value       = aws_elasticache_replication_group.main.member_clusters
}

output "sns_topic_arn" {
  description = "SNS topic ARN for notifications"
  value       = var.enable_notifications ? aws_sns_topic.cache_notifications[0].arn : null
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name for Redis slow log"
  value       = aws_cloudwatch_log_group.redis_slow_log.name
}