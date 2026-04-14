# K8s Cluster Resource Report for Bunny Family Game
**Date:** 2026-03-30 11:31 UTC  
**Cluster:** kubernetes-admin@kubernetes (172.20.10.30:6443)  
**Analysis:** Resource utilization and capacity planning

## Executive Summary

✅ **Good News:** The bunny-game applications are running smoothly with minimal resource usage  
⚠️  **Concern:** bunny-game pods lack resource requests/limits, creating scheduling and stability risks  
📈 **Opportunity:** Significant capacity available for scaling the bunny game  

## Current Resource Status

### Node Resource Utilization
| Node | CPU Usage | CPU % | Memory Usage | Memory % | Status |
|------|-----------|-------|--------------|----------|---------|
| master-node01 | 336m | 8% | 3490Mi | 44% | ✅ Good |
| worker-node01 | 329m | 8% | 2436Mi | 63% | ⚠️ High Memory |
| worker-node02 | 152m | 7% | 1830Mi | 47% | ✅ Best Available |
| worker-node03 | 339m | 8% | 5128Mi | 65% | ⚠️ High Memory |
| worker-node04 | 185m | 4% | 4839Mi | 61% | ⚠️ Moderate Memory |

### Bunny Game Current State
**Namespace:** `bunny-game` (4 pods, all on worker-node02)

| Pod | CPU | Memory | Replicas | Resource Limits |
|-----|-----|--------|----------|----------------|
| bunny-backend | 0m | 12Mi | 1 | ❌ None |
| bunny-frontend | 1m | 14Mi | 1 | ❌ None |
| bunny-postgres | 1m | 44Mi | 1 | ❌ None |
| bunny-redis | 6m | 3Mi | 1 | ❌ None |
| **Total** | **8m** | **73Mi** | **4** | **❌ No limits set** |

### Cluster Resource Breakdown
- **Total Pods:** 116 across all namespaces
- **Largest Consumers:** 
  - kube-system (25 pods) - System components
  - loki (14 pods) - Logging infrastructure  
  - prometheus (9 pods) - Monitoring
  - bunny-game (4 pods) - **Current target**

### Heavy Resource Consumers (Top 5)
| Pod | Namespace | CPU | Memory | Impact |
|-----|-----------|-----|--------|--------|
| openclaw-0 | openclaw | 111m | 1044Mi | 🔴 High |
| open-webui | open-webui | 2m | 1005Mi | 🔴 High |
| k8s-ai-ops-bot | ai-ops | 1m | 986Mi | 🔴 High |
| kube-apiserver | kube-system | 98m | 973Mi | 🟡 System Critical |
| jenkins-app-0 | jenkins | 8m | 671Mi | 🟡 Moderate |

## Resource Allocation Analysis

### Node Capacity vs Requests
| Node | CPU Requests | Memory Requests | Available CPU | Available Memory |
|------|-------------|----------------|---------------|------------------|
| master-node01 | 31% | 4% | 69% | 96% |
| worker-node01 | 56% | 70% | 44% | 30% |
| worker-node02 | 35% | 42% | 65% | 58% |
| worker-node03 | 27% | 25% | 73% | 75% |
| worker-node04 | 57% | 55% | 43% | 45% |

**⚠️ Overcommitment Warning:** Several nodes show limits exceeding 100% capacity (up to 267% CPU, 228% memory), indicating potential resource contention if all pods hit their limits simultaneously.

## Critical Issues & Recommendations

### 🚨 Priority 1: Resource Constraints for Bunny Game

**Problem:** All bunny-game pods lack resource requests and limits.

**Risk:** 
- Unpredictable scheduling behavior
- Potential for resource starvation
- No protection against runaway processes
- Poor performance during high load

**Solution:**
```yaml
resources:
  requests:
    cpu: "10m"      # Backend: 50m, Frontend: 10m
    memory: "64Mi"  # Backend: 128Mi, DB: 256Mi, Frontend: 64Mi, Redis: 32Mi
  limits:
    cpu: "100m"     # Backend: 200m, Frontend: 100m  
    memory: "128Mi" # Backend: 512Mi, DB: 512Mi, Frontend: 128Mi, Redis: 64Mi
```

### 🎯 Priority 2: Scaling Recommendations

**Current State:** All bunny-game components run with 1 replica each

**Recommended Scaling:**
- **bunny-frontend:** Scale to 2-3 replicas for availability and load distribution
- **bunny-backend:** Scale to 2 replicas for resilience  
- **bunny-postgres:** Keep at 1 (StatefulSet, requires careful scaling)
- **bunny-redis:** Keep at 1 (lightweight, single instance sufficient)

**Resource Impact:** Scaling to recommended levels would add ~16m CPU and ~146Mi memory total.

### 🧹 Priority 3: Resource Optimization Opportunities

**High-Impact Candidates for Resource Reduction:**

1. **openclaw-0** (1044Mi memory) - Consider if this high usage is necessary
2. **open-webui** (1005Mi memory) - AI interface, could potentially be scaled down when not in use
3. **k8s-ai-ops-bot** (986Mi memory) - Consider resource limits if not already set

**Namespace Analysis for Potential Cleanup:**
- **staging** (6 pods) - Could be cleaned up if not actively used
- **real-estate** (6 pods) - Evaluate if all components are necessary
- **ai-ops** (2 pods) - High memory usage, review necessity

### 📍 Priority 4: Node Placement Strategy

**Current Issue:** All bunny-game pods scheduled on worker-node02

**Recommendation:** 
- Spread bunny-game replicas across multiple nodes for resilience
- Consider node affinity rules to avoid single points of failure
- worker-node03 has excellent available capacity (73% CPU, 75% memory available)

## Specific Action Items

### Immediate (This Week)
1. **Add resource requests/limits** to all bunny-game deployments
2. **Scale bunny-frontend** to 2 replicas for better availability
3. **Review openclaw-0 memory usage** - investigate why it's using >1GB

### Short-term (Next 2 Weeks)  
1. **Scale bunny-backend** to 2 replicas
2. **Add pod anti-affinity** rules to spread bunny-game across nodes
3. **Audit staging namespace** - clean up unused resources
4. **Set resource limits** on high-memory consumers (openclaw, open-webui, ai-ops-bot)

### Medium-term (Next Month)
1. **Implement HPA** (Horizontal Pod Autoscaler) for bunny-frontend based on CPU/memory
2. **Consider VPA** (Vertical Pod Autoscaler) for automatic resource right-sizing
3. **Review and clean up** real-estate namespace if not actively needed

## Cluster Health Summary

### ✅ Strengths
- All nodes healthy and responsive  
- CPU utilization is low across the board (4-8%)
- Plenty of CPU headroom available
- bunny-game is lightweight and efficient
- worker-node02 and worker-node03 have excellent available capacity

### ⚠️ Areas of Concern  
- worker-node01 and worker-node03 approaching memory limits (63-65%)
- Significant overcommitment on resource limits across multiple nodes
- No resource governance for bunny-game pods
- Single node placement creates availability risk

### 🎯 Capacity for Bunny Game Scaling
**Current Usage:** 8m CPU, 73Mi memory  
**Available Capacity:** Substantial headroom on worker-node02/03  
**Scaling Potential:** Could easily support 10-15x current bunny-game resource usage

## Conclusion

The K8s cluster has **excellent capacity** to support the Bunny Family game scaling. The immediate priority should be implementing proper resource management (requests/limits) and basic scaling for availability. No resource cleanup is urgently needed, but addressing the high-memory consumers would provide additional headroom for future growth.

**Cluster Grade:** B+ (Good capacity, needs resource governance)  
**Bunny Game Readiness:** 🟢 Ready to scale with proper resource constraints