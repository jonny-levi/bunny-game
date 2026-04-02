# Deployment Security Checklist

This checklist ensures the Bunny Family game is deployed securely in production environments.

## Environment Configuration

### Required Environment Variables

```bash
# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Connection Limits (optional - defaults provided)
MAX_CONNECTIONS_PER_IP=10
MAX_TOTAL_CONNECTIONS=1000

# Node.js Security
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=512"
```

### Optional Environment Variables

```bash
# Custom rate limits
RATE_LIMIT_CREATE_ROOM=5
RATE_LIMIT_JOIN_ROOM=5
RATE_LIMIT_GAME_ACTIONS=10

# Monitoring
LOG_LEVEL=warn
ENABLE_METRICS=true
```

## Pre-Deployment Checklist

### Security Hardening
- [ ] All dependencies updated to latest secure versions
- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] CORS configured for specific domains (no wildcards)
- [ ] Rate limiting enabled and tested
- [ ] Input validation enforced on all endpoints
- [ ] Error messages sanitized (no sensitive data exposure)
- [ ] File upload restrictions in place
- [ ] Connection limits configured appropriately

### Docker Security
- [ ] Container runs as non-root user
- [ ] Minimal base image used (Alpine Linux)
- [ ] Security updates installed in container
- [ ] Health check configured properly
- [ ] No secrets in Dockerfile or environment

### Network Security  
- [ ] HTTPS/TLS enabled (use reverse proxy like nginx)
- [ ] WebSocket connections secured (wss://)
- [ ] Firewall rules restrict access to necessary ports only
- [ ] DDoS protection configured (CloudFlare, AWS Shield, etc.)

### Monitoring & Logging
- [ ] Security event logging enabled
- [ ] Rate limit violations monitored
- [ ] Failed authentication attempts tracked
- [ ] Resource usage monitoring (CPU, memory, connections)
- [ ] Error rate monitoring and alerting

## Production Deployment Steps

### 1. Build and Test
```bash
# Security audit
npm audit --audit-level moderate

# Build production image
docker build -t bunny-game:latest .

# Test security configurations
docker run -e NODE_ENV=production bunny-game:latest npm test
```

### 2. Environment Setup
```bash
# Set secure environment variables
export NODE_ENV=production
export ALLOWED_ORIGINS=https://yourdomain.com

# Ensure proper file permissions
chown -R node:node /app
chmod -R 755 /app
```

### 3. Deploy with Security
```bash
# Run container with security options
docker run -d \
  --name bunny-game \
  --restart unless-stopped \
  --read-only \
  --tmpfs /tmp \
  --security-opt="no-new-privileges:true" \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e ALLOWED_ORIGINS=https://yourdomain.com \
  bunny-game:latest
```

### 4. Reverse Proxy (nginx example)
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Limit request size
    client_max_body_size 1M;
    
    # Rate limiting
    limit_req zone=api burst=10 nodelay;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## Post-Deployment Verification

### Security Tests
- [ ] Verify CORS restrictions work correctly
- [ ] Test rate limiting triggers properly
- [ ] Confirm input validation blocks malicious payloads
- [ ] Check error messages don't expose sensitive info
- [ ] Verify WebSocket connections use secure protocols
- [ ] Test connection limits work as expected

### Monitoring Setup
- [ ] Security log monitoring configured
- [ ] Alerting for suspicious activity enabled
- [ ] Performance monitoring baseline established
- [ ] Backup and recovery procedures tested

## Incident Response

### Security Incident Checklist
- [ ] Isolate affected systems
- [ ] Document timeline and evidence
- [ ] Notify security team/stakeholders
- [ ] Apply immediate mitigations
- [ ] Conduct root cause analysis
- [ ] Update security measures
- [ ] Test all fixes thoroughly

### Emergency Contacts
- Security Team: [security@yourcompany.com]
- DevOps Team: [devops@yourcompany.com]  
- On-call Engineer: [oncall@yourcompany.com]

## Regular Maintenance

### Weekly
- [ ] Review security logs
- [ ] Check for dependency updates
- [ ] Monitor resource usage trends

### Monthly  
- [ ] Run security audit (`npm audit`)
- [ ] Review and test backup procedures
- [ ] Update security configurations if needed

### Quarterly
- [ ] Conduct penetration testing
- [ ] Review security policies and procedures
- [ ] Update incident response plans
- [ ] Security training refresher

---

**Last Updated:** March 30, 2026  
**Next Review:** June 30, 2026