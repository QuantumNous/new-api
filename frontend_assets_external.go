//go:build frontend_external

package main

import "github.com/QuantumNous/new-api/router"

// prepareFrontendAssets 为纯后端构建返回空资源，运行时必须选择 disabled 或 redirect 模式。
func prepareFrontendAssets() router.ThemeAssets {
	return router.ThemeAssets{}
}
