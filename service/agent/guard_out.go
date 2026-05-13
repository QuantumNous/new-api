package agent

// GuardOut 出口护栏：输出脱敏、工具白名单、审计落库
// 在Agent返回结果前执行，确保输出安全且可追溯
func GuardOut(content string) (string, error) {
	// TODO: 后续实现
	// 1. 脱敏敏感信息（Token key、密码、邮箱等）
	// 2. 记录审计日志
	return content, nil
}
