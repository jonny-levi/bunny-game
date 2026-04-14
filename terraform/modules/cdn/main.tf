# CDN Module for Bunny Family Game
# CloudFront distribution with S3 origin for static assets

# S3 Bucket for static assets
resource "aws_s3_bucket" "static_assets" {
  bucket        = "${var.project_name}-${var.environment}-static-${random_string.bucket_suffix.result}"
  force_destroy = var.environment != "prod"

  tags = {
    Name = "${var.project_name}-${var.environment}-static-assets"
  }
}

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id
  versioning_configuration {
    status = var.environment == "prod" ? "Enabled" : "Suspended"
  }
}

# S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket lifecycle configuration
resource "aws_s3_bucket_lifecycle_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  rule {
    id     = "static_assets_lifecycle"
    status = "Enabled"

    # Delete old versions after 30 days
    noncurrent_version_expiration {
      noncurrent_days = 30
    }

    # Transition to IA after 30 days
    transition {
      days          = 30
      storage_class = "STANDARD_INFREQUENT_ACCESS"
    }

    # Clean up incomplete multipart uploads
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "static_assets" {
  comment = "${var.project_name} ${var.environment} OAI for static assets"
}

# S3 bucket policy for CloudFront
resource "aws_s3_bucket_policy" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontAccess"
        Effect = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.static_assets.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.static_assets.arn}/*"
      }
    ]
  })
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "static_assets" {
  # S3 Origin for static assets
  origin {
    domain_name = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.static_assets.bucket}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.static_assets.cloudfront_access_identity_path
    }
  }

  # ALB Origin for dynamic content
  origin {
    domain_name = var.alb_domain_name
    origin_id   = "ALB-${var.project_name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} ${var.environment} CDN"
  default_root_object = "index.html"

  # Domain aliases
  aliases = var.enable_ssl && var.domain_name != "" ? [
    var.domain_name,
    "www.${var.domain_name}",
    "static.${var.domain_name}"
  ] : []

  # Default behavior for API/WebSocket traffic (ALB)
  default_cache_behavior {
    target_origin_id       = "ALB-${var.project_name}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    allowed_methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods  = ["GET", "HEAD", "OPTIONS"]

    forwarded_values {
      query_string = true
      headers      = ["Host", "Origin", "Referer", "User-Agent", "CloudFront-Forwarded-Proto"]

      cookies {
        forward = "all"
      }
    }

    # Optimized for real-time gaming
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 86400

    # Enable WebSocket support
    trusted_signers = []
  }

  # Cached behavior for static assets (S3)
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    target_origin_id = "S3-${aws_s3_bucket.static_assets.bucket}"

    viewer_protocol_policy = "redirect-to-https"
    compress              = true

    allowed_methods = ["GET", "HEAD", "OPTIONS"]
    cached_methods  = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = var.min_ttl
    default_ttl = var.default_ttl
    max_ttl     = var.max_ttl
  }

  # Cached behavior for game assets
  ordered_cache_behavior {
    path_pattern     = "*.js"
    target_origin_id = "S3-${aws_s3_bucket.static_assets.bucket}"

    viewer_protocol_policy = "redirect-to-https"
    compress              = true

    allowed_methods = ["GET", "HEAD"]
    cached_methods  = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = var.min_ttl
    default_ttl = var.default_ttl
    max_ttl     = var.max_ttl
  }

  # Cached behavior for CSS files
  ordered_cache_behavior {
    path_pattern     = "*.css"
    target_origin_id = "S3-${aws_s3_bucket.static_assets.bucket}"

    viewer_protocol_policy = "redirect-to-https"
    compress              = true

    allowed_methods = ["GET", "HEAD"]
    cached_methods  = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = var.min_ttl
    default_ttl = var.default_ttl
    max_ttl     = var.max_ttl
  }

  # Cached behavior for images
  ordered_cache_behavior {
    path_pattern     = "*.{png,jpg,jpeg,gif,ico,svg,webp}"
    target_origin_id = "S3-${aws_s3_bucket.static_assets.bucket}"

    viewer_protocol_policy = "redirect-to-https"
    compress              = true

    allowed_methods = ["GET", "HEAD"]
    cached_methods  = ["GET", "HEAD"]

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = var.min_ttl
    default_ttl = var.default_ttl
    max_ttl     = var.max_ttl
  }

  price_class = var.price_class

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    # Use ACM certificate if SSL is enabled and domain is provided
    dynamic "acm_certificate_arn" {
      for_each = var.enable_ssl && var.certificate_arn != null ? [1] : []
      content {
        acm_certificate_arn      = var.certificate_arn
        ssl_support_method       = "sni-only"
        minimum_protocol_version = "TLSv1.2_2019"
      }
    }

    # Use CloudFront default certificate otherwise
    dynamic "cloudfront_default_certificate" {
      for_each = var.enable_ssl && var.certificate_arn != null ? [] : [1]
      content {
        cloudfront_default_certificate = true
      }
    }
  }

  # Custom error pages
  custom_error_response {
    error_caching_min_ttl = 300
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
  }

  custom_error_response {
    error_caching_min_ttl = 300
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
  }

  tags = {
    Name = "${var.project_name}-${var.environment}-cdn"
  }
}

# CloudWatch Log Group for CloudFront access logs (optional)
resource "aws_cloudwatch_log_group" "cloudfront_access_logs" {
  count = var.enable_cloudfront_logging ? 1 : 0

  name              = "/aws/cloudfront/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-${var.environment}-cloudfront-logs"
  }
}