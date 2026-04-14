# 🚀 Bunny Family Game - AWS Deployment Guide

This guide covers deploying the Bunny Family cooperative Tamagotchi game to AWS using Terraform, ECS Fargate, and supporting infrastructure.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   CloudFront    │───▶│ Route53/ALB  │───▶│  ECS Fargate    │
│   (CDN/Assets)  │    │ (Load Bal.)  │    │ (Node.js App)   │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                    │
┌─────────────────┐    ┌──────────────┐            │
│   S3 Bucket     │    │ ElastiCache  │◀───────────┘
│ (Static Assets) │    │   (Redis)    │
└─────────────────┘    └──────────────┘

         ┌──────────────────────────────────┐
         │         CloudWatch               │
         │  (Logs, Metrics, Monitoring)     │
         └──────────────────────────────────┘
```

### Key Components:
- **ECS Fargate**: Serverless containers for the Node.js backend
- **ALB**: Application Load Balancer with WebSocket support
- **ElastiCache Redis**: Game state persistence and session storage
- **S3 + CloudFront**: Static asset hosting and global CDN
- **Route53**: DNS management (optional)
- **CloudWatch**: Monitoring, logging, and alerting

## 📋 Prerequisites

### Required Tools:
```bash
# Install Terraform
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install terraform

# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# Install Docker
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo usermod -aG docker $USER
```

### AWS Configuration:
```bash
# Configure AWS credentials
aws configure
# or use environment variables:
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
```

### Required AWS Permissions:
Your AWS user/role needs permissions for:
- EC2 (VPC, subnets, security groups)
- ECS (clusters, services, tasks)
- ElastiCache (Redis clusters)
- S3 (buckets and objects)
- CloudFront (distributions)
- Application Load Balancer
- Route53 (if using custom domain)
- CloudWatch (logs and metrics)
- IAM (roles and policies)

## 🚀 Deployment Steps

### 1. Initial Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd bunny-game

# Create S3 bucket for Terraform state (replace with unique name)
aws s3 mb s3://your-terraform-state-bucket-name --region us-east-1

# Enable versioning on state bucket
aws s3api put-bucket-versioning \
  --bucket your-terraform-state-bucket-name \
  --versioning-configuration Status=Enabled
```

### 2. Configure Terraform Backend

Create `terraform/backend.tf`:
```hcl
terraform {
  backend "s3" {
    bucket = "your-terraform-state-bucket-name"
    key    = "bunny-family/terraform.tfstate"
    region = "us-east-1"
  }
}
```

### 3. Initialize Terraform

```bash
cd terraform
terraform init
```

### 4. Plan Deployment

For **development** environment:
```bash
terraform plan -var-file="environments/dev.tfvars" -out=dev.tfplan
```

For **production** environment:
```bash
terraform plan -var-file="environments/prod.tfvars" -out=prod.tfplan
```

### 5. Deploy Infrastructure

```bash
# Deploy development
terraform apply dev.tfplan

# OR deploy production
terraform apply prod.tfplan
```

### 6. Build and Push Docker Image

```bash
# Get ECR login token
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build production image
docker build -f Dockerfile.prod -t bunny-family:latest .

# Tag for ECR
docker tag bunny-family:latest \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/bunny-family-dev:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/bunny-family-dev:latest
```

### 7. Update ECS Service

```bash
# Force new deployment with updated image
aws ecs update-service \
  --cluster bunny-family-dev-cluster \
  --service bunny-family-dev-service \
  --force-new-deployment
```

### 8. Deploy Static Assets

```bash
# Upload frontend files to S3
aws s3 sync frontend/ s3://bunny-family-dev-static-assets/ --delete

# Invalidate CloudFront cache (if using)
aws cloudfront create-invalidation \
  --distribution-id <distribution-id> \
  --paths "/*"
```

## 🔧 Configuration

### Environment Variables

The application supports these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Application port | `3000` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_AUTH_TOKEN` | Redis password | (none) |
| `LOG_LEVEL` | Logging level | `info` |

### Terraform Variables

Key variables to customize in your `.tfvars` files:

```hcl
# Environment
environment = "dev"  # or "prod"
project_name = "bunny-family"

# Domain (optional)
domain_name = "yourdomain.com"
create_route53_zone = true

# ECS Configuration
ecs_cpu = 512
ecs_memory = 1024
ecs_desired_count = 2

# Cost Optimization
use_fargate_spot = true  # false for prod
enable_nat_gateway = false  # true for prod
```

## 📊 Monitoring

### CloudWatch Dashboard

After deployment, access your dashboard at:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=bunny-family-dev-dashboard
```

### Key Metrics to Monitor:

1. **ECS Service Health**
   - Running task count
   - CPU/Memory utilization
   - Service stability

2. **Application Performance**
   - ALB response times
   - Request count and error rates
   - WebSocket connections

3. **Redis Performance**
   - Memory usage
   - Connection count
   - Cache hit ratio

4. **Cost Monitoring**
   - ECS task hours
   - Data transfer costs
   - ElastiCache usage

### Alarms

The deployment includes CloudWatch alarms for:
- High CPU/memory usage
- Service failures
- High error rates
- Redis performance issues

## 🛡️ Security

### Network Security:
- VPC with public/private subnets
- Security groups with minimal required access
- NAT Gateway for outbound internet access
- Private subnets for application and database

### Application Security:
- Non-root container user
- Security headers configured
- CORS properly configured
- Redis authentication enabled

### SSL/TLS:
- ACM certificates for HTTPS
- CloudFront with SSL termination
- ALB with HTTPS listeners

## 💰 Cost Optimization

### Development Environment:
- **Fargate Spot**: ~70% cost savings
- **Smaller instances**: t3.micro Redis, minimal ECS resources
- **Disable NAT Gateway**: Use public subnets for dev
- **Shorter log retention**: 3-7 days

### Production Environment:
- **Multi-AZ**: For high availability
- **Auto-scaling**: Scale based on demand
- **Reserved instances**: For predictable workloads
- **CloudWatch**: Monitor and optimize resource usage

### Estimated Monthly Costs:

**Development:**
- ECS Fargate (Spot): $10-15
- Redis t3.micro: $15
- ALB: $16
- **Total: ~$41-46/month**

**Production:**
- ECS Fargate: $30-50
- Redis t3.small: $30
- ALB: $16
- CloudFront: $5-10
- **Total: ~$81-106/month**

## 🚨 Troubleshooting

### Common Issues:

1. **ECS Tasks Failing to Start**
   ```bash
   # Check ECS logs
   aws logs get-log-events \
     --log-group-name /ecs/bunny-family-dev \
     --log-stream-name ecs/bunny-family/<task-id>
   ```

2. **Redis Connection Issues**
   ```bash
   # Test Redis connectivity from ECS task
   aws ecs execute-command \
     --cluster bunny-family-dev-cluster \
     --task <task-id> \
     --container bunny-family \
     --interactive \
     --command "/bin/sh"
   ```

3. **Load Balancer Issues**
   ```bash
   # Check target health
   aws elbv2 describe-target-health \
     --target-group-arn <target-group-arn>
   ```

4. **High Memory Usage**
   - Check Redis memory configuration
   - Review application memory leaks
   - Consider larger instance types

### Debug Commands:

```bash
# View Terraform state
terraform show

# Get ECS service status
aws ecs describe-services \
  --cluster bunny-family-dev-cluster \
  --services bunny-family-dev-service

# View CloudWatch logs
aws logs tail /ecs/bunny-family-dev --follow

# Test health endpoint
curl https://your-alb-url/health
```

## 🔄 CI/CD Pipeline

The included GitHub Actions workflow provides:

1. **Automated Testing**
2. **Docker Image Building**
3. **ECR Push**
4. **Terraform Deployment**
5. **ECS Service Updates**
6. **Security Scanning**

### Setup GitHub Secrets:

```bash
# Required secrets in GitHub repository settings:
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
TF_STATE_BUCKET=<your-terraform-state-bucket>
CLOUDFRONT_DISTRIBUTION_ID=<your-distribution-id>  # for prod
```

## 🧪 Local Development

### Using Docker Compose:

```bash
# Start local development environment
docker-compose up

# With Redis Commander (for debugging)
docker-compose --profile debug up

# View Redis data
open http://localhost:8081
```

### Using Local Node.js:

```bash
cd backend
npm install
npm run dev:redis  # Uses Redis-enabled server

# In another terminal
cd frontend
# Serve static files with your preferred method
```

## 📈 Scaling

### Horizontal Scaling:
- ECS auto-scaling based on CPU/memory
- Multiple availability zones
- Load balancer distribution

### Vertical Scaling:
- Increase ECS task CPU/memory
- Larger Redis instance types
- Enhanced monitoring

### Global Scaling:
- CloudFront global edge locations
- Multi-region deployments (advanced)

## 📚 Additional Resources

- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/intro.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Redis for Gaming](https://redis.io/solutions/gaming/)
- [WebSocket Scaling](https://socket.io/docs/v4/scaling-up/)

## 🆘 Support

For deployment issues:
1. Check this deployment guide
2. Review CloudWatch logs
3. Verify AWS permissions
4. Test components individually
5. Create GitHub issues for bugs

---

**Happy Deploying! 🐰❤️**

*Bunny Family - Where families grow together in the cloud*