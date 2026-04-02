# Database Module for Bunny Family Game
# ElastiCache Redis for game state persistence

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project_name}-${var.environment}-cache-subnet"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${var.project_name}-${var.environment}-cache-subnet-group"
  }
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  family = "redis7.x"
  name   = "${var.project_name}-${var.environment}-cache-params"

  # Optimizations for gaming workload
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "60"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cache-params"
  }
}

# ElastiCache Replication Group (Redis)
resource "aws_elasticache_replication_group" "main" {
  replication_group_id         = "${var.project_name}-${var.environment}-redis"
  description                  = "Redis cluster for ${var.project_name} ${var.environment}"
  
  # Node configuration
  node_type                    = var.node_type
  port                        = var.port
  parameter_group_name        = aws_elasticache_parameter_group.main.name
  
  # Cluster configuration
  num_cache_clusters          = var.num_cache_nodes
  
  # Network & Security
  subnet_group_name           = aws_elasticache_subnet_group.main.name
  security_group_ids          = [var.redis_security_group_id]
  
  # Authentication
  auth_token                  = var.auth_token
  transit_encryption_enabled  = true
  at_rest_encryption_enabled  = true
  
  # Backup configuration
  snapshot_retention_limit    = var.backup_retention_limit
  snapshot_window            = var.backup_window
  
  # Maintenance
  maintenance_window         = var.maintenance_window
  
  # Notifications
  notification_topic_arn     = var.enable_notifications ? aws_sns_topic.cache_notifications[0].arn : null
  
  # Auto failover (only for multi-node clusters)
  automatic_failover_enabled = var.num_cache_nodes > 1 ? true : false
  multi_az_enabled          = var.num_cache_nodes > 1 ? var.multi_az_enabled : false
  
  # Performance insights
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis"
  }
}

# CloudWatch Log Group for Redis slow log
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/${var.project_name}-${var.environment}/slow-log"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-slow-log"
  }
}

# SNS Topic for ElastiCache notifications (optional)
resource "aws_sns_topic" "cache_notifications" {
  count = var.enable_notifications ? 1 : 0
  name  = "${var.project_name}-${var.environment}-cache-notifications"

  tags = {
    Name = "${var.project_name}-${var.environment}-cache-notifications"
  }
}

# CloudWatch Alarms for Redis monitoring
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-redis-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors redis cpu utilization"
  alarm_actions       = var.enable_notifications ? [aws_sns_topic.cache_notifications[0].arn] : []

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.replication_group_id}-001"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-cpu-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-redis-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "90"
  alarm_description   = "This metric monitors redis memory utilization"
  alarm_actions       = var.enable_notifications ? [aws_sns_topic.cache_notifications[0].arn] : []

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.replication_group_id}-001"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-memory-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_connections" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-redis-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "50"
  alarm_description   = "This metric monitors redis connection count"
  alarm_actions       = var.enable_notifications ? [aws_sns_topic.cache_notifications[0].arn] : []

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.replication_group_id}-001"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-connections-alarm"
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_evictions" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.project_name}-${var.environment}-redis-evictions"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Evictions"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors redis evictions"
  alarm_actions       = var.enable_notifications ? [aws_sns_topic.cache_notifications[0].arn] : []

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.replication_group_id}-001"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-redis-evictions-alarm"
  }
}