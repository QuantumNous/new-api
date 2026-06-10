package constant

// SecurityRuleType 规则类型
const (
	SecurityRuleTypeKeyword = iota + 1 // 关键词匹配
	SecurityRuleTypeRegex              // 正则匹配
	SecurityRuleTypeNER                // 命名实体识别
	SecurityRuleTypeAI                 // AI 智能识别
)

// SecurityAction 处理动作
const (
	SecurityActionPass = iota + 1 // 放行
	SecurityActionAlert           // 告警
	SecurityActionMask            // 模糊/脱敏
	SecurityActionBlock           // 拦截
	SecurityActionReview          // 审核
)

// SecurityActionPriority 处理动作优先级（数值越大优先级越高）
const (
	SecurityActionPriorityPass   = 1
	SecurityActionPriorityAlert  = 2
	SecurityActionPriorityMask   = 3
	SecurityActionPriorityBlock  = 4
	SecurityActionPriorityReview = 5
)

// SecurityRiskLevel 风险等级
const (
	SecurityRiskLevelLow = iota + 1 // 低
	SecurityRiskLevelMedium         // 中
	SecurityRiskLevelHigh           // 高
	SecurityRiskLevelCritical       // 严重
)

// SecurityContentType 内容类型
const (
	SecurityContentTypeRequest = iota + 1 // 请求
	SecurityContentTypeResponse           // 响应
)

// SecurityScope 检测生效范围
const (
	SecurityScopeRequestOnly  = 1 // 仅请求
	SecurityScopeResponseOnly = 2 // 仅响应
	SecurityScopeBoth         = 3 // 双向
)

// SecurityStatus 启用状态
const (
	SecurityStatusDisabled = iota // 停用
	SecurityStatusEnabled          // 启用
)

// SecurityDefaultValues 默认值
const (
	SecurityMaxGroupDepth     = 5   // 敏感词分组最大嵌套深度
	SecurityDefaultRiskScore  = 50  // 默认风险分数
	SecurityMaxRiskScore      = 100 // 最大风险分数
	SecurityAITimeoutSeconds  = 3   // AI 检测超时时间（秒）
	SecurityLogRetentionDays  = 30  // 日志保留天数
)

// SecurityGroupDefaultNames 默认分组名称
const (
	SecurityGroupBasic      = "基础安全策略"
	SecurityGroupPrivacy    = "个人隐私信息"
	SecurityGroupCorporate  = "企业机密"
	SecurityGroupCompliance = "合规风险"
	SecurityGroupPrompt     = "Prompt防护"
)

// SecurityEnvKeys 环境变量键名
const (
	SecurityEnvEnabled       = "SECURITY_ENABLED"
	SecurityEnvAITimeout     = "SECURITY_AI_TIMEOUT"
	SecurityEnvKeywordMax    = "SECURITY_KEYWORD_MAX"
	SecurityEnvLogRetention  = "SECURITY_LOG_RETENTION"
)

// GetSecurityActionPriority 获取动作对应的优先级
func GetSecurityActionPriority(action int) int {
	switch action {
	case SecurityActionPass:
		return SecurityActionPriorityPass
	case SecurityActionAlert:
		return SecurityActionPriorityAlert
	case SecurityActionMask:
		return SecurityActionPriorityMask
	case SecurityActionBlock:
		return SecurityActionPriorityBlock
	case SecurityActionReview:
		return SecurityActionPriorityReview
	default:
		return SecurityActionPriorityPass
	}
}

// GetSecurityRiskLevelByScore 根据风险分数获取风险等级
func GetSecurityRiskLevelByScore(score int) int {
	switch {
	case score <= 25:
		return SecurityRiskLevelLow
	case score <= 50:
		return SecurityRiskLevelMedium
	case score <= 75:
		return SecurityRiskLevelHigh
	default:
		return SecurityRiskLevelCritical
	}
}
