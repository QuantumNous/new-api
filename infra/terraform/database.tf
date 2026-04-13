# ============================================================
# 云数据库 PostgreSQL
# ============================================================
resource "tencentcloud_postgresql_instance" "main" {
  name              = "new-api-pg"
  availability_zone = var.availability_zone
  charge_type       = "POSTPAID_BY_HOUR"
  vpc_id            = tencentcloud_vpc.main.id
  subnet_id         = tencentcloud_subnet.db.id
  engine_version    = "15.0"
  root_password     = var.db_password
  storage           = var.db_storage
  memory            = var.db_memory
  security_groups   = [tencentcloud_security_group.db.id]

  db_node_set {
    role = "Primary"
    zone = var.availability_zone
  }

  tags = var.tags
}

# 注意：tencentcloud_postgresql_database 资源不受 Provider 支持
# 数据库 new_api 需要在首次部署后手动创建，或通过 provisioner 执行：
#   CREATE DATABASE new_api;
# new-api 应用在启动时如果数据库不存在会自动创建表结构（GORM AutoMigrate）

# ============================================================
# 云数据库 Redis
# ============================================================
resource "tencentcloud_redis_instance" "main" {
  name              = "new-api-redis"
  availability_zone = var.availability_zone
  type_id           = 2 # Redis 主从版
  mem_size          = var.redis_mem_size
  vpc_id            = tencentcloud_vpc.main.id
  subnet_id         = tencentcloud_subnet.db.id
  security_groups   = [tencentcloud_security_group.db.id]
  charge_type       = "POSTPAID"

  tags = var.tags
}
