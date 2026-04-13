provider "tencentcloud" {
  region     = var.region
  secret_id  = var.secret_id
  secret_key = var.secret_key
}

# Kubernetes Provider — 连接到 TKE Serverless 集群
# 使用集群创建后输出的证书进行认证
provider "kubernetes" {
  host                   = tencentcloud_eks_cluster.main.kube_config[0].cluster_external_endpoint
  cluster_ca_certificate = base64decode(tencentcloud_eks_cluster.main.kube_config[0].cluster_ca_cert)
  client_certificate     = base64decode(tencentcloud_eks_cluster.main.kube_config[0].cluster_client_cert)
  client_key             = base64decode(tencentcloud_eks_cluster.main.kube_config[0].cluster_client_key)
}
