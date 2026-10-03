# ZCode StartPlan 授权

在渠道的 StartPlan 授权弹窗选择「Z.ai 国际」或「智谱 BigModel 国内」，再开始登录；默认国际站。授权过程中不能切换账号来源，失败后可重试或返回选择。

`POST /api/channel/:id/zcode/start_plan/auth/init` 接受 `{"provider":"zai"}` 或 `{"provider":"bigmodel"}`；省略请求体或 provider 时保持国际站行为。轮询接口沿用会话中绑定的 provider，不接受查询参数覆盖。

授权成功后只将返回的 ZCode JWT 写入渠道密钥，不使用家族业务 access token。两个来源共用 `zcode-start-plan` 模型和余额端点。JWT 到期后重新授权。

授权成功不代表模型请求通过风控；上游 `3012` 拒绝需独立排查。
