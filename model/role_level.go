package model

// v1 治理三角色层级（对应 User.RoleLevel 字段）。
// 与 New API 原生 common.Role（admin/common 的 1/10/100）语义独立、共存：
// 原生 Role 控制「是否管理员」，本 RoleLevel 控制「治理域角色（超管/部门管理员/普通用户）」。
// 部门管理员在原生 Role 上通常仍是普通用户（common），仅通过 RoleLevel 获得治理权限，
// 并由 Department 字段限制其仅可操作本部门数据（详见研发任务卡 T3）。
const (
	RoleLevelUser       = 0   // 普通用户：可提交额度申请
	RoleLevelDeptAdmin  = 10  // 部门管理员：可审批本部门申请、查看本部门数据
	RoleLevelSuperAdmin = 100 // 超级管理员：全部治理权限（含角色/部门变更）
)
