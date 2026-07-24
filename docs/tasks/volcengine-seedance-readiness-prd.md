# PRD — 火山引擎 / Seedance 可用性补齐 (volcengine-seedance-readiness)

**Status**: ship
**Owner**: Claude (background job, 2026-07-24)
**Refs**: `docs/PRD.md`(网关产品 PRD), `docs/pricing-catalog-2026h1-prd.md`(定价目录)

## 1. 背景

运营方拿到了火山方舟(Volcano Ark)的 API Key,希望在 DeepRouter 上开通火山引擎
渠道并使用 Seedance 系列视频生成模型。

代码层面支持**已经存在**,无需新增适配器:

- 聊天/图像:`relay/channel/volcengine/`,渠道类型 `ChannelTypeVolcEngine = 45`,
  Base URL `https://ark.cn-beijing.volces.com`。
- 视频任务:`relay/channel/task/doubao/`,渠道类型 `ChannelTypeDoubaoVideo = 54`
  (类型 45 的渠道同样会把视频任务路由到该适配器,见 `relay/relay_adaptor.go`)。
  提交 `POST /v1/video/generations` → 上游 `POST /api/v3/contents/generations/tasks`
  → 轮询 → 按 usage tokens 结算;Seedance 2.0 有视频输入折扣(`videoInputRatioMap`)。
- 前端渠道下拉已包含 45/54 两个类型。

## 2. 问题(本任务要修的缺口)

1. **定价缺口(会直接 503/价格未配置)**:`relay/channel/task/doubao/constants.go`
   的 `ModelList` 有 6 个 Seedance 模型,但 `defaultModelRatio` 只配了
   `doubao-seedance-2-0-260128` 一个带日期后缀的名字。其余 4 个
   (`doubao-seedance-1-0-pro-250528`、`doubao-seedance-1-0-lite-t2v`、
   `doubao-seedance-1-0-lite-i2v`、`doubao-seedance-1-5-pro-251215`)和
   `doubao-seedance-2-0-fast-260128` 既无按次价格也无倍率 →
   `ModelPriceHelperPerCall` 走到 `GetModelRatio` 失败,非 self-use 模式下请求被
   拒("价格未配置")。
2. **种子配置缺口**:`scripts/seed-models/channels.yaml` 只有旧的豆包聊天渠道
   (type 45,doubao-pro/lite 旧模型名),没有 Seedance 视频渠道(type 54),
   运营方跑 `seed.py` 后仍然选不到 Seedance。
3. **回归保护缺失**:没有测试保证 doubao 视频 `ModelList` 里的模型都有默认定价
   (与 `ratio_consistency_test.go` 防的是同一类 bug)。

## 3. 方案

1. `setting/ratio_setting/model_ratio.go`:为上述 5 个模型名补默认倍率。
   取值与既有家族锚点保持一致(`doubao-seedance-2-0-260128 = 0.15` 对应官方
   ¥46/百万 tokens 的纯生成价),按官方单价等比折算:
   | 模型 | 官方价(¥/M tokens) | 倍率 |
   |---|---|---|
   | doubao-seedance-1-0-pro-250528 | 15(0.015 元/千 tokens) | 0.05 |
   | doubao-seedance-1-0-lite-t2v / -i2v | 10 | 0.035 |
   | doubao-seedance-1-5-pro-251215 | ~25(官方未单列,介于 1.0-pro 与 2.0 之间,估) | 0.08 |
   | doubao-seedance-2-0-fast-260128 | 37(纯生成) | 0.10(对齐 `doubao-seedance-2.0-fast`) |
   这些是 bootstrap 默认值(同文件注释),管理员可在后台覆盖。
2. `scripts/seed-models/channels.yaml`:新增 `火山引擎 Seedance 视频` 渠道
   (type 54,`key_env: VOLCENGINE_API_KEY`,6 个 Seedance 模型)。
3. `relay/channel/task/doubao/constants_test.go`:新增
   `TestDoubaoVideoModelListHasPricing` — `ModelList` 中每个模型必须能解析出
   倍率或按次价格;并接入 `unit-test.yml` + `airbotix-internal.yml` 两个门
   (rules/unit-tests.md 的双门同步要求)。

## 4. 不做什么

- 不改 2.0 家族既有倍率锚点(0.15/0.10)——重定价属于
  `pricing-catalog-2026h1-prd.md` 的范畴。
- 不动 `relay/channel/volcengine/` 聊天模型列表与适配器逻辑。
- 不在任何文件中写入真实 API Key(Rule 9);Key 走管理后台或 `seed.py` 的
  `.env`(`VOLCENGINE_API_KEY`)。

## 5. 验收

- `go test ./relay/channel/task/doubao/` 绿;新测试在两个 CI 工作流中执行。
- 配好 type 54 渠道后,`POST /v1/video/generations`(model=doubao-seedance-*)
  不再报"价格未配置"。

## 6. 结果(2026-07-24)

- PR #153 双 CI 门(unit-test + airbotix-internal)通过,squash 合并至 main;
  合并触发 `deploy.yml` 自动生产部署。
- 本地 e2e 验证(SQLite 网关 + type 54 渠道 + 假上游 key,self-use 模式关闭):
  6 个 Seedance 模型全部通过定价解析并真实到达方舟
  (`AuthenticationError`,带 Ark request id),提交失败后预扣费正确退回。
- 真实 key 打通留待运营方在管理后台配置渠道 Key 后复验
  (或 `seed.py` + `VOLCENGINE_API_KEY`)。
