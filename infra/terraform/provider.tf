provider "tencentcloud" {
  region     = var.region
  secret_id  = var.secret_id
  secret_key = var.secret_key
}

# Kubernetes Provider — 连接到 TKE 集群
# 首次部署需分步：先 terraform apply -target=tencentcloud_kubernetes_cluster.main
# 集群创建完成后再 terraform apply 部署 K8s 资源
provider "kubernetes" {
  # TKE 集群的公网 API endpoint
  host = try(
    tencentcloud_kubernetes_cluster.main.cluster_external_endpoint,
    "https://placeholder.invalid"
  )
  # 集群 CA 证书
  cluster_ca_certificate = try(
    tencentcloud_kubernetes_cluster.main.certification_authority,
    ""
  )
  # 使用 token 方式认证（TKE 支持）
  token = try(
    tencentcloud_kubernetes_cluster.main.password,
    ""
  )
}
