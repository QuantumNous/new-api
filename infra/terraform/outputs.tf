# ============================================================
# 输出
# ============================================================

output "cluster_id" {
  description = "TKE Serverless 集群 ID"
  value       = tencentcloud_eks_cluster.main.id
}

output "cluster_endpoint" {
  description = "K8s API Server 公网地址"
  value       = tencentcloud_eks_cluster.main.kube_config[0].cluster_external_endpoint
  sensitive   = true
}

output "app_load_balancer_ip" {
  description = "new-api 服务的 CLB 公网 IP（部署后可通过此 IP 访问）"
  value       = kubernetes_service.app.status[0].load_balancer[0].ingress[0].ip
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

output "app_url" {
  description = "应用访问地址"
  value       = "http://${kubernetes_service.app.status[0].load_balancer[0].ingress[0].ip}"
}
