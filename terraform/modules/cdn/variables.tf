# Variables for CDN Module

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_100"
  validation {
    condition = contains([
      "PriceClass_All",
      "PriceClass_200",
      "PriceClass_100"
    ], var.price_class)
    error_message = "Price class must be one of: PriceClass_All, PriceClass_200, PriceClass_100."
  }
}

variable "min_ttl" {
  description = "CloudFront minimum TTL"
  type        = number
  default     = 0
}

variable "default_ttl" {
  description = "CloudFront default TTL"
  type        = number
  default     = 86400
}

variable "max_ttl" {
  description = "CloudFront maximum TTL"
  type        = number
  default     = 31536000
}

variable "enable_ssl" {
  description = "Enable SSL/TLS with ACM certificate"
  type        = bool
  default     = true
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

variable "certificate_arn" {
  description = "ACM certificate ARN"
  type        = string
  default     = null
}

variable "alb_domain_name" {
  description = "Application Load Balancer domain name"
  type        = string
}

variable "enable_cloudfront_logging" {
  description = "Enable CloudFront access logging"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch logs retention period in days"
  type        = number
  default     = 7
}