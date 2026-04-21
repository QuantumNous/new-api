# 端口
export PORT=80

export TLS_PORT=443
export TLS_CERT=./conf/cert.pem
export TLS_KEY=./conf/key.pem

# 调试模式
export DEBUG=false

# 数据库相关配置
export ERROR_LOG_ENABLED=true
export SQL_DSN='root:Quikcat123!@tcp(localhost:3306)/newapi?parseTime=true'
export LOG_SQL_DSN='root:Quikcat123!@tcp(localhost:3306)/logdb?parseTime=true'
export SQL_MAX_IDLE_CONNS=100
export SQL_MAX_OPEN_CONNS=1000
export SQL_MAX_LIFETIME=60

# 缓存相关配置
export REDIS_CONN_STRING=redis://127.0.0.1:6379/0
export SYNC_FREQUENCY=60
export MEMORY_CACHE_ENABLED=true
export CHANNEL_UPDATE_FREQUENCY=30
export BATCH_UPDATE_ENABLED=true
export BATCH_UPDATE_INTERVAL=5

# 会话密钥（请替换为随机字符串）
export SESSION_SECRET=change_me_to_a_random_secret_string

# 超时设置
export RELAY_TIMEOUT=0
export STREAMING_TIMEOUT=300

# 功能配置
export UPDATE_TASK=true
export GET_MEDIA_TOKEN=true
export GENERATE_DEFAULT_TOKEN=true

# 节点类型
export NODE_TYPE=master