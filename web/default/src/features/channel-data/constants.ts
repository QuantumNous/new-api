import tabs from './model-tabs.json'

export type ModelTab = {
  label: string
  modelId: string
  accent: string
}

// 渠道数据页模型 tab 的单一来源是 ./model-tabs.json（顺序即展示顺序）：
// 前端在此 re-export；后端 main.go go:embed 同一文件并随 catalog-export 的
// model_tabs 字段下发给下游（Roma 副本据此渲染 tab）。
// 新增/调整模型 tab 只改 model-tabs.json 一处。
export const MODEL_TABS: ModelTab[] = tabs.map((t) => ({
  modelId: t.model_id,
  label: t.label,
  accent: t.accent,
}))
