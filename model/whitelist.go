package model

// GroupAllowsModel 判断某分组（User.Group）是否可使用指定模型。
//
// 原生白名单机制：New API 按「分组」通过 abilities 表控制可用模型——
// 为某 group 启用 ability 的模型即该 group 可用（见 GetGroupEnabledModels）。
// 因此 v1 的「模型白名单」可直接复用分组能力配置，无需新增独立白名单表。
//
// 本函数仅做判定，不触发 DB 写；调用方可据此拒绝未授权模型且不扣费（详见研发任务卡 T4）。
func GroupAllowsModel(group, modelName string) bool {
	if group == "" || modelName == "" {
		return false
	}
	for _, m := range GetGroupEnabledModels(group) {
		if m == modelName {
			return true
		}
	}
	return false
}
