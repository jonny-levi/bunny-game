# Outputs for Monitoring Module

output "sns_topic_arn" {
  description = "SNS topic ARN for alerts"
  value       = aws_sns_topic.alerts.arn
}

output "dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = "https://${var.aws_region}.console.aws.amazon.com/cloudwatch/home?region=${var.aws_region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}

output "dashboard_name" {
  description = "CloudWatch dashboard name"
  value       = aws_cloudwatch_dashboard.main.dashboard_name
}

output "alarm_names" {
  description = "List of CloudWatch alarm names"
  value = [
    aws_cloudwatch_metric_alarm.alb_response_time.alarm_name,
    aws_cloudwatch_metric_alarm.alb_5xx_errors.alarm_name,
    aws_cloudwatch_metric_alarm.ecs_cpu_high.alarm_name,
    aws_cloudwatch_metric_alarm.ecs_memory_high.alarm_name,
    aws_cloudwatch_metric_alarm.ecs_running_tasks_low.alarm_name
  ]
}

output "log_insights_queries" {
  description = "CloudWatch Insights query definitions"
  value = [
    aws_cloudwatch_query_definition.ecs_errors.name,
    aws_cloudwatch_query_definition.socket_connections.name,
    aws_cloudwatch_query_definition.game_actions.name
  ]
}

output "custom_metrics" {
  description = "Custom metrics created for application monitoring"
  value = {
    socket_connections = "${var.project_name}/${var.environment}/SocketConnections"
    rooms_created      = "${var.project_name}/${var.environment}/RoomsCreated" 
    game_actions       = "${var.project_name}/${var.environment}/GameActions"
  }
}