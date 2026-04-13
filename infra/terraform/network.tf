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

resource "tencentcloud_security_group_rule_set" "app_rules" {
  security_group_id = tencentcloud_security_group.app.id

  ingress {
    action      = "ACCEPT"
    cidr_block  = "10.0.0.0/16"
    protocol    = "ALL"
    port        = "ALL"
    description = "VPC internal"
  }

  ingress {
    action      = "ACCEPT"
    cidr_block  = "0.0.0.0/0"
    protocol    = "TCP"
    port        = "80"
    description = "HTTP"
  }

  ingress {
    action      = "ACCEPT"
    cidr_block  = "0.0.0.0/0"
    protocol    = "TCP"
    port        = "443"
    description = "HTTPS"
  }

  ingress {
    action      = "ACCEPT"
    cidr_block  = "10.0.0.0/16"
    protocol    = "TCP"
    port        = "3000"
    description = "App port for CLB health check"
  }

  egress {
    action      = "ACCEPT"
    cidr_block  = "0.0.0.0/0"
    protocol    = "ALL"
    port        = "ALL"
    description = "Allow all outbound"
  }
}

# 数据库安全组 — 仅允许 VPC 内访问
resource "tencentcloud_security_group" "db" {
  name        = "new-api-db-sg"
  description = "Security group for databases, VPC internal only"
  tags        = var.tags
}

resource "tencentcloud_security_group_rule_set" "db_rules" {
  security_group_id = tencentcloud_security_group.db.id

  ingress {
    action      = "ACCEPT"
    cidr_block  = "10.0.0.0/16"
    protocol    = "TCP"
    port        = "5432"
    description = "PostgreSQL from VPC"
  }

  ingress {
    action      = "ACCEPT"
    cidr_block  = "10.0.0.0/16"
    protocol    = "TCP"
    port        = "6379"
    description = "Redis from VPC"
  }

  egress {
    action      = "ACCEPT"
    cidr_block  = "0.0.0.0/0"
    protocol    = "ALL"
    port        = "ALL"
    description = "Allow all outbound"
  }
}
