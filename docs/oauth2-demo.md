# OAuth2服务端使用Demo - 自动登录流程

本文档演示如何使用new-api的OAuth2服务器实现自动登录功能，包括两种授权模式的完整流程。

## 📋 准备工作

### 1. 启用OAuth2服务器
在管理后台 -> 设置 -> OAuth2 & SSO 中：
```
启用OAuth2服务器: 开启
签发者标识(Issuer): https://your-domain.com
访问令牌有效期: 60分钟
刷新令牌有效期: 24小时
JWT签名算法: RS256
允许的授权类型: client_credentials, authorization_code
```

### 2. 创建OAuth2客户端
在OAuth2客户端管理中创建应用：
```
客户端名称: My App
客户端类型: 机密客户端 (Confidential)
授权类型: Client Credentials, Authorization Code
权限范围: api:read, api:write
重定向URI: https://your-app.com/callback
```

创建成功后会获得：
- Client ID: `your_client_id`
- Client Secret: `your_client_secret` (仅显示一次)

## 🔐 方式一：客户端凭证流程 (Client Credentials)

适用于**服务器到服务器**的API调用，无需用户交互。

### 获取访问令牌

```bash
curl -X POST https://your-domain.com/api/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -d "client_id=your_client_id" \
  -d "client_secret=your_client_secret" \
  -d "scope=api:read api:write"
```

**响应示例：**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "api:read api:write"
}
```

### 使用访问令牌调用API

```bash
curl -X GET https://your-domain.com/api/user/self \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## 👤 方式二：授权码流程 (Authorization Code + PKCE)

适用于**用户登录**场景，支持自动登录功能。

### Step 1: 生成PKCE参数

```javascript
// 生成随机code_verifier
function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode.apply(null, array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// 生成code_challenge
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
```

### Step 2: 重定向用户到授权页面

```javascript
const codeVerifier = generateCodeVerifier();
const codeChallenge = await generateCodeChallenge(codeVerifier);

// 保存code_verifier到本地存储
localStorage.setItem('oauth_code_verifier', codeVerifier);

// 构建授权URL
const authUrl = new URL('https://your-domain.com/api/oauth/authorize');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('client_id', 'your_client_id');
authUrl.searchParams.set('redirect_uri', 'https://your-app.com/callback');
authUrl.searchParams.set('scope', 'api:read api:write');
authUrl.searchParams.set('state', 'random_state_value');
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

// 重定向到授权页面
window.location.href = authUrl.toString();
```

### Step 3: 处理授权回调

用户授权后会跳转到`https://your-app.com/callback?code=xxx&state=xxx`

```javascript
// 在callback页面处理授权码
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');
const codeVerifier = localStorage.getItem('oauth_code_verifier');

if (code && codeVerifier) {
  // 交换访问令牌
  const tokenResponse = await fetch('https://your-domain.com/api/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: 'your_client_id',
      client_secret: 'your_client_secret',
      code: code,
      redirect_uri: 'https://your-app.com/callback',
      code_verifier: codeVerifier
    })
  });

  const tokens = await tokenResponse.json();
  
  // 解析JWT令牌获取用户信息
  const userInfo = parseJWTToken(tokens.access_token);
  console.log('用户信息:', userInfo);
  
  // 保存令牌和用户信息
  localStorage.setItem('access_token', tokens.access_token);
  localStorage.setItem('refresh_token', tokens.refresh_token);
  localStorage.setItem('user_info', JSON.stringify(userInfo));
  
  // 清理临时数据
  localStorage.removeItem('oauth_code_verifier');
  
  // 跳转到应用首页
  window.location.href = '/dashboard';
}
```

### Step 4: JWT令牌解析和用户信息获取

授权码流程返回的`access_token`是一个JWT令牌，包含用户信息：

```javascript
// JWT令牌解析函数
function parseJWTToken(token) {
  try {
    // JWT格式: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT token format');
    }

    // 解码payload部分
    const payload = JSON.parse(atob(parts[1]));
    
    // 提取用户信息
    return {
      userId: payload.sub,           // 用户ID
      username: payload.preferred_username || payload.sub,
      email: payload.email,          // 用户邮箱
      name: payload.name,            // 用户姓名
      roles: payload.scope?.split(' ') || [], // 权限范围
      groups: payload.groups || [],   // 用户组
      exp: payload.exp,              // 过期时间
      iat: payload.iat,              // 签发时间
      iss: payload.iss,              // 签发者
      aud: payload.aud               // 受众
    };
  } catch (error) {
    console.error('Failed to parse JWT token:', error);
    return null;
  }
}

// JWT令牌验证函数
function validateJWTToken(token) {
  const userInfo = parseJWTToken(token);
  if (!userInfo) return false;
  
  // 检查令牌是否过期
  const now = Math.floor(Date.now() / 1000);
  if (userInfo.exp && now >= userInfo.exp) {
    console.log('JWT token has expired');
    return false;
  }
  
  return true;
}

// 获取用户信息示例
async function getUserInfoFromToken() {
  const token = localStorage.getItem('access_token');
  if (!token) return null;
  
  if (!validateJWTToken(token)) {
    // 令牌无效或过期，尝试刷新
    const newToken = await refreshToken();
    if (newToken) {
      return parseJWTToken(newToken);
    }
    return null;
  }
  
  return parseJWTToken(token);
}
```

**JWT令牌示例内容:**
```json
{
  "sub": "user123",                    // 用户唯一标识
  "preferred_username": "john_doe",    // 用户名
  "email": "john@example.com",         // 邮箱
  "name": "John Doe",                  // 真实姓名
  "scope": "api:read api:write",       // 权限范围
  "groups": ["users", "developers"],   // 用户组
  "iss": "https://your-domain.com",    // 签发者
  "aud": "your_client_id",             // 受众
  "exp": 1609459200,                   // 过期时间戳
  "iat": 1609455600,                   // 签发时间戳
  "jti": "token-unique-id"             // 令牌唯一ID
}
```

## 👤 自动创建用户登录流程

### 用户信息收集和自动创建

当启用了`AutoCreateUser`选项时，用户首次通过OAuth2授权后会自动创建账户：

```javascript
// 用户信息收集表单
function showUserInfoForm(jwtUserInfo) {
  const formHTML = `
    <div id="userInfoForm" style="max-width: 400px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
      <h3>完善用户信息</h3>
      <p>系统将为您自动创建账户，请填写或确认以下信息：</p>
      
      <form id="userRegistrationForm">
        <div style="margin-bottom: 15px;">
          <label>用户名 <span style="color: red;">*</span></label>
          <input type="text" id="username" value="${jwtUserInfo.username || ''}" required 
                 style="width: 100%; padding: 8px; margin-top: 5px;">
          <small>用于登录的用户名</small>
        </div>
        
        <div style="margin-bottom: 15px;">
          <label>显示名称</label>
          <input type="text" id="displayName" value="${jwtUserInfo.name || jwtUserInfo.username || ''}"
                 style="width: 100%; padding: 8px; margin-top: 5px;">
          <small>在界面上显示的名称</small>
        </div>
        
        <div style="margin-bottom: 15px;">
          <label>邮箱地址</label>
          <input type="email" id="email" value="${jwtUserInfo.email || ''}"
                 style="width: 100%; padding: 8px; margin-top: 5px;">
          <small>用于接收通知和找回密码</small>
        </div>
        
        <div style="margin-bottom: 15px;">
          <label>所属组织</label>
          <input type="text" id="group" value="oauth2" readonly
                 style="width: 100%; padding: 8px; margin-top: 5px; background: #f5f5f5;">
          <small>OAuth2自动创建的用户组</small>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h4>从OAuth2提供商获取的信息：</h4>
          <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px;">
${JSON.stringify(jwtUserInfo, null, 2)}
          </pre>
        </div>
        
        <button type="submit" style="background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
          创建账户并登录
        </button>
        <button type="button" onclick="cancelRegistration()" style="background: #6c757d; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">
          取消
        </button>
      </form>
    </div>
  `;
  
  document.body.innerHTML = formHTML;
  
  // 绑定表单提交事件
  document.getElementById('userRegistrationForm').addEventListener('submit', handleUserRegistration);
}

// 处理用户注册
async function handleUserRegistration(event) {
  event.preventDefault();
  
  const formData = {
    username: document.getElementById('username').value.trim(),
    displayName: document.getElementById('displayName').value.trim(),
    email: document.getElementById('email').value.trim(),
    group: document.getElementById('group').value,
    oauth2Provider: 'oauth2',
    oauth2UserId: parseJWTToken(localStorage.getItem('access_token')).userId
  };
  
  try {
    // 调用自动创建用户API
    const response = await fetch('https://your-domain.com/api/oauth/auto_create_user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      },
      body: JSON.stringify(formData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      // 用户创建成功，跳转到主界面
      localStorage.setItem('user_created', 'true');
      window.location.href = '/dashboard';
    } else {
      alert('创建用户失败: ' + result.message);
    }
  } catch (error) {
    console.error('用户创建失败:', error);
    alert('创建用户时发生错误，请重试');
  }
}

// 取消注册
function cancelRegistration() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/';
}
```

### 完整的自动登录流程

```javascript
// 改进的自动登录初始化
async function initAutoLogin() {
  try {
    // 1. 检查是否有有效的访问令牌
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken || !validateJWTToken(accessToken)) {
      // 没有有效令牌，开始OAuth2授权流程
      startOAuth2Authorization();
      return;
    }
    
    // 2. 解析JWT令牌获取用户信息
    const jwtUserInfo = parseJWTToken(accessToken);
    console.log('JWT用户信息:', jwtUserInfo);
    
    // 3. 检查用户是否已存在于系统中
    const userExists = await checkUserExists(jwtUserInfo.userId);
    
    if (!userExists && !localStorage.getItem('user_created')) {
      // 4. 用户不存在且未创建，显示用户信息收集表单
      showUserInfoForm(jwtUserInfo);
      return;
    }
    
    // 5. 用户已存在或已创建，直接登录
    const apiUserInfo = await oauth2Client.callAPI('/api/user/self');
    console.log('API用户信息:', apiUserInfo);
    
    // 6. 显示主界面
    showDashboard(jwtUserInfo, apiUserInfo);
    
  } catch (error) {
    console.error('自动登录失败:', error);
    // 清理令牌并重新开始授权流程
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_created');
    startOAuth2Authorization();
  }
}

// 检查用户是否存在
async function checkUserExists(userId) {
  try {
    const response = await fetch(`https://your-domain.com/api/oauth/user_exists/${userId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      }
    });
    
    const result = await response.json();
    return result.exists;
  } catch (error) {
    console.error('检查用户存在性失败:', error);
    return false;
  }
}

// 开始OAuth2授权流程
function startOAuth2Authorization() {
  const oauth2Client = new OAuth2Client({
    clientId: 'your_client_id',
    clientSecret: 'your_client_secret',
    serverUrl: 'https://your-domain.com',
    redirectUri: window.location.origin + '/callback',
    scopes: 'api:read api:write'
  });
  
  oauth2Client.startAuthorizationCodeFlow();
}
```

### 服务器端自动创建用户API

需要在服务器端实现相应的API端点：

```go
// 用户存在性检查
func CheckUserExists(c *gin.Context) {
    oauthUserId := c.Param("oauth_user_id")
    
    var user model.User
    err := model.DB.Where("oauth2_user_id = ?", oauthUserId).First(&user).Error
    
    if errors.Is(err, gorm.ErrRecordNotFound) {
        c.JSON(http.StatusOK, gin.H{
            "exists": false,
        })
    } else if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Database error",
        })
    } else {
        c.JSON(http.StatusOK, gin.H{
            "exists": true,
            "user_id": user.Id,
        })
    }
}

// 自动创建用户
func AutoCreateUser(c *gin.Context) {
    settings := system_setting.GetOAuth2Settings()
    if !settings.AutoCreateUser {
        c.JSON(http.StatusForbidden, gin.H{
            "success": false,
            "message": "自动创建用户功能未启用",
        })
        return
    }
    
    var req struct {
        Username      string `json:"username" binding:"required"`
        DisplayName   string `json:"displayName"`
        Email         string `json:"email"`
        Group         string `json:"group"`
        OAuth2UserId  string `json:"oauth2UserId" binding:"required"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{
            "success": false,
            "message": "无效的请求参数",
        })
        return
    }
    
    // 检查用户是否已存在
    var existingUser model.User
    err := model.DB.Where("username = ? OR oauth2_user_id = ?", req.Username, req.OAuth2UserId).First(&existingUser).Error
    if err == nil {
        c.JSON(http.StatusConflict, gin.H{
            "success": false,
            "message": "用户已存在",
        })
        return
    }
    
    // 创建新用户
    user := model.User{
        Username:      req.Username,
        DisplayName:   req.DisplayName,
        Email:         req.Email,
        Group:         settings.DefaultUserGroup,
        Role:          settings.DefaultUserRole,
        Status:        1,
        Password:      common.GenerateRandomString(32), // 随机密码，用户通过OAuth2登录
        OAuth2UserId:  req.OAuth2UserId,
    }
    
    if req.DisplayName == "" {
        user.DisplayName = req.Username
    }
    
    if user.Group == "" {
        user.Group = "oauth2"
    }
    
    err = user.Insert(0)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "success": false,
            "message": "创建用户失败: " + err.Error(),
        })
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "success": true,
        "message": "用户创建成功",
        "user_id": user.Id,
    })
}
```

## 🔄 自动登录实现

### 令牌刷新机制

```javascript
async function refreshToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  
  if (!refreshToken) {
    // 重新授权
    redirectToAuth();
    return;
  }

  try {
    const response = await fetch('https://your-domain.com/api/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: 'your_client_id',
        client_secret: 'your_client_secret',
        refresh_token: refreshToken
      })
    });

    const tokens = await response.json();
    
    if (tokens.access_token) {
      localStorage.setItem('access_token', tokens.access_token);
      if (tokens.refresh_token) {
        localStorage.setItem('refresh_token', tokens.refresh_token);
      }
      return tokens.access_token;
    }
  } catch (error) {
    // 刷新失败，重新授权
    redirectToAuth();
  }
}
```

### 自动认证拦截器

```javascript
class OAuth2Client {
  constructor(clientId, clientSecret, baseURL) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.baseURL = baseURL;
  }

  // 自动处理认证的请求方法
  async request(url, options = {}) {
    let accessToken = localStorage.getItem('access_token');
    
    // 检查令牌是否即将过期
    if (this.isTokenExpiringSoon(accessToken)) {
      accessToken = await this.refreshToken();
    }

    // 添加认证头
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        ...options,
        headers
      });

      // 如果401，尝试刷新令牌
      if (response.status === 401) {
        accessToken = await this.refreshToken();
        headers['Authorization'] = `Bearer ${accessToken}`;
        
        // 重试请求
        return fetch(`${this.baseURL}${url}`, {
          ...options,
          headers
        });
      }

      return response;
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }

  // 检查令牌是否即将过期
  isTokenExpiringSoon(token) {
    if (!token) return true;
    
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      
      const payload = JSON.parse(atob(parts[1]));
      const exp = payload.exp * 1000; // 转换为毫秒
      const now = Date.now();
      return exp - now < 5 * 60 * 1000; // 5分钟内过期
    } catch (error) {
      console.error('Token validation failed:', error);
      return true;
    }
  }

  // 获取当前用户信息
  getCurrentUser() {
    const token = localStorage.getItem('access_token');
    if (!token || !this.validateJWTToken(token)) {
      return null;
    }
    
    return this.parseJWTToken(token);
  }

  // 解析JWT令牌
  parseJWTToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT token format');
      }

      const payload = JSON.parse(atob(parts[1]));
      
      return {
        userId: payload.sub,
        username: payload.preferred_username || payload.sub,
        email: payload.email,
        name: payload.name,
        roles: payload.scope?.split(' ') || [],
        groups: payload.groups || [],
        exp: payload.exp,
        iat: payload.iat,
        iss: payload.iss,
        aud: payload.aud
      };
    } catch (error) {
      console.error('Failed to parse JWT token:', error);
      return null;
    }
  }

  // 验证JWT令牌
  validateJWTToken(token) {
    const userInfo = this.parseJWTToken(token);
    if (!userInfo) return false;
    
    const now = Math.floor(Date.now() / 1000);
    if (userInfo.exp && now >= userInfo.exp) {
      return false;
    }
    
    return true;
  }

  // 获取用户信息
  async getUserInfo() {
    const response = await this.request('/api/user/self');
    return response.json();
  }

  // 调用API示例
  async callAPI(endpoint, data = null) {
    const options = data ? {
      method: 'POST',
      body: JSON.stringify(data)
    } : { method: 'GET' };

    const response = await this.request(endpoint, options);
    return response.json();
  }
}
```

### 使用示例

```javascript
// 初始化OAuth2客户端
const oauth2Client = new OAuth2Client(
  'your_client_id',
  'your_client_secret',
  'https://your-domain.com'
);

// 应用启动时自动检查登录状态
async function initApp() {
  try {
    // 尝试获取用户信息（会自动处理令牌刷新）
    const userInfo = await oauth2Client.getUserInfo();
    console.log('User logged in:', userInfo);
    
    // 显示用户界面
    showDashboard(userInfo);
  } catch (error) {
    // 用户未登录，重定向到授权页面
    redirectToAuth();
  }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initApp);
```

## 🛡️ 安全最佳实践

### 1. HTTPS 必需
```
生产环境必须使用HTTPS
重定向URI必须使用https://（本地开发可用http://localhost）
```

### 2. 状态参数验证
```javascript
// 发起授权时
const state = crypto.randomUUID();
localStorage.setItem('oauth_state', state);

// 回调时验证
const returnedState = urlParams.get('state');
const savedState = localStorage.getItem('oauth_state');
if (returnedState !== savedState) {
  throw new Error('State mismatch - possible CSRF attack');
}
```

### 3. 令牌安全存储
```javascript
// 使用HttpOnly Cookie（推荐）
// 或加密存储在localStorage
function secureStorage() {
  return {
    setItem: (key, value) => {
      const encrypted = encrypt(value); // 使用加密
      localStorage.setItem(key, encrypted);
    },
    getItem: (key) => {
      const encrypted = localStorage.getItem(key);
      return encrypted ? decrypt(encrypted) : null;
    }
  };
}
```

## 📚 完整示例项目

创建一个完整的单页应用示例：

```html
<!DOCTYPE html>
<html>
<head>
    <title>OAuth2 Demo</title>
</head>
<body>
    <div id="login-section">
        <h1>请登录</h1>
        <button onclick="login()">使用OAuth2登录</button>
    </div>
    
    <div id="app-section" style="display:none">
        <h1>欢迎！</h1>
        <div id="user-info"></div>
        <button onclick="logout()">登出</button>
        <button onclick="testAPI()">测试API调用</button>
    </div>

    <script>
        // 这里包含上面的所有OAuth2Client代码
        
        const oauth2Client = new OAuth2Client(
            'your_client_id',
            'your_client_secret',
            'https://your-domain.com'
        );

        async function login() {
            // 实现授权码流程...
        }

        async function logout() {
            localStorage.clear();
            location.reload();
        }

        async function testAPI() {
            try {
                const result = await oauth2Client.callAPI('/api/user/self');
                alert('API调用成功: ' + JSON.stringify(result));
            } catch (error) {
                alert('API调用失败: ' + error.message);
            }
        }

        // 初始化应用
        initApp();
    </script>
</body>
</html>
```

## 🔍 调试和测试

### 验证JWT令牌
访问 [jwt.io](https://jwt.io) 解析令牌内容：
```
Header: {"alg":"RS256","typ":"JWT","kid":"oauth2-key-1"}
Payload: {"sub":"user_id","aud":"your_client_id","exp":1234567890}
```

### 查看服务器信息
```bash
curl https://your-domain.com/.well-known/oauth-authorization-server
```

### 获取JWKS公钥
```bash
curl https://your-domain.com/.well-known/jwks.json
```

---

这个demo涵盖了OAuth2服务器的完整使用流程，实现了真正的自动登录功能。用户只需要第一次授权，之后应用会自动处理令牌刷新和API认证。