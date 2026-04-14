# Development Environment Configuration for Bunny Family Game

# Environment
environment = "dev"
aws_region  = "us-east-1"

# Networking (smaller for cost)
vpc_cidr              = "10.0.0.0/16"
public_subnet_cidrs   = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs  = ["10.0.10.0/24", "10.0.20.0/24"]
availability_zones    = ["us-east-1a", "us-east-1b"]

# Cost Optimizations
enable_nat_gateway    = false  # Disable for cost savings in dev
single_nat_gateway    = true
use_fargate_spot      = true   # Use Spot instances

# ECS Configuration (minimal for dev)
ecs_cpu           = 256        # 0.25 vCPU
ecs_memory        = 512        # 512 MB
ecs_desired_count = 1
ecs_min_capacity  = 1
ecs_max_capacity  = 2

# Redis Configuration (smallest instance)
redis_node_type = "cache.t3.micro"
redis_backup_retention_limit = 1  # Minimal backups

# CloudFront Configuration
cloudfront_price_class = "PriceClass_100"  # Cheapest option
cloudfront_min_ttl     = 0
cloudfront_default_ttl = 3600    # 1 hour
cloudfront_max_ttl     = 86400   # 24 hours

# Monitoring (reduced for cost)
enable_detailed_monitoring = false
log_retention_days         = 3  # Shorter retention
enable_vpc_flow_logs       = false

# SSL/DNS (optional for dev)
enable_ssl          = false  # Can use ALB DNS directly
create_route53_zone = false
domain_name         = ""

# Auto-scaling thresholds (more relaxed)
cpu_target_value    = 80
memory_target_value = 85

# Security (more permissive for dev)
allowed_cidr_blocks = ["0.0.0.0/0"]

# Application Environment Variables
app_environment_variables = {
  NODE_ENV = "development"
  PORT     = "3000"
  LOG_LEVEL = "debug"
}