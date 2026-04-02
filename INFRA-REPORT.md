# 🐰❤️ Bunny Family Infrastructure Architecture Report

**Date:** March 30, 2026  
**Analyst:** SysOps Agent  
**Scope:** AWS Cloud Architecture for Bunny Family Cooperative Tamagotchi Game

---

## Executive Summary

Bunny Family is a real-time cooperative multiplayer Tamagotchi game built with Three.js frontend and Node.js backend. The current single-container deployment presents significant scaling challenges due to in-memory state management and WebSocket session affinity requirements.

**Key Infrastructure Challenges:**
- Real-time state synchronization between players
- WebSocket scaling across multiple instances
- Persistent game state (currently lost on restarts)
- Mobile-optimized static asset delivery
- Cost optimization for indie game economics

**Recommended Solution:** Hybrid architecture using ECS Fargate with Redis for state persistence, ALB with sticky sessions for WebSocket support, and CloudFront for global asset distribution.

---

## Current Architecture Analysis

### 🏗️ Existing Infrastructure

```
Current Setup (Home K8s):
┌─────────────────┐
│   Single Pod    │
│ ┌─────────────┐ │    ┌─────────────┐
│ │ Node.js App │ │◄──►│ 2 Players   │
│ │ + Socket.io │ │    │ (WebSocket) │
│ │ + Static    │ │    └─────────────┘
│ │ + In-Memory │ │
│ │   State     │ │
│ └─────────────┘ │
└─────────────────┘
```

**Current Technology Stack:**
- **Frontend**: HTML5 + Three.js + Socket.io Client
- **Backend**: Node.js + Express + Socket.io Server
- **Deployment**: Docker container on K8s
- **State**: In-memory JavaScript Maps
- **Persistence**: None (data lost on restarts)

### 🔍 Code Architecture Deep Dive

**Backend Analysis (`server.js`):**
```javascript
// Critical scalability bottlenecks identified:
const rooms = new Map();           // ❌ In-memory only
const playerSockets = new Map();   // ❌ Lost on restart
class GameRoom {
  gameLoop = setInterval(...)      // ❌ Per-instance timers
  broadcastGameState()             // ❌ Socket.io to specific instances
}
```

**State Management Issues:**
- Game rooms exist only in memory (`rooms` Map)
- Player-socket mapping lost on pod restart
- Game loops run independently per instance
- No state persistence mechanism
- No session recovery for disconnected players

**Frontend Analysis (`game.js` + `index.html`):**
- Three.js 3D rendering (GPU-intensive on client side)
- Socket.io for real-time communication
- Mobile-optimized responsive design
- Static assets: ~2MB (Three.js + game code)
- Touch-optimized for couples on mobile devices

---

## Infrastructure Requirements Analysis

### 🎮 Game Characteristics

**Traffic Patterns:**
- **Room Size**: 2 players maximum (couples)
- **Session Duration**: 30-60 minutes typical
- **Peak Usage**: Evenings/weekends
- **Geographic Distribution**: Global couples
- **Connection Type**: Long-lived WebSocket sessions

**Real-time Requirements:**
- **Latency**: <100ms for action feedback
- **Synchronization**: All actions must sync instantly
- **State Updates**: Every 5 seconds (needs decay loop)
- **Event Broadcasting**: Baby growth, egg hatching events

**Scalability Targets:**
- **Small Scale**: 100-500 concurrent rooms (200-1000 players)
- **Medium Scale**: 1,000-5,000 concurrent rooms
- **Large Scale**: 10,000+ concurrent rooms

### 🗄️ Data Architecture Analysis

**State Categories:**

1. **Real-time Game State** (High frequency, low latency)
   ```javascript
   gameState = {
     carrots: 5,
     babies: [{
       hunger: 80,     // Changes every 5s
       happiness: 80,  // Player actions
       energy: 80,     // Sleep cycles
       cleanliness: 80 // Decay over time
     }],
     dayNightCycle: 'day'
   }
   ```

2. **Session State** (Medium persistence)
   ```javascript
   room = {
     roomCode: "ABC123",
     players: [player1, player2],
     gameStartTime: timestamp,
     lastUpdate: timestamp
   }
   ```

3. **Persistent Progress** (Long-term storage)
   ```javascript
   familyProgress = {
     totalBabiesRaised: 15,
     generationsReached: 3,
     longestSession: 3600000,
     achievements: []
   }
   ```

---

## AWS Architecture Recommendations

### 🏛️ Primary Architecture: ECS Fargate + Redis

```
Recommended AWS Architecture:

                         ┌─────────────────┐
                         │   CloudFront    │
                         │   Global CDN    │
                         └─────┬───────────┘
                               │ Static Assets
                         ┌─────▼───────────┐
                         │    Route 53     │
                         │  DNS Routing    │
                         └─────┬───────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Application Load   │
                    │  Balancer (ALB)     │
                    │  + Sticky Sessions  │
                    └─────┬──────┬────────┘
                          │      │
              ┌───────────▼┐    ┌▼───────────┐
              │ ECS Fargate│    │ ECS Fargate│
              │  Instance  │    │  Instance  │
              │ ┌─────────┐│    │ ┌─────────┐│
              │ │Node.js  ││    │ │Node.js  ││
              │ │Socket.io││    │ │Socket.io││
              │ └─────────┘│    │ └─────────┘│
              └────────┬───┘    └───┬────────┘
                       │            │
                   ┌───▼────────────▼───┐
                   │    ElastiCache     │
                   │    Redis Cluster   │
                   │   (Game State)     │
                   └───┬────────────────┘
                       │
                   ┌───▼────────────────┐
                   │     RDS MySQL      │
                   │  (User Progress)   │
                   └────────────────────┘
```

### 🔧 Detailed Component Design

#### 1. Compute Layer: ECS Fargate

**Why ECS Fargate over alternatives:**

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **ECS Fargate** ✅ | • Serverless containers<br>• Auto-scaling<br>• Lower ops overhead<br>• WebSocket support | • Slightly higher cost than EC2 | **RECOMMENDED** |
| EKS | • Kubernetes native<br>• Maximum control | • High operational complexity<br>• Expensive for small scale | Too complex |
| Lambda | • True serverless<br>• Cost-effective | • ❌ No persistent WebSocket support<br>• 15-min timeout | Incompatible |
| EC2 + ALB | • Lower compute cost | • Manual scaling<br>• Instance management | Too much ops work |

**ECS Configuration:**
```yaml
# Task Definition
Family: bunny-family-game
CPU: 512 # 0.5 vCPU
Memory: 1024 # 1 GB
NetworkMode: awsvpc
RequiresCompatibilities: [FARGATE]

# Service Configuration
DesiredCount: 2  # Start with 2 instances
MinCapacity: 1
MaxCapacity: 20
TargetCPU: 60%   # Scale up at 60% CPU
TargetMemory: 70% # Scale up at 70% memory
```

#### 2. WebSocket Load Balancing: ALB with Sticky Sessions

**Critical Configuration:**
```yaml
LoadBalancer:
  Type: application
  Scheme: internet-facing
  
TargetGroup:
  TargetType: ip
  Protocol: HTTP
  Port: 3000
  HealthCheckPath: /health
  HealthCheckIntervalSeconds: 30
  
  # CRITICAL: Enable sticky sessions for WebSocket
  TargetGroupAttributes:
    - Key: stickiness.enabled
      Value: true
    - Key: stickiness.type
      Value: lb_cookie
    - Key: stickiness.lb_cookie.duration_seconds
      Value: 86400  # 24 hours
```

**WebSocket Support Strategy:**
1. **Session Affinity**: Players stick to same ECS instance during game
2. **Health Checks**: Custom endpoint monitoring WebSocket server health
3. **Graceful Shutdown**: 30-second drain period for active games
4. **Connection Recovery**: Client-side reconnection logic

#### 3. State Management: Redis-Based Hybrid Approach

**Redis Architecture:**
```
ElastiCache Redis Cluster:
┌─────────────────────────────────┐
│         Redis Cluster           │
│  ┌─────────┐  ┌─────────────┐   │
│  │ Node 1  │  │   Node 2    │   │
│  │ Primary │  │  Replica    │   │
│  └─────────┘  └─────────────┘   │
│                                 │
│  Cache Mode: Cluster            │
│  Node Type: cache.r6g.large     │
│  Nodes: 2 (1 primary + replica) │
│  Multi-AZ: Enabled              │
└─────────────────────────────────┘
```

**Data Storage Strategy:**

```javascript
// 1. Real-time Game State (Redis, TTL: 2 hours)
const gameStateKey = `room:${roomCode}:state`;
const gameState = {
  roomCode,
  players: [...],
  babies: [...],
  carrots,
  lastUpdate: timestamp
};
redis.setex(gameStateKey, 7200, JSON.stringify(gameState));

// 2. Active Room Index (Redis, TTL: 24 hours)
const activeRoomsKey = 'active_rooms';
redis.sadd(activeRoomsKey, roomCode);
redis.expire(activeRoomsKey, 86400);

// 3. Player Session (Redis, TTL: 1 hour)
const playerSessionKey = `player:${playerId}:session`;
redis.setex(playerSessionKey, 3600, JSON.stringify({
  roomCode,
  socketId,
  lastSeen: timestamp
}));

// 4. Long-term Progress (MySQL)
const familyProgress = {
  player_id: playerId,
  total_babies_raised: 15,
  generations_reached: 3,
  play_time_minutes: 1440,
  created_at: timestamp,
  updated_at: timestamp
};
```

**State Synchronization Flow:**
```
Game Action Trigger:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Player    │───►│   ECS       │───►│    Redis    │
│   Action    │    │  Instance   │    │   Update    │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │ Broadcast   │
                   │ to Partner  │
                   └─────────────┘
```

#### 4. Persistent Storage: RDS MySQL

**Database Design:**
```sql
-- User Accounts & Authentication
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) UNIQUE,
  email VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Family Progress Tracking
CREATE TABLE families (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  room_code VARCHAR(6) UNIQUE,
  player1_id BIGINT REFERENCES users(id),
  player2_id BIGINT REFERENCES users(id),
  total_babies_raised INT DEFAULT 0,
  generations_reached INT DEFAULT 0,
  total_playtime_minutes INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_played TIMESTAMP DEFAULT NOW()
);

-- Achievement System
CREATE TABLE achievements (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  family_id BIGINT REFERENCES families(id),
  achievement_type VARCHAR(50),
  achieved_at TIMESTAMP DEFAULT NOW(),
  data JSON
);

-- Session Analytics
CREATE TABLE game_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  family_id BIGINT REFERENCES families(id),
  session_duration_minutes INT,
  babies_born INT,
  babies_grown INT,
  actions_performed INT,
  started_at TIMESTAMP,
  ended_at TIMESTAMP
);
```

**RDS Configuration:**
- **Instance**: db.t3.micro (burstable, cost-effective)
- **Engine**: MySQL 8.0
- **Storage**: 20 GB GP2 (auto-scaling to 100 GB)
- **Backup**: 7-day retention
- **Multi-AZ**: Enabled for production
- **Encryption**: At-rest and in-transit

#### 5. Content Delivery: CloudFront + S3

**Static Asset Strategy:**
```
S3 Bucket Structure:
bunny-family-assets/
├── game/
│   ├── index.html
│   ├── game.js
│   └── styles/
├── libs/
│   ├── three.min.js
│   └── socket.io.js
└── media/
    ├── textures/
    ├── models/
    └── sounds/
```

**CloudFront Configuration:**
- **Origin**: S3 bucket (static assets)
- **Caching**: Aggressive for JS/CSS (1 year TTL)
- **Compression**: Gzip enabled
- **Global Edge Locations**: All regions
- **Custom Domain**: game.bunnyfamily.com

---

## Alternative Architecture Options

### 🚀 Option 2: Serverless-First (Event-Driven)

```
Serverless Architecture:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ API Gateway │───►│   Lambda    │───►│  DynamoDB   │
│ WebSocket   │    │ Functions   │    │ Streams     │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │    │ EventBridge │    │   Lambda    │
│ WebSocket   │    │  Bus        │    │ Game Engine │
└─────────────┘    └─────────────┘    └─────────────┘
```

**Pros:**
- True pay-per-use pricing
- Infinite scaling potential
- No server management

**Cons:**
- Complex WebSocket state management
- Cold start latency issues
- Limited session duration (15 min max)
- More complex debugging

**Verdict:** ❌ **Not recommended** for real-time game requirements

### 🐋 Option 3: Container-Native (EKS)

```
EKS Architecture:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  AWS ALB    │───►│    EKS      │───►│   Redis     │
│ Ingress     │    │  Cluster    │    │  Operator   │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  Game Pods  │
                   │ + HPA/VPA   │
                   └─────────────┘
```

**Pros:**
- Kubernetes-native scaling
- Advanced deployment strategies
- Portable across cloud providers

**Cons:**
- High operational complexity
- Expensive for small scale ($144+/month for cluster)
- Learning curve for team

**Verdict:** 🟡 **Consider for scale >5,000 concurrent rooms**

---

## Scaling Strategy

### 📊 Scaling Metrics and Triggers

**ECS Service Auto Scaling:**
```yaml
ScaleUpPolicy:
  MetricType: CPUUtilization
  TargetValue: 60
  ScaleUpCooldown: 300s
  
  # Custom Metrics
  WebSocketConnections:
    Threshold: 80 connections per instance
    
  MemoryUtilization:
    Threshold: 70%

ScaleDownPolicy:
  Cooldown: 600s  # Longer cooldown for graceful shutdown
  MinCapacity: 1  # Always keep 1 instance running
```

**Redis Scaling:**
```yaml
ClusterMode:
  ReplicaGroups: 1
  ReplicasPerGroup: 1  # Start small
  
# Scale trigger: Memory usage > 80%
ScaleUpTrigger:
  Memory: 80%
  NewConfiguration:
    NodeType: cache.r6g.xlarge  # 2x larger
    
# Scale out trigger: CPU > 70%
ScaleOutTrigger:
  CPU: 70%
  NewConfiguration:
    ReplicaGroups: 2  # Add second shard
```

### 🎯 Capacity Planning

**Small Scale (MVP):**
- **Target**: 100-500 concurrent rooms (200-1000 players)
- **ECS**: 2-5 Fargate tasks (1 vCPU, 2GB each)
- **Redis**: cache.r6g.large (13.5 GB memory)
- **RDS**: db.t3.micro
- **Estimated Cost**: $150-300/month

**Medium Scale (Growth):**
- **Target**: 1,000-5,000 concurrent rooms
- **ECS**: 10-25 Fargate tasks
- **Redis**: cache.r6g.xlarge cluster (26.32 GB)
- **RDS**: db.t3.medium
- **Estimated Cost**: $500-1,200/month

**Large Scale (Success):**
- **Target**: 10,000+ concurrent rooms
- **ECS**: 50+ Fargate tasks across multiple AZs
- **Redis**: Multi-shard cluster
- **RDS**: db.r5.large with read replicas
- **Estimated Cost**: $2,000-5,000/month

---

## Database Strategy

### 🔄 Hybrid Data Architecture

**1. Redis (Real-time Game State)**
```javascript
// Game state structure optimized for Redis
const roomData = {
  // Core game state (updates every 5s)
  state: {
    babies: [{
      id: 'baby1',
      hunger: 75,
      happiness: 80,
      energy: 60,
      cleanliness: 90,
      stage: 'newborn',
      growthPoints: 45
    }],
    carrots: 3,
    dayNightCycle: 'day'
  },
  
  // Session management
  players: [{
    id: 'player_123',
    type: 'black',
    socketId: 'socket_456',
    lastSeen: 1677721234567
  }],
  
  // Metadata
  roomCode: 'ABC123',
  gameStartTime: 1677720000000,
  lastUpdate: 1677721234567
};

// Redis operations
redis.setex(`room:${roomCode}`, 7200, JSON.stringify(roomData));
redis.zadd('active_rooms', Date.now(), roomCode);
```

**2. MySQL (Persistent Progress)**
```sql
-- Family progress tracking
INSERT INTO families (room_code, player1_id, player2_id) 
VALUES ('ABC123', 1001, 1002);

-- Achievement unlocking
INSERT INTO achievements (family_id, achievement_type, data)
VALUES (1, 'first_baby_raised', '{"baby_name": "Snowball"}');

-- Session analytics
INSERT INTO game_sessions (
  family_id, session_duration_minutes, babies_born, actions_performed
) VALUES (1, 45, 1, 127);
```

**3. Data Flow Strategy:**
```
Game Session Lifecycle:

1. Room Creation:
   ┌─────────────┐    ┌─────────────┐
   │    Redis    │◄───│    MySQL    │
   │ Create room │    │ Lookup user │
   └─────────────┘    └─────────────┘

2. Active Gameplay:
   ┌─────────────┐
   │    Redis    │◄─── All game state changes
   │ High-freq   │     (5-second intervals)
   │ updates     │
   └─────────────┘

3. Session End:
   ┌─────────────┐    ┌─────────────┐
   │    Redis    │───►│    MySQL    │
   │ Final state │    │Save progress│
   └─────────────┘    └─────────────┘
```

### 🏃‍♀️ Performance Optimizations

**Redis Optimization:**
```javascript
// Use Redis pipelines for batch operations
const pipeline = redis.pipeline();
pipeline.setex(`room:${roomCode}:state`, 7200, gameState);
pipeline.zadd('active_rooms', timestamp, roomCode);
pipeline.exec();

// Redis Lua scripts for atomic operations
const updateBabyScript = `
local roomKey = KEYS[1]
local babyData = cjson.decode(ARGV[1])
local currentData = redis.call('GET', roomKey)
local room = cjson.decode(currentData)
room.state.babies[1].hunger = babyData.hunger
redis.call('SET', roomKey, cjson.encode(room))
return "OK"
`;
```

**MySQL Optimization:**
```sql
-- Optimized indexes for common queries
CREATE INDEX idx_families_players ON families(player1_id, player2_id);
CREATE INDEX idx_sessions_family_time ON game_sessions(family_id, started_at);
CREATE INDEX idx_achievements_family ON achievements(family_id, achievement_type);

-- Read replica for analytics queries
CREATE READ REPLICA analytics_replica FROM main_db;
```

---

## Networking & Security

### 🔒 Security Architecture

**1. Network Security:**
```yaml
VPC Configuration:
  CIDR: 10.0.0.0/16
  
Public Subnets (ALB):
  - 10.0.1.0/24 (AZ-1a)
  - 10.0.2.0/24 (AZ-1b)
  
Private Subnets (ECS):
  - 10.0.11.0/24 (AZ-1a)
  - 10.0.12.0/24 (AZ-1b)
  
Database Subnets:
  - 10.0.21.0/24 (AZ-1a)
  - 10.0.22.0/24 (AZ-1b)
```

**2. Security Groups:**
```yaml
ALB Security Group:
  Ingress:
    - Port: 80 (HTTP) from 0.0.0.0/0
    - Port: 443 (HTTPS) from 0.0.0.0/0
  
ECS Security Group:
  Ingress:
    - Port: 3000 from ALB Security Group
    - Port: 6379 to Redis (ElastiCache SG)
  
ElastiCache Security Group:
  Ingress:
    - Port: 6379 from ECS Security Group
  
RDS Security Group:
  Ingress:
    - Port: 3306 from ECS Security Group
```

**3. SSL/TLS Configuration:**
```yaml
Certificate Manager:
  Domain: game.bunnyfamily.com
  Validation: DNS
  
ALB HTTPS Listener:
  Protocol: HTTPS
  Port: 443
  Certificate: ACM Certificate
  SecurityPolicy: ELBSecurityPolicy-TLS-1-2-2019-07
  
Redirect HTTP to HTTPS:
  DefaultAction:
    Type: redirect
    RedirectConfig:
      Protocol: HTTPS
      StatusCode: HTTP_301
```

### 🌐 Performance & CDN Strategy

**CloudFront Distribution:**
```yaml
Origins:
  - DomainName: bunny-family-alb.us-west-2.elb.amazonaws.com
    Id: ALB-origin
    CustomOriginConfig:
      HTTPPort: 80
      OriginProtocolPolicy: http-only
  
  - DomainName: bunny-family-assets.s3.amazonaws.com
    Id: S3-origin
    S3OriginConfig:
      OriginAccessIdentity: CloudFront-OAI
      
Behaviors:
  - PathPattern: "/socket.io/*"
    TargetOriginId: ALB-origin
    CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad  # CachingDisabled
    
  - PathPattern: "/static/*"
    TargetOriginId: S3-origin
    CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6  # CachingOptimized
    TTL: 31536000  # 1 year
```

---

## Monitoring & Observability

### 📊 Monitoring Stack

**1. CloudWatch Metrics:**
```yaml
Custom Metrics:
  GameRooms/ActiveRooms:
    MetricName: ActiveGameRooms
    Namespace: BunnyFamily/GameEngine
    Dimensions: [Environment]
    
  GameRooms/PlayersPerRoom:
    MetricName: AveragePlayersPerRoom
    Namespace: BunnyFamily/GameEngine
    
  WebSocket/Connections:
    MetricName: WebSocketConnections
    Namespace: BunnyFamily/Network
    
  Performance/ResponseTime:
    MetricName: ActionResponseTime
    Namespace: BunnyFamily/Performance
```

**2. Application Metrics:**
```javascript
// Custom CloudWatch metrics in Node.js
const AWS = require('aws-sdk');
const cloudwatch = new AWS.CloudWatch();

class GameMetrics {
  static async recordActiveRooms(count) {
    await cloudwatch.putMetricData({
      Namespace: 'BunnyFamily/GameEngine',
      MetricData: [{
        MetricName: 'ActiveGameRooms',
        Value: count,
        Unit: 'Count',
        Timestamp: new Date()
      }]
    }).promise();
  }
  
  static async recordActionLatency(action, duration) {
    await cloudwatch.putMetricData({
      Namespace: 'BunnyFamily/Performance',
      MetricData: [{
        MetricName: 'ActionResponseTime',
        Value: duration,
        Unit: 'Milliseconds',
        Dimensions: [{ Name: 'Action', Value: action }]
      }]
    }).promise();
  }
}
```

**3. Health Checks:**
```javascript
// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    
    // Application health
    app: {
      rooms: rooms.size,
      players: playerSockets.size,
      memoryUsage: process.memoryUsage()
    },
    
    // Dependencies health
    dependencies: {
      redis: await checkRedisHealth(),
      mysql: await checkMySQLHealth()
    },
    
    // Performance metrics
    performance: {
      averageRoomSize: getAverageRoomSize(),
      messagesPerSecond: getMessageRate()
    }
  };
  
  const isHealthy = health.dependencies.redis && health.dependencies.mysql;
  res.status(isHealthy ? 200 : 503).json(health);
});
```

### 🚨 Alerting Strategy

**CloudWatch Alarms:**
```yaml
HighLatencyAlarm:
  MetricName: ActionResponseTime
  Namespace: BunnyFamily/Performance
  Statistic: Average
  Period: 300
  EvaluationPeriods: 2
  Threshold: 1000  # 1 second
  ComparisonOperator: GreaterThanThreshold
  AlarmActions:
    - PagerDuty SNS Topic
    
LowHealthyHosts:
  MetricName: HealthyHostCount
  Namespace: AWS/ApplicationELB
  Statistic: Average
  Period: 60
  EvaluationPeriods: 2
  Threshold: 1
  ComparisonOperator: LessThanThreshold
  
HighMemoryUsage:
  MetricName: MemoryUtilization
  Namespace: AWS/ECS
  Statistic: Average
  Period: 300
  EvaluationPeriods: 3
  Threshold: 85
  ComparisonOperator: GreaterThanThreshold
```

### 🔍 Distributed Tracing

**AWS X-Ray Integration:**
```javascript
const AWSXRay = require('aws-xray-sdk-core');
const express = require('express');
const app = AWSXRay.express.openSegment(express());

// Trace WebSocket events
socket.on('player_action', AWSXRay.captureAsyncFunc('handle-player-action', async (data, subsegment) => {
  subsegment.addAnnotation('action', data.action);
  subsegment.addAnnotation('roomCode', data.roomCode);
  
  const result = await processPlayerAction(data);
  
  subsegment.addMetadata('result', result);
  subsegment.close();
}));

app.use(AWSXRay.express.closeSegment());
```

---

## Disaster Recovery

### 🛡️ Backup Strategy

**1. Database Backups:**
```yaml
RDS Automated Backups:
  BackupRetentionPeriod: 7 days
  BackupWindow: "03:00-04:00"
  PreferredMaintenanceWindow: "Sun:04:00-Sun:05:00"
  DeletionProtection: true
  
Manual Snapshots:
  Schedule: Weekly (before major releases)
  Retention: 30 days
  CrossRegionBackup: us-east-1 (for DR)
```

**2. Redis Persistence:**
```yaml
ElastiCache Backup:
  SnapshotRetentionLimit: 5 days
  SnapshotWindow: "03:00-05:00"
  FinalSnapshotName: bunny-family-final-snapshot
  
Cluster Configuration:
  SnapshotName: "daily-snapshot"
  PreferredMaintenanceWindow: "sun:03:00-sun:04:00"
```

**3. Infrastructure as Code:**
```yaml
# All infrastructure defined in CloudFormation/CDK
# Version controlled in Git
# Automated deployments via CI/CD

Source Control:
  Repository: bunny-family-infrastructure
  Branches:
    - main (production)
    - develop (staging)
    - feature/* (development)
    
Deployment Pipeline:
  - Code commit → GitHub
  - CI/CD → AWS CodePipeline  
  - Infrastructure → CloudFormation
  - Application → ECS Rolling Update
```

### 🚨 Incident Response Plan

**Recovery Time Objectives (RTO) & Recovery Point Objectives (RPO):**

| Component | RTO | RPO | Recovery Method |
|-----------|-----|-----|----------------|
| Game Service | 5 minutes | 1 minute | Auto-scaling + health checks |
| Player Progress | 1 hour | 15 minutes | RDS automated backups |
| Game State | 10 minutes | 5 minutes | Redis snapshots + replay |
| Static Assets | 2 minutes | 0 | CloudFront cache + S3 |

**Disaster Recovery Scenarios:**

1. **Single ECS Task Failure:**
   - Detection: Health check failure
   - Response: Auto-scaling replacement
   - Impact: Minimal (other tasks handle load)

2. **Redis Cluster Failure:**
   - Detection: Connection timeouts
   - Response: Restore from snapshot + replay recent events
   - Impact: 5-10 minutes downtime

3. **RDS Failure:**
   - Detection: Database connection errors
   - Response: Failover to Multi-AZ standby
   - Impact: 1-2 minutes downtime

4. **Full Region Failure:**
   - Detection: Multiple service failures
   - Response: Failover to DR region
   - Impact: 30-60 minutes (manual intervention)

---

## Cost Optimization

### 💰 Cost Analysis & Optimization

**Monthly Cost Breakdown (Small Scale - 100-500 rooms):**

| Service | Configuration | Monthly Cost | Optimization |
|---------|---------------|--------------|--------------|
| **ECS Fargate** | 2x (0.5 vCPU, 1GB) | $25-50 | ✅ Spot pricing for dev |
| **ALB** | 1x Application Load Balancer | $22 | ✅ Shared across environments |
| **ElastiCache** | cache.r6g.large | $135 | 🟡 Right-size based on usage |
| **RDS** | db.t3.micro (Multi-AZ) | $25 | ✅ Single-AZ for dev |
| **CloudFront** | Global distribution | $10-30 | ✅ Aggressive caching |
| **S3** | Static assets (~1GB) | $3 | ✅ Lifecycle policies |
| **Route 53** | DNS queries | $5 | ✅ Minimal impact |
| **Data Transfer** | Regional/Global | $10-20 | 🟡 CloudFront reduces costs |
| **CloudWatch** | Metrics & logs | $10-15 | ✅ Log retention policies |

**Total Estimated Monthly Cost: $245-315**

### 🎯 Cost Optimization Strategies

**1. Environment-Based Scaling:**
```yaml
Development Environment:
  ECS: 1x task (0.25 vCPU, 0.5GB)
  RDS: db.t3.micro (single-AZ)
  ElastiCache: cache.t3.micro
  Estimated Cost: $45/month

Staging Environment:
  ECS: 1x task (0.5 vCPU, 1GB)
  RDS: db.t3.small (single-AZ)
  ElastiCache: cache.r6g.large
  Estimated Cost: $165/month

Production Environment:
  ECS: 2-20x tasks (auto-scaling)
  RDS: db.t3.micro (Multi-AZ)
  ElastiCache: cache.r6g.large
  Estimated Cost: $245-600/month
```

**2. Reserved Instances Strategy:**
```yaml
# After 6 months of stable usage
ReservedInstances:
  RDS:
    Term: 1 year
    PaymentOption: Partial upfront
    Savings: 30-40%
    
  ElastiCache:
    Term: 1 year  
    PaymentOption: All upfront
    Savings: 35-45%
    
TotalSavings: $600-1200/year
```

**3. Auto-Scaling Policies:**
```yaml
# Aggressive scale-down during off-peak
ScaleDownPolicy:
  Schedule: "0 2 * * *"  # 2 AM daily
  MinCapacity: 1
  DesiredCapacity: 1
  
ScaleUpPolicy:
  Schedule: "0 18 * * *"  # 6 PM daily
  MinCapacity: 2
  DesiredCapacity: 2
```

**4. Data Transfer Optimization:**
```yaml
CloudFrontOptimizations:
  CacheHitRatio: >95%  # Aggressive caching
  CompressionEnabled: true
  OriginRequestPolicy: CachingOptimized
  
S3TransferAcceleration:
  Enabled: true  # For global users
  
RegionalOptimization:
  PrimaryRegion: us-west-2  # West Coast users
  SecondaryRegion: us-east-1  # East Coast users
```

### 📊 Cost Monitoring

**Budget Alerts:**
```yaml
BudgetConfiguration:
  BudgetLimit: $400  # 30% buffer over expected $300
  Alerts:
    - Threshold: 80%  # $320
      Recipients: [devops@bunnyfamily.com]
    - Threshold: 100%  # $400  
      Recipients: [finance@bunnyfamily.com, cto@bunnyfamily.com]
    - Threshold: 120%  # $480
      Recipients: [emergency-oncall]
      
CostAnomalyDetection:
  Enabled: true
  Services: [ECS, ElastiCache, RDS, CloudFront]
  Threshold: $50 daily variance
```

---

## Implementation Roadmap

### 🗓️ Migration Timeline

**Phase 1: Foundation (Week 1-2)**
```yaml
Week 1:
  - ✅ Set up AWS account & IAM roles
  - ✅ Create VPC & networking infrastructure
  - ✅ Deploy ElastiCache Redis cluster
  - ✅ Set up RDS MySQL instance
  
Week 2:
  - ✅ Create ECS cluster & task definition
  - ✅ Configure ALB with sticky sessions
  - ✅ Deploy single instance for testing
  - ✅ Implement basic health checks
```

**Phase 2: Application Migration (Week 3-4)**
```yaml
Week 3:
  - 🔄 Modify application for Redis state storage
  - 🔄 Implement database persistence layer
  - 🔄 Add CloudWatch metrics & logging
  - 🔄 Deploy to development environment

Week 4:
  - 🔄 Load testing with WebSocket clients
  - 🔄 Tune auto-scaling policies
  - 🔄 Set up monitoring & alerting
  - 🔄 Deploy to staging environment
```

**Phase 3: Production Launch (Week 5-6)**
```yaml
Week 5:
  - 🚀 CloudFront distribution setup
  - 🚀 SSL certificates & DNS configuration
  - 🚀 Production deployment
  - 🚀 Disaster recovery testing

Week 6:
  - 📊 Performance optimization
  - 📊 Cost optimization review
  - 📊 Documentation & runbooks
  - 📊 Team training
```

### ⚡ Quick Wins (Immediate Value)

**High Impact, Low Effort:**
1. **Static Asset CDN** (CloudFront + S3)
   - Deploy time: 2 hours
   - Impact: 50% faster global load times
   - Cost: +$10-20/month

2. **Health Check Improvements**
   - Deploy time: 1 hour  
   - Impact: Better monitoring & alerting
   - Cost: No additional cost

3. **Basic Redis Integration**
   - Deploy time: 4 hours
   - Impact: Session persistence across restarts
   - Cost: +$135/month

**Medium Impact, Medium Effort:**
4. **ECS Migration** 
   - Deploy time: 1 week
   - Impact: Auto-scaling & better reliability
   - Cost: +$25-50/month

5. **Database Layer**
   - Deploy time: 1 week
   - Impact: Persistent player progress
   - Cost: +$25/month

### 🚧 Risk Mitigation

**Technical Risks:**

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| WebSocket session loss | High | Medium | Implement client reconnection + Redis session storage |
| Redis memory limits | Medium | High | Monitor usage + auto-scaling policies |
| Database connection limits | Low | High | Connection pooling + read replicas |
| ALB sticky session issues | Medium | Medium | Custom session management + testing |

**Business Risks:**

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Cost overrun | Medium | High | Budget alerts + auto-scaling limits |
| Player data loss | Low | Critical | Multi-AZ backups + point-in-time recovery |
| Scaling bottlenecks | Medium | Medium | Load testing + gradual rollout |
| Security breach | Low | Critical | VPC isolation + security best practices |

---

## Architecture Diagrams

### 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GLOBAL USERS                             │
│  🌍 Couples around the world playing Bunny Family              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                   CLOUDFRONT CDN                                │
│  Global edge locations caching static assets                   │
│  • game.js, index.html, Three.js libraries                    │
│  • 95% cache hit ratio, 1-year TTL                            │
└─────────────────┬───────────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────────┐
│                     ROUTE 53                                   │
│  DNS routing: game.bunnyfamily.com                             │
└─────────────────┬───────────────────────────────────────────────┘
                  │
   ┌──────────────▼──────────────┐
   │    APPLICATION LOAD         │
   │     BALANCER (ALB)          │
   │                             │
   │ • Sticky sessions enabled   │
   │ • SSL termination          │
   │ • Health checks: /health    │
   │ • WebSocket support         │
   └──────────┬─────────┬────────┘
              │         │
    ┌─────────▼───┐   ┌─▼─────────┐
    │ ECS FARGATE │   │ ECS FARGATE│
    │ INSTANCE 1  │   │ INSTANCE 2 │
    │             │   │            │
    │ ┌─────────┐ │   │ ┌─────────┐│
    │ │Node.js  │ │   │ │Node.js  ││
    │ │Express  │ │   │ │Express  ││
    │ │Socket.io│ │   │ │Socket.io││
    │ │Game Eng │ │   │ │Game Eng ││
    │ └─────────┘ │   │ └─────────┘│
    └─────────┬───┘   └───┬────────┘
              │           │
        ┌─────▼───────────▼─────┐
        │   ELASTICACHE REDIS   │
        │      CLUSTER          │
        │                       │
        │ • Game state storage  │
        │ • Session management  │
        │ • Real-time sync      │
        │ • 2-hour TTL          │
        └─────────┬─────────────┘
                  │
        ┌─────────▼─────────────┐
        │      RDS MYSQL        │
        │    (Multi-AZ)         │
        │                       │
        │ • Player progress     │
        │ • Family achievements │
        │ • Game analytics      │
        │ • User accounts       │
        └───────────────────────┘
```

### 🔄 Data Flow Architecture

```
GAME SESSION LIFECYCLE:

1. Room Creation & Join:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Player    │───►│     ALB     │───►│ ECS Instance│
│ Creates Room│    │  Sticky     │    │   Node.js   │
└─────────────┘    │  Session    │    └─────┬───────┘
                   └─────────────┘          │
┌─────────────┐                             ▼
│   Partner   │                    ┌─────────────┐
│ Joins Room  │◄──────────────────►│    Redis    │
└─────────────┘                    │ Store room  │
                                   │    state    │
                                   └─────────────┘

2. Active Gameplay (Real-time):
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Player A   │───►│ WebSocket   │───►│   Redis     │
│ Feeds Baby  │    │ Action      │    │ Update State│
└─────────────┘    └─────────────┘    └─────┬───────┘
                                             │
┌─────────────┐                             ▼
│  Player B   │◄──────────────────── ┌─────────────┐
│ Sees Action │    Broadcast Event   │ ECS Instance│
└─────────────┘                      │ Game Engine │
                                     └─────────────┘

3. Session End & Persistence:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Players   │───►│   Redis     │───►│    MySQL    │
│ End Session │    │Final State  │    │Save Progress│
└─────────────┘    └─────────────┘    └─────────────┘
```

### 📊 Auto-Scaling Architecture

```
SCALING TRIGGERS & RESPONSES:

Traffic Increase:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ CloudWatch  │───►│ ECS Auto    │───►│ New Fargate │
│CPU > 60%    │    │  Scaling    │    │    Task     │
│Memory > 70% │    │   Group     │    │  Launched   │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                           ▼
                   ┌─────────────┐
                   │     ALB     │
                   │ Add Target  │
                   │  to Pool    │
                   └─────────────┘

Redis Memory Scaling:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Memory >80% │───►│ ElastiCache │───►│   Larger    │
│   Usage     │    │ Modification│    │ Node Type   │
└─────────────┘    └─────────────┘    └─────────────┘

Database Scaling:
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│Connection   │───►│    RDS      │───►│ Read Replica│
│  Pool >80%  │    │  Monitoring │    │   Created   │
└─────────────┘    └─────────────┘    └─────────────┘
```

### 🛡️ Security Architecture

```
SECURITY LAYERS:

Internet Layer:
┌─────────────────────────────────────────────────────────────────┐
│                         WAF (Optional)                          │
│ • DDoS protection • Rate limiting • IP filtering              │
└─────────────────┬───────────────────────────────────────────────┘
                  │
Public Subnets (AZ-1a, AZ-1b):
┌─────────────────┼───────────────────────────────────────────────┐
│                 ▼                                               │
│        ┌─────────────┐            ALB Security Group            │
│        │     ALB     │            • Port 80/443 from 0.0.0.0/0 │
│        └─────────────┘                                          │
└─────────────────┬───────────────────────────────────────────────┘
                  │
Private Subnets (AZ-1a, AZ-1b):
┌─────────────────┼───────────────────────────────────────────────┐
│                 ▼                                               │
│   ┌─────────────┐  ┌─────────────┐   ECS Security Group         │
│   │ECS Instance │  │ECS Instance │   • Port 3000 from ALB SG    │
│   └─────────────┘  └─────────────┘   • Port 6379 to Redis SG   │
└─────────────────┬───────────────────────────────────────────────┘
                  │
Database Subnets (AZ-1a, AZ-1b):
┌─────────────────┼───────────────────────────────────────────────┐
│                 ▼                                               │
│ ┌─────────────┐  ┌─────────────┐   Database Security Groups     │
│ │   Redis     │  │   MySQL     │   • Port 6379 from ECS SG    │
│ │  Cluster    │  │    RDS      │   • Port 3306 from ECS SG    │
│ └─────────────┘  └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Conclusion & Recommendations

### 🎯 Summary of Recommendations

**Primary Architecture: ECS Fargate + Redis + MySQL**
- ✅ **Best fit** for WebSocket scaling requirements
- ✅ **Cost-effective** for indie game economics ($245-315/month)
- ✅ **Manageable complexity** for small development team
- ✅ **Proven pattern** for real-time multiplayer games

**Key Implementation Priorities:**

1. **Immediate (Week 1-2):** Static asset CDN + Basic monitoring
2. **Short-term (Week 3-4):** Redis state persistence + ECS deployment  
3. **Medium-term (Week 5-6):** Production deployment + optimization
4. **Long-term (Month 2+):** Advanced scaling + analytics

### 🚀 Success Metrics

**Technical KPIs:**
- **Latency**: <100ms average action response time
- **Availability**: 99.9% uptime (8.7 hours downtime/year)
- **Scalability**: Support 10x growth without architecture changes
- **Performance**: Handle 1,000 concurrent rooms on initial setup

**Business KPIs:**
- **Cost Efficiency**: <$0.50 per player-hour
- **User Experience**: <5% session drop rate
- **Developer Productivity**: <1 hour median deploy time
- **Operational Load**: <2 hours/week maintenance overhead

### 🔮 Future Considerations

**Scaling Beyond 10,000 Rooms:**
- Consider EKS for advanced container orchestration
- Implement Redis sharding for horizontal scaling
- Add read replicas for analytics workloads
- Explore multi-region deployment for global latency

**Advanced Features:**
- **Real-time Analytics**: Kinesis Data Streams + Elasticsearch
- **Machine Learning**: Personalized baby personalities via SageMaker  
- **Global Leaderboards**: DynamoDB global tables
- **Voice Chat Integration**: Twilio/WebRTC integration

**Cost Optimization Opportunities:**
- **Spot Instances**: 60-80% savings for development environments
- **Reserved Instances**: 30-50% savings after stable usage patterns
- **S3 Intelligent Tiering**: Automatic cost optimization for assets
- **CloudWatch Cost Optimization**: Log retention + metric filtering

---

**🐰❤️ The Bunny Family infrastructure is designed to scale with love!**

This architecture provides a solid foundation for the cooperative Tamagotchi game while maintaining the intimate, real-time experience that makes Bunny Family special. The hybrid approach balances cost, complexity, and scalability—perfect for an indie game that could grow into something bigger.

*Ready to deploy when you are! 🚀*