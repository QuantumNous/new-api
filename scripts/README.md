# JavaScript Runtime Scripts

本目录包含 JavaScript Runtime 中间件使用的脚本文件。

## 脚本加载

- 系统会自动读取 `scripts/` 目录下的所有 `.js` 文件
- 脚本按文件名字母顺序加载
- 建议使用数字前缀来控制加载顺序（如：`01_utils.js`, `02_pre_process.js`）
- 所有脚本会被合并到一个 JavaScript 运行时环境中

## 配置

通过环境变量配置：

- `JS_RUNTIME_ENABLED=true` - 启用 JavaScript Runtime
- `JS_SCRIPT_DIR=scripts/` - 脚本目录路径
- `JS_MAX_VM_COUNT=8` - 最大虚拟机数量
- `JS_SCRIPT_TIMEOUT=5s` - 脚本执行超时时间
- `JS_FETCH_TIMEOUT=10s` - HTTP 请求超时时间

更多的详细配置可以在 `.env.example` 文件中找到，并在实际使用时重命名为 `.env`。

## 必需的函数

脚本中必须定义以下两个函数：

### 1. preProcessRequest(req)

在请求被转发到后端 API 之前调用。

**参数：**

- `req`: 请求对象，包含 `method`, `url`, `headers`, `body` 等属性

**返回值：**
返回一个对象，可包含以下属性：

- `block`: boolean - 是否阻止请求继续执行
- `statusCode`: number - 阻止请求时返回的状态码
- `message`: string - 阻止请求时返回的错误消息
- `headers`: object - 要修改或添加的请求头
- `body`: any - 修改后的请求体

### 2. postProcessResponse(req, resp)

在响应返回给客户端之前调用。

**参数：**

- `req`: 原始请求对象
- `resp`: 响应对象，包含 `statusCode`, `headers`, `body` 等属性

**返回值：**
返回一个对象，可包含以下属性：

- `statusCode`: number - 修改后的状态码
- `headers`: object - 要修改或添加的响应头
- `body`: string - 修改后的响应体

## 可用的全局对象和函数

- `console.log()`, `console.error()`, `console.warn()` - 日志输出
- `JSON.parse()`, `JSON.stringify()` - JSON 处理
- `fetch(url, options)` - HTTP 请求
- `db` - 主数据库连接
- `logdb` - 日志数据库连接
- `setTimeout(fn, delay)` - 定时器

## 示例脚本

参考现有的示例脚本：

- `01_utils.js` - 工具函数
- `02_pre_process.js` - 请求预处理
- `03_post_process.js` - 响应后处理

## 使用示例

```js
// 例子：基于数据库的速率限制
if (req.url.includes("/v1/chat/completions")) {
    try {
        // Check recent requests from this IP
        var recentRequests = db.query(
            "SELECT COUNT(*) as count FROM logs WHERE created_at > ? AND ip = ?",
            Math.floor(Date.now() / 1000) - 60, // last minute
            req.remoteIP
        );
        if (recentRequests && recentRequests.length > 0 && recentRequests[0].count > 10) {
            console.log("速率限制 IP:", req.remoteIP);
            return {
                block: true,
                statusCode: 429,
                message: "超过速率限制"
            };
        }
    } catch (e) {
        console.error("Ratelimit 数据库错误:", e);
    }
}


// 例子：修改请求
if (req.url.includes("/chat/completions")) {
    try {
        var bodyObj = req.body;
        let firstMsg = { // 需要新建一个对象，不能修改原有对象
            role: "user",
            content: "喵呜🐱～嘻嘻"
        };
        bodyObj.messages[0] = firstMsg;
        console.log("Modified first message:", JSON.stringify(firstMsg));
        console.log("Modified body:", JSON.stringify(bodyObj));
        return {
            body: bodyObj,
            headers: {
                ...req.headers,
                "X-Modified-Body": "true"
            }
        };
    } catch (e) {
        console.error("Failed to modify request body:", {
            message: e.message,
            stack: e.stack,
            bodyType: typeof req.body,
            url: req.url
        });
    }
}


// 例子：读取最近一条日志，新增 jsrt 日志，并输出日志总数
try {
    // 1. 读取最近一条日志
    var recentLogs = logdb.query(
        "SELECT id, user_id, username, content, created_at FROM logs ORDER BY id DESC LIMIT 1"
    );
    var recentLog = null;
    if (recentLogs && recentLogs.length > 0) {
        recentLog = recentLogs[0];
        console.log("最近一条日志:", JSON.stringify(recentLog));
    }
    // 2. 新增一条 jsrt 日志
    var currentTimestamp = Math.floor(Date.now() / 1000);
    var jsrtLogContent = "JSRT 预处理中间件执行 - " + req.URL + " - " + new Date().toISOString();
    var insertResult = logdb.exec(
        "INSERT INTO logs (user_id, username, created_at, type, content) VALUES (?, ?, ?, ?, ?)",
        req.UserID || 0,
        req.Username || "jsrt-system",
        currentTimestamp,
        4, // LogTypeSystem
        jsrtLogContent
    );
    if (insertResult.error) {
        console.error("插入 JSRT 日志失败:", insertResult.error);
    } else {
        console.log("成功插入 JSRT 日志，影响行数:", insertResult.rowsAffected);
    }
    // 3. 输出日志总数
    var totalLogsResult = logdb.query("SELECT COUNT(*) as total FROM logs");
    var totalLogs = 0;
    if (totalLogsResult && totalLogsResult.length > 0) {
        totalLogs = totalLogsResult[0].total;
    }
    console.log("当前日志总数:", totalLogs);
    console.log("JSRT 日志管理示例执行完成");
} catch (e) {
    console.error("JSRT 日志管理示例执行失败:", {
        message: e.message,
        stack: e.stack,
        url: req.URL
    });
}


// 例子：使用 fetch 调用外部 API
if (req.url.includes("/api/uptime/status")) {
    try {
        // 使用 httpbin.org/ip 测试 fetch 功能
        var response = fetch("https://httpbin.org/ip", {
            method: "GET",
            timeout: 5, // 5秒超时
            headers: {
                "User-Agent": "JSRT/1.0"
            }
        });
        if (response.Error.length === 0) {
            // 解析响应体
            var ipData = JSON.parse(response.Body);
            // 可以根据获取到的 IP 信息进行后续处理
            if (ipData.origin) {
                console.log("外部 IP 地址:", ipData.origin);
                // 示例：记录 IP 信息到数据库
                var currentTimestamp = Math.floor(Date.now() / 1000);
                var logContent = "Fetch 示例 - 外部 IP: " + ipData.origin + " - " + new Date().toISOString();
                var insertResult = logdb.exec(
                    "INSERT INTO logs (user_id, username, created_at, type, content) VALUES (?, ?, ?, ?, ?)",
                    0,
                    "jsrt-fetch",
                    currentTimestamp,
                    4, // LogTypeSystem
                    logContent
                );
                if (insertResult.error) {
                    console.error("记录 IP 信息失败:", insertResult.error);
                } else {
                    console.log("成功记录 IP 信息到数据库");
                }
            }
        } else {
            console.error("Fetch 失败 ", response.Status, " ", response.Error);
        }
    } catch (e) {
        console.error("Fetch 失败:", {
            message: e.message,
            stack: e.stack,
            url: req.url
        });
    }
}
```

## 管理接口

### 重新加载脚本

```bash
curl -X POST http://host:port/api/jsrt/reload \
        -H 'Content-Type: application/json' \
        -H 'Authorization Bearer <admin_token>'
```

## 故障排除

- 查看服务日志中的 JavaScript 相关错误信息
- 使用 `console.log()` 调试脚本逻辑
- 确保 JavaScript 语法正确（不支持所有 ES6+ 特性）
