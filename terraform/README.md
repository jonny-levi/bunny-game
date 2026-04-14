# Bunny Family - Terraform Infrastructure

This directory contains the complete AWS infrastructure as code for the Bunny Family cooperative Tamagotchi game.

## 🏗️ Infrastructure Components

### Core Infrastructure:
- **VPC**: Multi-AZ with public/private subnets
- **ECS Fargate**: Serverless container orchestration
- **ALB**: Application Load Balancer with WebSocket support
- **ElastiCache Redis**: Game state persistence
- **S3 + CloudFront**: Static asset CDN
- **Route53**: DNS management (optional)
- **CloudWatch**: Comprehensive monitoring

### Security:
- **Security Groups**: Minimal required access
- **ACM**: SSL/TLS certificates
- **IAM**: Least privilege roles and policies
- **VPC Flow Logs**: Network monitoring (optional)

## 📁 Directory Structure

```
terraform/
├── main.tf                 # Main Terraform configuration
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── modules/                # Reusable modules
│   ├── networking/         # VPC, subnets, gateways
│   ├── ecs/               # ECS cluster and service
│   ├── database/          # ElastiCache Redis
│   ├── cdn/               # CloudFront + S3
│   └── monitoring/        # CloudWatch dashboards/alarms
└── environments/          # Environment-specific configs
    ├── dev.tfvars         # Development settings
    └── prod.tfvars        # Production settings
```

## 🚀 Quick Start

### Prerequisites:
```bash
# Install Terraform
terraform --version  # Should be >= 1.0

# Configure AWS CLI
aws configure
```

### Initialize and Deploy:
```bash
# Initialize Terraform
terraform init

# Plan development deployment
terraform plan -var-file="environments/dev.tfvars"

# Apply development deployment
terraform apply -var-file="environments/dev.tfvars"
```

### Production Deployment:
```bash
terraform plan -var-file="environments/prod.tfvars"
terraform apply -var-file="environments/prod.tfvars"
```

## 🔧 Configuration

### Key Variables:

| Variable | Description | Dev Default | Prod Default |
|----------|-------------|-------------|--------------|
| `environment` | Environment name | `dev` | `prod` |
| `ecs_cpu` | ECS task CPU | `256` | `1024` |
| `ecs_memory` | ECS task memory | `512` | `2048` |
| `use_fargate_spot` | Use Spot instances | `true` | `false` |
| `redis_node_type` | Redis instance type | `cache.t3.micro` | `cache.t3.small` |
| `enable_nat_gateway` | NAT Gateway for private subnets | `false` | `true` |

### Environment Files:
- **`dev.tfvars`**: Cost-optimized for development
- **`prod.tfvars`**: Performance and reliability optimized

## 📊 Outputs

After deployment, Terraform provides:

```bash
# View all outputs
terraform output

# Specific outputs
terraform output application_url
terraform output load_balancer_dns
terraform output redis_endpoint
```

### Key Outputs:
- **Application URL**: Main game URL
- **Load Balancer DNS**: ALB endpoint
- **ECR Repository**: Docker image registry
- **CloudWatch Dashboard**: Monitoring URL

## 🛡️ Security Features

### Network Security:
- Private subnets for application/database
- Security groups with minimal access
- NAT Gateway for outbound internet

### Application Security:
- ECS tasks run as non-root user
- Redis with authentication
- SSL/TLS termination at ALB

### Monitoring:
- CloudWatch alarms for key metrics
- Centralized logging
- Custom dashboards

## 💰 Cost Optimization

### Development:
- **Fargate Spot**: 70% cost savings
- **No NAT Gateway**: Cost reduction
- **Smaller instances**: Minimal resources
- **Short log retention**: 3-7 days

### Production:
- **Auto-scaling**: Scale with demand
- **Multi-AZ**: High availability
- **Reserved capacity**: Long-term savings
- **Monitoring**: Usage optimization

## 🔍 Monitoring

### CloudWatch Dashboards:
- ECS service health
- ALB performance
- Redis metrics
- Application-specific metrics

### Alarms:
- High CPU/memory usage
- Service failures
- Error rate thresholds
- Database performance

### Custom Metrics:
- Socket connections
- Game actions
- Room creation rate

## 🚨 Troubleshooting

### Common Issues:

1. **Terraform Init Fails**:
   - Check AWS credentials
   - Verify S3 state bucket exists
   - Ensure proper permissions

2. **ECS Service Won't Start**:
   - Check security groups
   - Verify ECR image exists
   - Review ECS task definition

3. **Redis Connection Issues**:
   - Verify security groups
   - Check subnet routing
   - Confirm auth token

### Debug Commands:
```bash
# View current state
terraform show

# Check resource status
terraform state list

# Import existing resources (if needed)
terraform import aws_instance.example i-1234567890abcdef0

# Refresh state from AWS
terraform refresh
```

## 🔄 Updates and Maintenance

### Infrastructure Updates:
```bash
# Plan changes
terraform plan -var-file="environments/dev.tfvars"

# Apply updates
terraform apply -var-file="environments/dev.tfvars"
```

### Application Updates:
1. Build and push new Docker image
2. Update ECS task definition
3. Force new deployment

### Scaling:
- Modify `ecs_min_capacity`/`ecs_max_capacity`
- Update instance types
- Adjust auto-scaling thresholds

## 📈 Scaling Considerations

### Horizontal Scaling:
- Increase ECS desired count
- Multi-region deployment
- Database read replicas

### Vertical Scaling:
- Larger instance types
- More CPU/memory allocation
- Enhanced monitoring

### Performance Optimization:
- CloudFront caching strategy
- Redis optimization
- Connection pooling

## 🔒 State Management

### Remote State:
```hcl
terraform {
  backend "s3" {
    bucket = "your-terraform-state-bucket"
    key    = "bunny-family/terraform.tfstate"
    region = "us-east-1"
  }
}
```

### State Locking:
- Use DynamoDB table for state locking
- Prevents concurrent modifications
- Ensures state consistency

## 📚 Module Documentation

Each module contains:
- `main.tf`: Resource definitions
- `variables.tf`: Input parameters
- `outputs.tf`: Export values
- Individual README files

### Module Dependencies:
```
networking → database
networking → ecs
ecs → monitoring
cdn → (independent)
```

## 🛠️ Development

### Adding New Resources:
1. Create in appropriate module
2. Add variables as needed
3. Export outputs
4. Update main configuration

### Testing Changes:
```bash
# Validate syntax
terraform validate

# Format code
terraform fmt

# Plan with different variables
terraform plan -var="ecs_cpu=512"
```

## 📞 Support

For infrastructure issues:
1. Check this README
2. Review module documentation
3. Validate AWS permissions
4. Test components individually

---

**Infrastructure as Code for Bunny Family! 🐰☁️**