package controller

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

type tokenExportResponse struct {
	Tool          string   `json:"tool"`
	DisplayName   string   `json:"display_name"`
	EnvScript     string   `json:"env_script"`
	ConfigFile    string   `json:"config_file"`
	ConfigContent string   `json:"config_content"`
	TestCommand   string   `json:"test_command"`
	Notes         []string `json:"notes"`
}

func ExportTokenConfig(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	userId := c.GetInt("id")
	if err != nil {
		common.ApiError(c, err)
		return
	}

	token, err := model.GetTokenByIds(id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	baseURL := getTokenExportBaseURL(c)
	tool := strings.TrimSpace(strings.ToLower(c.Query("tool")))
	if tool == "" {
		common.ApiErrorMsg(c, "tool 参数不能为空")
		return
	}

	payload, err := buildTokenExportResponse(tool, baseURL, token.GetFullKey())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, payload)
}

func getTokenExportBaseURL(c *gin.Context) string {
	serverAddress := strings.TrimSpace(system_setting.ServerAddress)
	if serverAddress != "" {
		return strings.TrimRight(serverAddress, "/")
	}

	scheme := "http"
	if c.Request != nil && c.Request.TLS != nil {
		scheme = "https"
	}
	if forwardedProto := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); forwardedProto != "" {
		scheme = strings.ToLower(strings.Split(forwardedProto, ",")[0])
	}

	host := ""
	if c.Request != nil {
		host = strings.TrimSpace(c.Request.Host)
	}
	if forwardedHost := strings.TrimSpace(c.GetHeader("X-Forwarded-Host")); forwardedHost != "" {
		host = strings.TrimSpace(strings.Split(forwardedHost, ",")[0])
	}
	if host == "" {
		return ""
	}
	return fmt.Sprintf("%s://%s", scheme, host)
}

func buildTokenExportResponse(tool string, baseURL string, tokenKey string) (*tokenExportResponse, error) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if baseURL == "" {
		return nil, fmt.Errorf("无法确定服务地址，请先配置 server_address")
	}
	openAIBaseURL := joinURL(baseURL, "/v1")
	anthropicBaseURL := joinURL(baseURL, "/anthropic")
	quotedToken := shellQuote(tokenKey)

	switch tool {
	case "codex":
		return &tokenExportResponse{
			Tool:        "codex",
			DisplayName: "Codex",
			EnvScript: fmt.Sprintf(
				"export OPENAI_BASE_URL=%s\nexport OPENAI_API_KEY=%s",
				shellQuote(openAIBaseURL),
				quotedToken,
			),
			ConfigFile: ".codex/config.toml",
			ConfigContent: fmt.Sprintf(
				"model_provider = \"openai\"\nmodel = \"gpt-4.1\"\n\n[model_providers.openai]\nname = \"OpenAI Compatible\"\nbase_url = \"%s\"\nenv_key = \"OPENAI_API_KEY\"\n",
				openAIBaseURL,
			),
			TestCommand: fmt.Sprintf(
				"curl %s -H \"Authorization: Bearer %s\"",
				shellQuote(joinURL(openAIBaseURL, "/models")),
				tokenKey,
			),
			Notes: []string{
				"将环境变量复制到终端后即可让 Codex CLI 通过当前站点访问模型。",
				"如果使用配置文件方式，请把 OPENAI_API_KEY 保留在环境变量中。",
			},
		}, nil
	case "claude_code":
		return &tokenExportResponse{
			Tool:        "claude_code",
			DisplayName: "Claude Code",
			EnvScript: fmt.Sprintf(
				"export ANTHROPIC_BASE_URL=%s\nexport ANTHROPIC_AUTH_TOKEN=%s",
				shellQuote(anthropicBaseURL),
				quotedToken,
			),
			ConfigFile: ".claude/settings.json",
			ConfigContent: fmt.Sprintf(
				"{\n  \"env\": {\n    \"ANTHROPIC_BASE_URL\": \"%s\",\n    \"ANTHROPIC_AUTH_TOKEN\": \"%s\"\n  }\n}\n",
				anthropicBaseURL,
				tokenKey,
			),
			TestCommand: fmt.Sprintf(
				"curl %s -H \"Authorization: Bearer %s\" -H \"Content-Type: application/json\" -d '{\"model\":\"claude-3-5-sonnet-20241022\",\"max_tokens\":16,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}'",
				shellQuote(joinURL(anthropicBaseURL, "/v1/messages")),
				tokenKey,
			),
			Notes: []string{
				"Claude Code 通过 Anthropic 兼容网关访问时，需要使用 ANTHROPIC_BASE_URL 和认证令牌。",
				"如果你的本地环境已有同名变量，请先确认是否会覆盖现有配置。",
			},
		}, nil
	default:
		return nil, fmt.Errorf("不支持的导出工具: %s", tool)
	}
}

func joinURL(baseURL string, path string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	path = strings.TrimSpace(path)
	if path == "" {
		return baseURL
	}
	if baseURL == "" {
		return path
	}
	return baseURL + "/" + strings.TrimLeft(path, "/")
}

func shellQuote(value string) string {
	return strconv.Quote(value)
}
