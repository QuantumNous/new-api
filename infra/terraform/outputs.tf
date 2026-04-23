# ============================================================
# 输出
# ============================================================

output "cluster_id" {
  description = "TKE 集群 ID"
  value       = tencentcloud_kubernetes_cluster.main.id
}

output "cluster_endpoint" {
  description = "K8s API Server 公网地址"
  value       = tencentcloud_kubernetes_cluster.main.cluster_external_endpoint
  sensitive   = true
}

output "postgresql_private_ip" {
  description = "PostgreSQL 内网地址"
  value       = "${tencentcloud_postgresql_instance.main.private_access_ip}:${tencentcloud_postgresql_instance.main.private_access_port}"
}

output "redis_private_ip" {
  description = "Redis 内网地址"
  value       = "${tencentcloud_redis_instance.main.ip}:${tencentcloud_redis_instance.main.port}"
}

output "app_image" {
  description = "当前部署的镜像"
  value       = "ccr.ccs.tencentyun.com/${var.tcr_namespace}/new-api:${var.app_image_tag}"
}
