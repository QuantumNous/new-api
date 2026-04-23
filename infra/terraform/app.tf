# ============================================================
# TKE 标准集群（Serverless 模式，无需购买节点）
# ============================================================
resource "tencentcloud_kubernetes_cluster" "main" {
  cluster_name                    = "new-api-cluster"
  cluster_version                 = var.cluster_version
  cluster_cidr                    = "172.16.0.0/22"
  cluster_os                      = "ubuntu18.04.1x86_64"
  vpc_id                          = tencentcloud_vpc.main.id
  cluster_deploy_type             = "MANAGED_CLUSTER"
  cluster_internet                = true
  cluster_internet_security_group = tencentcloud_security_group.app.id

  cluster_desc = "new-api production cluster (serverless)"

  tags = var.tags
}

# ============================================================
# TKE Serverless 节点池 — 无需管理节点，按 Pod 付费
# ============================================================
resource "tencentcloud_kubernetes_serverless_node_pool" "app" {
  cluster_id = tencentcloud_kubernetes_cluster.main.id
  name       = "new-api-serverless-pool"

  serverless_nodes {
    display_name = "new-api-node"
    subnet_id    = tencentcloud_subnet.app.id
  }

  security_group_ids = [tencentcloud_security_group.app.id]

  labels = {
    app = "new-api"
  }
}

# ============================================================
# Kubernetes 资源 — Namespace
# ============================================================
resource "kubernetes_namespace_v1" "app" {
  metadata {
    name = "new-api"
    labels = {
      app     = "new-api"
      managed = "terraform"
    }
  }

  depends_on = [tencentcloud_kubernetes_serverless_node_pool.app]
}

# ============================================================
# Kubernetes 资源 — Secret（数据库连接信息）
# ============================================================
resource "kubernetes_secret_v1" "app_config" {
  metadata {
    name      = "new-api-config"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }

  data = {
    SQL_DSN           = "postgresql://root:${var.db_password}@${tencentcloud_postgresql_instance.main.private_access_ip}:${tencentcloud_postgresql_instance.main.private_access_port}/new_api?sslmode=require"
    REDIS_CONN_STRING = "redis://${tencentcloud_redis_instance.main.ip}:${tencentcloud_redis_instance.main.port}"
    SESSION_SECRET    = var.session_secret
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
resource "kubernetes_deployment_v1" "app" {
  metadata {
    name      = "new-api"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
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
              name = kubernetes_secret_v1.app_config.metadata[0].name
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

          # 资源限制（Serverless 节点池按 Pod 规格计费）
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

        volume {
          name = "data"
          empty_dir {}
        }

        volume {
          name = "logs"
          empty_dir {}
        }

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
resource "kubernetes_service_v1" "app" {
  metadata {
    name      = "new-api"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
    annotations = {
      # 使用腾讯云 CLB 作为 LoadBalancer
      "service.cloud.tencent.com/direct-access"                 = "true"
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
