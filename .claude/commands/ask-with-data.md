---
description: Intelligent assistant that queries database when needed and completes tasks with data context
argument-hint: "<your question or task>"
allowed-tools: [Bash, Read, Write, Grep, Glob, Edit, MultiEdit]
---

# Data-Enhanced AI Assistant

This intelligent assistant will:
1. Analyze your question or task to identify parts that need database support
2. Auto-discover your project's database configuration  
3. Query relevant database data when needed
4. Complete your task using both the database context and codebase knowledge

## Usage
```
/ask-with-data <your question or task>
```

## Examples
```
/ask-with-data Help me optimize the user registration process based on current user data
/ask-with-data Create a dashboard showing our most popular API channels  
/ask-with-data Fix the billing issues for users with high usage
/ask-with-data Analyze why error rates increased and suggest improvements
/ask-with-data Write a report on our top customers and their usage patterns
/ask-with-data Help me understand which models are underperforming
```

---

I'll analyze your task and gather any necessary database context to provide you with the best assistance: **$ARGUMENTS**

Let me first check if your task requires database information, and if so, I'll gather that data before proceeding.

!echo "🔍 Analyzing question: $ARGUMENTS" && echo "=================================="

!echo "🔍 Auto-discovering database configuration..." && \
DB_TYPE="" && DB_CONNECTION="" && \
if [ -f "config.yaml" ] || [ -f "config.yml" ]; then echo "📁 Found YAML config file"; fi && \
if [ -f "config.json" ]; then echo "📁 Found JSON config file"; fi && \
if [ -f ".env" ]; then echo "📁 Found .env file"; source .env 2>/dev/null; fi && \
if [ -f "application.properties" ]; then echo "📁 Found Spring properties file"; fi && \
if [ -f "go.mod" ]; then echo "📁 Found Go project"; fi && \
if [ -f "data/new-api.db" ]; then DB_TYPE="sqlite"; DB_CONNECTION="./data/new-api.db"; \
elif [ -f "database.db" ]; then DB_TYPE="sqlite"; DB_CONNECTION="./database.db"; \
elif [ -f "app.db" ]; then DB_TYPE="sqlite"; DB_CONNECTION="./app.db"; \
else DB_TYPE="sqlite"; DB_CONNECTION="./data/new-api.db"; fi && \
echo "✅ Database type: $DB_TYPE" && echo "✅ Connection: $DB_CONNECTION"

!echo "" && echo "🤖 Analyzing question for relevant data..." && \
QUESTION_LOWER=$(echo "$ARGUMENTS" | tr '[:upper:]' '[:lower:]') && \
QUERIES_TO_RUN="" && \
if [[ $QUESTION_LOWER =~ (user|account|register|signup|用户|注册|账户) ]]; then \
    echo "📈 Detected user-related question" && QUERIES_TO_RUN="$QUERIES_TO_RUN users"; \
fi && \
if [[ $QUESTION_LOWER =~ (channel|provider|api|integration|渠道|接口|集成) ]]; then \
    echo "🔌 Detected channel-related question" && QUERIES_TO_RUN="$QUERIES_TO_RUN channels"; \
fi && \
if [[ $QUESTION_LOWER =~ (request|usage|traffic|call|请求|使用|流量|调用) ]]; then \
    echo "📊 Detected request/usage question" && QUERIES_TO_RUN="$QUERIES_TO_RUN requests"; \
fi && \
if [[ $QUESTION_LOWER =~ (error|fail|problem|issue|错误|失败|问题) ]]; then \
    echo "🚨 Detected error-related question" && QUERIES_TO_RUN="$QUERIES_TO_RUN errors"; \
fi && \
if [[ $QUESTION_LOWER =~ (top|best|most|spending|customer|最多|最佳|消费|客户) ]]; then \
    echo "🏆 Detected top users question" && QUERIES_TO_RUN="$QUERIES_TO_RUN top_users"; \
fi && \
if [[ $QUESTION_LOWER =~ (model|gpt|claude|gemini|token|模型|令牌) ]]; then \
    echo "🤖 Detected model-related question" && QUERIES_TO_RUN="$QUERIES_TO_RUN models"; \
fi && \
if [ -z "$QUERIES_TO_RUN" ]; then \
    echo "🔍 No specific keywords detected, running general overview..." && QUERIES_TO_RUN="users channels requests"; \
fi

!echo "" && echo "📋 Running relevant database queries..." && echo "==================================" && \
DB_CONNECTION="./data/new-api.db" && \
for query_type in $QUERIES_TO_RUN; do \
    echo "" && echo "📊 Query: $query_type" && echo "----------------------------------------" && \
    case "$query_type" in \
        "users") \
            if [ -f "$DB_CONNECTION" ]; then \
                sqlite3 "$DB_CONNECTION" "SELECT COUNT(*) as total_users, COUNT(CASE WHEN created_at > datetime('now', '-30 days') THEN 1 END) as recent_users FROM users;" 2>/dev/null || echo "❌ Query failed"; \
            else echo "❌ Database not found"; fi ;; \
        "channels") \
            if [ -f "$DB_CONNECTION" ]; then \
                sqlite3 "$DB_CONNECTION" "SELECT type, COUNT(*) as count, AVG(priority) as avg_priority FROM channels GROUP BY type ORDER BY count DESC;" 2>/dev/null || echo "❌ Query failed"; \
            else echo "❌ Database not found"; fi ;; \
        "requests") \
            if [ -f "$DB_CONNECTION" ]; then \
                sqlite3 "$DB_CONNECTION" "SELECT DATE(created_at) as date, COUNT(*) as requests, SUM(quota) as total_quota FROM logs WHERE created_at > datetime('now', '-7 days') GROUP BY DATE(created_at) ORDER BY date;" 2>/dev/null || echo "❌ Query failed"; \
            else echo "❌ Database not found"; fi ;; \
        "errors") \
            if [ -f "$DB_CONNECTION" ]; then \
                sqlite3 "$DB_CONNECTION" "SELECT type, COUNT(*) as error_count FROM logs WHERE created_at > datetime('now', '-24 hours') AND (response_time = 0 OR content LIKE '%error%') GROUP BY type ORDER BY error_count DESC;" 2>/dev/null || echo "❌ Query failed"; \
            else echo "❌ Database not found"; fi ;; \
        "top_users") \
            if [ -f "$DB_CONNECTION" ]; then \
                sqlite3 "$DB_CONNECTION" "SELECT user_id, SUM(quota) as total_usage, COUNT(*) as request_count FROM logs WHERE created_at > datetime('now', '-30 days') GROUP BY user_id ORDER BY total_usage DESC LIMIT 10;" 2>/dev/null || echo "❌ Query failed"; \
            else echo "❌ Database not found"; fi ;; \
        "models") \
            if [ -f "$DB_CONNECTION" ]; then \
                sqlite3 "$DB_CONNECTION" "SELECT model, COUNT(*) as usage_count, AVG(prompt_tokens) as avg_prompt_tokens, AVG(completion_tokens) as avg_completion_tokens FROM logs WHERE created_at > datetime('now', '-7 days') GROUP BY model ORDER BY usage_count DESC;" 2>/dev/null || echo "❌ Query failed"; \
            else echo "❌ Database not found"; fi ;; \
    esac; \
done

!echo "" && echo "✅ Database analysis complete!" && echo "🎯 Now analyzing your question with this database context..."