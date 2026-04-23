# ============================================================
# 腾讯云认证
# ============================================================
variable "secret_id" {
  description = "腾讯云 API SecretId"
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "腾讯云 API SecretKey"
  type        = string
  sensitive   = true
}

# ============================================================
# 地域和可用区
# ============================================================
variable "region" {
  description = "腾讯云地域"
  type        = string
  default     = "ap-guangzhou"
}

variable "availability_zone" {
  description = "可用区"
  type        = string
  default     = "ap-guangzhou-3"
}

# ============================================================
# 应用镜像（由 CI 传入）
# ============================================================
variable "app_image_tag" {
  description = "new-api Docker 镜像 tag，由 GitHub Actions 在 terraform apply 时传入"
  type        = string
  default     = "latest"
}

variable "tcr_namespace" {
  description = "腾讯云 TCR 个人版命名空间"
  type        = string
}

# ============================================================
# 数据库
# ============================================================
variable "db_password" {
  description = "PostgreSQL root 密码"
  type        = string
  sensitive   = true
}

variable "db_memory" {
  description = "PostgreSQL 实例内存 (GB)"
  type        = number
  default     = 2
}

variable "db_storage" {
  description = "PostgreSQL 存储 (GB)"
  type        = number
  default     = 20
}

# ============================================================
# Redis
# ============================================================
variable "redis_mem_size" {
  description = "Redis 内存 (MB)"
  type        = number
  default     = 256
}

# ============================================================
# 应用配置
# ============================================================
variable "session_secret" {
  description = "new-api 的 SESSION_SECRET"
  type        = string
  sensitive   = true
}

variable "app_replicas" {
  description = "new-api 副本数"
  type        = number
  default     = 1
}

# ============================================================
# TKE Serverless
# ============================================================
variable "cluster_version" {
  description = "TKE Serverless 集群 K8s 版本"
  type        = string
  default     = "1.28.3"
}

# ============================================================
# 标签
# ============================================================
variable "tags" {
  description = "资源标签"
  type        = map(string)
  default = {
    project = "new-api"
    managed = "terraform"
  }
}
