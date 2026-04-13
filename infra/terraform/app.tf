# ============================================================
# TKE Serverless (EKS) 集群
# ============================================================
resource "tencentcloud_eks_cluster" "main" {
  cluster_name = "new-api-serverless"
  k8s_version  = var.cluster_version

  vpc_id            = tencentcloud_vpc.main.id
  subnet_ids        = [tencentcloud_subnet.app.id]
  service_subnet_id = tencentcloud_subnet.app.id

  # 开启公网访问（kubectl 管理 + CLB 入口）
  public_lb {
    enabled          = true
    allow_from_cidrs = ["0.0.0.0/0"]
  }

  # 开启内网 DNS
  enable_vpc_core_dns = true
  need_delete_cbs     = true

  cluster_desc = "new-api production serverless cluster"

  tags = var.tags
}

# ============================================================
# Kubernetes 资源 — Namespace
# ============================================================
resource "kubernetes_namespace" "app" {
  metadata {
    name = "new-api"
    labels = {
      app     = "new-api"
      managed = "terraform"
    }
  }
}

# ============================================================
# Kubernetes 资源 — Secret（数据库连接信息）
# ============================================================
resource "kubernetes_secret" "app_config" {
  metadata {
    name      = "new-api-config"
    namespace = kubernetes_namespace.app.metadata[0].name
  }

  data = {
    SQL_DSN            = "postgresql://root:${var.db_password}@${tencentcloud_postgresql_instance.main.private_access_ip}:${tencentcloud_postgresql_instance.main.private_access_port}/new_api?sslmode=require"
    REDIS_CONN_STRING  = "redis://${tencentcloud_redis_instance.main.ip}:${tencentcloud_redis_instance.main.port}"
    SESSION_SECRET     = var.session_secret
  }
}

# ============================================================
# Kubernetes 资源 — Deployment
# ============================================================
#
# 核心机制：
# var.app_image_tag 由 CI 传入 → image 字段变化 → terraform apply
# → K8s 执行滚动更新（RollingUpdate）→ 零停机部署
#
resource "kubernetes_deployment" "app" {
  metadata {
    name      = "new-api"
    namespace = kubernetes_namespace.app.metadata[0].name
    labels = {
      app = "new-api"
    }
  }

  spec {
    replicas = var.app_replicas

    selector {
      match_labels = {
        app = "new-api"
      }
    }

    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_surge       = "1"
        max_unavailable = "0" # 零停机
      }
    }

    template {
      metadata {
        labels = {
          app = "new-api"
        }
        annotations = {
          # 镜像 tag 变化时强制触发 Pod 重建
          "deploy/image-tag" = var.app_image_tag
        }
      }

      spec {
        container {
          name  = "new-api"
          image = "ccr.ccs.tencentyun.com/${var.tcr_namespace}/new-api:${var.app_image_tag}"
          args  = ["--log-dir", "/app/logs"]

          port {
            container_port = 3000
            protocol       = "TCP"
          }

          # 从 Secret 注入环境变量
          env_from {
            secret_ref {
              name = kubernetes_secret.app_config.metadata[0].name
            }
          }

          env {
            name  = "TZ"
            value = "Asia/Shanghai"
          }

          env {
            name  = "ERROR_LOG_ENABLED"
            value = "true"
          }

          env {
            name  = "BATCH_UPDATE_ENABLED"
            value = "true"
          }

          # 资源限制（TKE Serverless 按 Pod 规格计费）
          resources {
            requests = {
              cpu    = "1"
              memory = "2Gi"
            }
            limits = {
              cpu    = "2"
              memory = "4Gi"
            }
          }

          # 就绪探针
          readiness_probe {
            http_get {
              path = "/api/status"
              port = 3000
            }
            initial_delay_seconds = 5
            period_seconds        = 10
            timeout_seconds       = 3
            failure_threshold     = 3
          }

          # 存活探针
          liveness_probe {
            http_get {
              path = "/api/status"
              port = 3000
            }
            initial_delay_seconds = 15
            period_seconds        = 20
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          # 数据持久化
          volume_mount {
            name       = "data"
            mount_path = "/data"
          }

          volume_mount {
            name       = "logs"
            mount_path = "/app/logs"
          }
        }

        # TKE Serverless 使用 CFS 或 emptyDir
        volume {
          name = "data"
          empty_dir {}
        }

        volume {
          name = "logs"
          empty_dir {}
        }

        # 确保在 Serverless 环境运行
        restart_policy = "Always"
      }
    }
  }

  # 等待 Deployment 就绪
  wait_for_rollout = true

  timeouts {
    create = "5m"
    update = "5m"
  }
}

# ============================================================
# Kubernetes 资源 — Service
# ============================================================
resource "kubernetes_service" "app" {
  metadata {
    name      = "new-api"
    namespace = kubernetes_namespace.app.metadata[0].name
    annotations = {
      # 使用腾讯云 CLB 作为 LoadBalancer
      "service.kubernetes.io/tke-existed-lbid"                = ""
      "service.cloud.tencent.com/direct-access"               = "true"
      "service.kubernetes.io/local-svc-only-bind-node-with-pod" = "true"
    }
  }

  spec {
    selector = {
      app = "new-api"
    }

    type = "LoadBalancer"

    port {
      name        = "http"
      port        = 80
      target_port = 3000
      protocol    = "TCP"
    }

    port {
      name        = "https"
      port        = 443
      target_port = 3000
      protocol    = "TCP"
    }
  }
}
