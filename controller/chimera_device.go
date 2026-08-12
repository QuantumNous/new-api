package controller

// Chimera 桌面端设备授权流（RFC 8628 的最小实现）。
//
// 动机：桌面客户端登录不应经手账号密码，且网关登录启用了 Turnstile 人机
// 验证（桌面端无法渲染 challenge）。设备授权流把凭据输入和人机验证完整
// 保留在浏览器侧，桌面端只展示一次性设备码并轮询结果。
//
// 流程：
//  1. 桌面端 POST /api/chimera/device/code          → device_code + user_code + verification_uri
//  2. 用户浏览器打开 verification_uri（极简 HTML）  → 输入账号密码（+Turnstile）确认授权
//  3. 桌面端轮询 POST /api/chimera/device/token     → pending / ok{access_token}
//  4. 桌面端用 access_token 走既有 Dashboard API（拉取令牌列表等）
//
// 存储复用 auth_flows 表（见 model.AuthFlow）：device_code 即 flow token
// （服务端只存 HMAC）；user_code 存入 SessionId 列（带索引，便于确认页反查）。
// 详细设计与运维说明见 docs/chimera-desktop-auth.md。

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"html"
	"math/big"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

const (
	chimeraDeviceFlowPurpose  = "chimera_device_login"
	chimeraDeviceFlowTTL      = 10 * time.Minute
	chimeraDevicePollInterval = 3
)

// 去除易混淆字符（0O1IL）的设备码字母表
const chimeraUserCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

// user_code 严格格式：确认页只反射符合此格式的值（仅大写字母/数字/连字符），
// 从源头杜绝把 URL 传入的任意字符串注入到 HTML/JS 上下文（反射型 XSS）。
var chimeraUserCodeRe = regexp.MustCompile(`^[A-Z2-9]{4}-[A-Z2-9]{4}$`)

const chimeraDeviceInvalidCodePage = `<!doctype html><html lang="zh"><head><meta charset="utf-8">` +
	`<meta name="viewport" content="width=device-width,initial-scale=1"><title>Chimera 设备授权</title>` +
	`<style>body{margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;` +
	`background:#0B0F0E;color:#E8ECEA;font:14px/1.6 system-ui,"Noto Sans SC",sans-serif}` +
	`.card{width:min(92vw,380px);padding:32px 28px;border:1px solid rgba(255,255,255,.09);border-radius:14px;text-align:center}` +
	`</style></head><body><div class="card"><h1>设备码无效</h1>` +
	`<p>请核对桌面端显示的授权码后重试。</p></div></body></html>`

type chimeraDevicePayload struct {
	Status string `json:"status"` // pending | authorized
	UserId int    `json:"user_id,omitempty"`
}

func chimeraGenerateUserCode() (string, error) {
	letters := make([]byte, 8)
	max := big.NewInt(int64(len(chimeraUserCodeAlphabet)))
	for i := range letters {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		letters[i] = chimeraUserCodeAlphabet[n.Int64()]
	}
	return fmt.Sprintf("%s-%s", letters[:4], letters[4:]), nil
}

// ChimeraDeviceCode 签发设备码。匿名 + CriticalRateLimit。
func ChimeraDeviceCode(c *gin.Context) {
	userCode, err := chimeraGenerateUserCode()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	payload, err := common.Marshal(chimeraDevicePayload{Status: "pending"})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	deviceCode, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   chimeraDeviceFlowPurpose,
		SessionId: userCode, // SessionId 列挪用为 user_code 反查索引
		Payload:   string(payload),
		ExpiresAt: time.Now().Add(chimeraDeviceFlowTTL),
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	scheme := "https"
	if c.Request.TLS == nil && c.GetHeader("X-Forwarded-Proto") != "https" {
		scheme = "http"
	}
	verificationURI := fmt.Sprintf("%s://%s/api/chimera/device/verify?user_code=%s", scheme, c.Request.Host, userCode)
	common.ApiSuccess(c, gin.H{
		"device_code":      deviceCode,
		"user_code":        userCode,
		"verification_uri": verificationURI,
		"expires_in":       int(chimeraDeviceFlowTTL.Seconds()),
		"interval":         chimeraDevicePollInterval,
	})
}

func chimeraFindPendingFlowByUserCode(userCode string) (*model.AuthFlow, error) {
	var flow model.AuthFlow
	err := model.DB.
		Where("purpose = ? AND session_id = ? AND consumed_at IS NULL AND expires_at > ?",
			chimeraDeviceFlowPurpose, userCode, time.Now()).
		First(&flow).Error
	if err != nil {
		return nil, err
	}
	return &flow, nil
}

// ChimeraDeviceVerifyPage 浏览器确认页（Go 渲染极简 HTML，不依赖控制台前端）。
// 账号密码与 Turnstile 均在浏览器侧完成，桌面端全程不接触凭据。
func ChimeraDeviceVerifyPage(c *gin.Context) {
	userCode := strings.ToUpper(strings.TrimSpace(c.Query("user_code")))
	// 只接受严格格式的 user_code；否则渲染静态错误页（不回显任何原始输入）。
	if !chimeraUserCodeRe.MatchString(userCode) {
		c.Data(http.StatusBadRequest, "text/html; charset=utf-8", []byte(chimeraDeviceInvalidCodePage))
		return
	}
	turnstileBlock := ""
	turnstileScript := ""
	turnstileField := "''"
	if common.TurnstileCheckEnabled {
		turnstileBlock = `<div class="cf-turnstile" data-sitekey="` + html.EscapeString(common.TurnstileSiteKey) + `"></div>`
		turnstileScript = `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
		turnstileField = `(document.querySelector('[name="cf-turnstile-response"]')||{}).value||''`
	}
	page := `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chimera 设备授权</title>` + turnstileScript + `
<style>
body{margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0B0F0E;color:#E8ECEA;font:14px/1.6 system-ui,"Noto Sans SC",sans-serif}
.card{width:min(92vw,380px);padding:32px 28px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:#10231d33}
h1{margin:0 0 4px;font-size:17px}
p{margin:0 0 16px;color:#9aa5a0;font-size:12.5px}
.code{margin:0 0 20px;padding:10px;text-align:center;font:600 22px/1 ui-monospace,monospace;letter-spacing:3px;color:#DEA54C;border:1px dashed rgba(222,165,76,.45);border-radius:10px}
label{display:block;margin:0 0 6px;font-size:12px;color:#9aa5a0}
input{width:100%;box-sizing:border-box;margin:0 0 14px;padding:9px 12px;border:1px solid rgba(255,255,255,.14);border-radius:8px;background:#0B0F0E;color:#E8ECEA;font-size:13px;outline:none}
input:focus{border-color:#DEA54C}
button{width:100%;padding:10px;border:0;border-radius:8px;background:#DEA54C;color:#10231D;font-size:14px;font-weight:600;cursor:pointer}
button:disabled{opacity:.55}
.msg{margin-top:14px;font-size:12.5px;text-align:center}
.err{color:#e5734f}.ok{color:#46C39A}
</style></head><body><div class="card">
<h1>Chimera 设备授权</h1>
<p>请确认下方设备码与桌面端显示一致，登录后即完成授权。</p>
<div class="code" id="uc">` + html.EscapeString(userCode) + `</div>
<form id="f">
<label>账号</label><input name="username" autocomplete="username" required>
<label>密码</label><input name="password" type="password" autocomplete="current-password" required>
` + turnstileBlock + `
<button type="submit">授权此设备</button>
</form>
<div class="msg" id="m"></div>
<script>
const f=document.getElementById("f"),m=document.getElementById("m");
f.addEventListener("submit",async(e)=>{
  e.preventDefault();
  const btn=f.querySelector("button");btn.disabled=true;m.textContent="";m.className="msg";
  const turnstile=` + turnstileField + `;
  try{
    const res=await fetch("/api/chimera/device/authorize?turnstile="+encodeURIComponent(turnstile),{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({user_code:document.getElementById("uc").textContent.trim(),username:f.username.value,password:f.password.value})
    });
    const data=await res.json();
    if(data.success){m.textContent="授权成功，请回到桌面端。此页面可关闭。";m.className="msg ok";f.style.display="none"}
    else{m.textContent=data.message||"授权失败";m.className="msg err";btn.disabled=false}
  }catch{m.textContent="网络错误，请重试";m.className="msg err";btn.disabled=false}
});
</script></div></body></html>`
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(page))
}

type chimeraDeviceAuthorizeRequest struct {
	UserCode string `json:"user_code"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// ChimeraDeviceAuthorize 浏览器侧确认：校验账号密码后把待授权 flow 标记为已授权。
// 挂 CriticalRateLimit + TurnstileCheck（Turnstile token 经 query 传入，与登录一致）。
func ChimeraDeviceAuthorize(c *gin.Context) {
	var req chimeraDeviceAuthorizeRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	req.UserCode = strings.ToUpper(strings.TrimSpace(req.UserCode))
	if req.UserCode == "" || req.Username == "" || req.Password == "" {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	flow, err := chimeraFindPendingFlowByUserCode(req.UserCode)
	if err != nil {
		common.ApiErrorMsg(c, "设备码无效或已过期，请在桌面端重新发起授权")
		return
	}
	user := model.User{Username: req.Username, Password: req.Password}
	if err := user.ValidateAndFill(); err != nil {
		common.ApiErrorMsg(c, "账号或密码错误")
		return
	}
	if twoFA, err := model.IsTwoFAEnabled(user.Id); err != nil {
		common.ApiErrorMsg(c, "数据库错误")
		return
	} else if twoFA {
		// v1 不承接 2FA 交互；开启 2FA 的账号请改用 API 密钥方式接入桌面端。
		common.ApiErrorMsg(c, "该账号启用了两步验证，暂不支持设备授权，请使用 API 密钥方式")
		return
	}
	payload, err := common.Marshal(chimeraDevicePayload{Status: "authorized", UserId: user.Id})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	err = model.DB.Model(&model.AuthFlow{}).
		Where("id = ? AND consumed_at IS NULL", flow.Id).
		Updates(map[string]interface{}{"payload": string(payload), "user_id": user.Id}).Error
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"authorized": true})
}

type chimeraDeviceTokenRequest struct {
	DeviceCode string `json:"device_code"`
}

// ChimeraDeviceToken 桌面端轮询：pending / ok{access_token} / expired。
// 成功路径消费 flow（一次性）并签发 dashboard 登录会话。
func ChimeraDeviceToken(c *gin.Context) {
	var req chimeraDeviceTokenRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil || strings.TrimSpace(req.DeviceCode) == "" {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	match := model.AuthFlowMatch{Purpose: chimeraDeviceFlowPurpose}
	flow, err := model.GetAuthFlow(req.DeviceCode, match)
	if err != nil {
		common.ApiSuccess(c, gin.H{"status": "expired"})
		return
	}
	var payload chimeraDevicePayload
	if err := json.Unmarshal([]byte(flow.Payload), &payload); err != nil {
		common.ApiSuccess(c, gin.H{"status": "expired"})
		return
	}
	if payload.Status != "authorized" || payload.UserId <= 0 {
		common.ApiSuccess(c, gin.H{"status": "pending"})
		return
	}

	// 先原子消费 flow，再在事务外签发会话：CreateLoginSession 内部使用全局
	// DB 连接，放进消费事务会在 SQLite 上自锁（sqlite error 5）。消费成功但
	// 签发失败的边缘情况下，用户重新发起一次授权即可（flow 一次性语义不变）。
	if _, err := model.ConsumeAuthFlow(req.DeviceCode, match); err != nil {
		common.ApiSuccess(c, gin.H{"status": "expired"})
		return
	}
	bundle, err := service.CreateLoginSession(payload.UserId, "chimera_device", c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		common.SysLog("chimera device login session failed: " + err.Error())
		common.ApiSuccess(c, gin.H{"status": "expired"})
		return
	}
	model.UpdateUserLastLoginAt(payload.UserId)
	common.ApiSuccess(c, gin.H{
		"status":       "ok",
		"access_token": bundle.AccessToken,
		"token_type":   bundle.TokenType,
	})
}
