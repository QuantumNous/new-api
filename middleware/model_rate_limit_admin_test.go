package middleware

import "testing"

// resolveAdminTier 是管理员档分流的纯决策函数（不依赖 DB / context / 全局配置），
// 覆盖用户的三种诉求：跟随用户、管理员豁免（档=0）、管理员自定义档。
func TestResolveAdminTier(t *testing.T) {
	tests := []struct {
		name         string
		followUser   bool
		isAdmin      bool
		adminTotal   int
		adminSuccess int
		wantAdmin    bool
		wantTotal    int
		wantSuccess  int
	}{
		{
			name:       "跟随开启-管理员-仍走用户档",
			followUser: true, isAdmin: true, adminTotal: 20, adminSuccess: 20,
			wantAdmin: false,
		},
		{
			name:       "跟随开启-普通用户-走用户档",
			followUser: true, isAdmin: false, adminTotal: 20, adminSuccess: 20,
			wantAdmin: false,
		},
		{
			name:       "跟随关闭-普通用户-走用户档（不受管理员档影响）",
			followUser: false, isAdmin: false, adminTotal: 20, adminSuccess: 20,
			wantAdmin: false,
		},
		{
			name:       "跟随关闭-管理员-自定义档20/20",
			followUser: false, isAdmin: true, adminTotal: 20, adminSuccess: 20,
			wantAdmin: true, wantTotal: 20, wantSuccess: 20,
		},
		{
			name:       "跟随关闭-管理员-档为0即豁免",
			followUser: false, isAdmin: true, adminTotal: 0, adminSuccess: 0,
			wantAdmin: true, wantTotal: 0, wantSuccess: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := resolveAdminTier(tt.followUser, tt.isAdmin, tt.adminTotal, tt.adminSuccess)
			if got.isAdminTier != tt.wantAdmin {
				t.Fatalf("isAdminTier=%v want %v", got.isAdminTier, tt.wantAdmin)
			}
			if tt.wantAdmin && (got.totalMaxCount != tt.wantTotal || got.successMaxCount != tt.wantSuccess) {
				t.Fatalf("admin tier=(%d,%d) want (%d,%d)", got.totalMaxCount, got.successMaxCount, tt.wantTotal, tt.wantSuccess)
			}
		})
	}
}
