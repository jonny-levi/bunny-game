# Production Environment Configuration for Bunny Family Game

# Environment
environment = "prod"
aws_region  = "us-east-1"

# Networking (multi-AZ for redundancy)
vpc_cidr              = "10.0.0.0/16"
public_subnet_cidrs   = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs  = ["10.0.10.0/24", "10.0.20.0/24"]
availability_zones    = ["us-east-1a", "us-east-1b"]

# High Availability & Performance
enable_nat_gateway    = true
single_nat_gateway    = false  # Multi-AZ NAT for redundancy
use_fargate_spot      = false  # Use On-Demand for reliability

# ECS Configuration (production sizing)
ecs_cpu           = 1024       # 1 vCPU
ecs_memory        = 2048       # 2 GB
ecs_desired_count = 2          # Multiple instances
ecs_min_capacity  = 2
ecs_max_capacity  = 8

# Redis Configuration (performance optimized)
redis_node_type = "cache.t3.small"
redis_backup_retention_limit = 7
redis_backup_window = "03:00-05:00"

# CloudFront Configuration (global performance)
cloudfront_price_class = "PriceClass_All"  # Global edge locations
cloudfront_min_ttl     = 0
cloudfront_default_ttl = 86400   # 24 hours
cloudfront_max_ttl     = 31536000 # 1 year

# Monitoring & Observability
enable_detailed_monitoring = true
log_retention_days         = 30
enable_vpc_flow_logs       = true

# SSL/DNS (production domain)
enable_ssl          = true
create_route53_zone = true
domain_name         = "bunnyfamily.game"  # Replace with actual domain

# Auto-scaling (aggressive for performance)
cpu_target_value    = 60
memory_target_value = 70
scale_up_cooldown   = 180    # Faster scale up
scale_down_cooldown = 600    # Slower scale down

# Security (restrictive)
allowed_cidr_blocks = ["0.0.0.0/0"]  # Adjust for specific IP ranges if needed

# Application Environment Variables
app_environment_variables = {
  NODE_ENV = "production"
  PORT     = "3000"
  LOG_LEVEL = "info"
}

# Additional Production Settings
alb_idle_timeout = 120  # Longer timeout for WebSocket connections