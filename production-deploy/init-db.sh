#!/bin/bash
set -e

echo "=========================================="
echo "初始化 PostgreSQL 数据库"
echo "=========================================="

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL

-- 创建 new-api 数据库
CREATE DATABASE "new-api";
echo "✓ 创建数据库: new-api"

-- 创建 CLIProxyAPI 数据库
CREATE DATABASE "cliproxy";
echo "✓ 创建数据库: cliproxy"

-- 授权
GRANT ALL PRIVILEGES ON DATABASE "new-api" TO "$POSTGRES_USER";
GRANT ALL PRIVILEGES ON DATABASE "cliproxy" TO "$POSTGRES_USER";

echo "=========================================="
echo "数据库初始化完成"
echo "=========================================="

EOSQL
