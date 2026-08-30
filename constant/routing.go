package constant

// 令牌级路由策略（Token.RoutingPriority），对应 openLUX 的「智能路由 vs 指定分组」二选一：
//
//   - 空字符串（默认）：手动路由。令牌按 group 指定的单一分组，或（group=auto 时）按
//     AutoGroups 指定的分组优先级列表顺序路由 —— 即「指定分组」。
//   - auto/price/speed/success_rate：智能路由。系统忽略令牌指定分组，在所有用户可用分组中
//     按策略自动排序并选择最优渠道。
const (
	RoutingPriorityNone        = ""           // 手动：指定分组（单一分组 / 分组优先级列表）
	RoutingPriorityAuto        = "auto"       // 智能路由：综合价格、速度、成功率自动排序
	RoutingPriorityPrice       = "price"      // 智能路由：价格优先，选成本更低渠道
	RoutingPrioritySpeed       = "speed"      // 智能路由：速度优先，选响应更快渠道
	RoutingPrioritySuccessRate = "success_rate" // 智能路由：成功率优先，选近期更稳定渠道
)

// ValidRoutingPriority 校验路由策略取值。
func ValidRoutingPriority(priority string) bool {
	switch priority {
	case RoutingPriorityNone, RoutingPriorityAuto, RoutingPriorityPrice,
		RoutingPrioritySpeed, RoutingPrioritySuccessRate:
		return true
	}
	return false
}
