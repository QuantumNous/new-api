# ============================================================
# VPC
# ============================================================
resource "tencentcloud_vpc" "main" {
  name       = "new-api-vpc"
  cidr_block = "10.0.0.0/16"
  tags       = var.tags
}

# ============================================================
# 子网 — 应用 & 数据库共用同一 VPC，不同子网
# ============================================================
resource "tencentcloud_subnet" "app" {
  name              = "new-api-app-subnet"
  vpc_id            = tencentcloud_vpc.main.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = var.availability_zone
  tags              = var.tags
}

resource "tencentcloud_subnet" "db" {
  name              = "new-api-db-subnet"
  vpc_id            = tencentcloud_vpc.main.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = var.availability_zone
  tags              = var.tags
}

# ============================================================
# 安全组
# ============================================================

# 应用安全组 — 允许公网 HTTP/HTTPS 入站
resource "tencentcloud_security_group" "app" {
  name        = "new-api-app-sg"
  description = "Security group for new-api application pods"
  tags        = var.tags
}

resource "tencentcloud_security_group_lite_rule" "app_rules" {
  security_group_id = tencentcloud_security_group.app.id

  ingress = [
    # VPC 内部全放通
    "ACCEPT#10.0.0.0/16#ALL#ALL",
    # HTTP
    "ACCEPT#0.0.0.0/0#TCP#80",
    # HTTPS
    "ACCEPT#0.0.0.0/0#TCP#443",
    # 应用端口（CLB 健康检查需要）
    "ACCEPT#10.0.0.0/16#TCP#3000",
    # 拒绝其他
    "DROP#0.0.0.0/0#ALL#ALL",
  ]

  egress = [
    "ACCEPT#0.0.0.0/0#ALL#ALL",
  ]
}

# 数据库安全组 — 仅允许 VPC 内访问
resource "tencentcloud_security_group" "db" {
  name        = "new-api-db-sg"
  description = "Security group for databases, VPC internal only"
  tags        = var.tags
}

resource "tencentcloud_security_group_lite_rule" "db_rules" {
  security_group_id = tencentcloud_security_group.db.id

  ingress = [
    # 仅 VPC 内部可访问 PostgreSQL
    "ACCEPT#10.0.0.0/16#TCP#5432",
    # 仅 VPC 内部可访问 Redis
    "ACCEPT#10.0.0.0/16#TCP#6379",
    "DROP#0.0.0.0/0#ALL#ALL",
  ]

  egress = [
    "ACCEPT#0.0.0.0/0#ALL#ALL",
  ]
}
