package service

// LoadGrokCredentialCipher 从环境变量装载 Grok 凭证 cipher（Task 5 私有工厂的导出包装）。
// 供 controller 层的 Grok 认证编排使用：service 包无法导入
// relay/channel/groksubscription（会形成 service→groksubscription→relay/channel→service
// 的生产导入环，见 groksubscription/adaptor.go 与 relay/channel/api_request.go），
// 因此 PKCE 编排落在 controller，经本入口取 cipher。
// 返回错误已脱敏（不包含 key 内容），调用方按 fail-closed 处理。
func LoadGrokCredentialCipher() (GrokCredentialCipher, error) {
	return loadGrokCredentialCipherFromEnv()
}
