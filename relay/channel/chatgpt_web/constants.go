package chatgpt_web

// ChatGPT 网页逆向渠道（/backend-api/conversation）。
// 设计背景与实测见记忆文件 chatgpt-web-reverse-feasible：
// 用 ChatGPT 订阅账号的 OAuth access_token 模拟网页前端，经 sentinel + PoW 调用 conversation，
// 把网页自有的 v1 delta SSE 转成 OpenAI chat/completions 格式。

const ChannelName = "chatgpt-web"

// defaultUA 取自真实浏览器抓包。ChatGPT 后端对 UA 不强校验，但保持真实更稳，
// 且 PoW config 里也用同一个 UA。
const defaultUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"

// ModelList 是该渠道对外暴露、可路由到此渠道的模型名。
// 注意：网页端 model slug 随 OpenAI 更新频繁变动（2026-02 已下线 gpt-4o 等），
// 强烈推荐用 "auto" 让服务端自动路由；其余为常见别名，实际可用性以账号订阅为准。
var ModelList = []string{
	"auto",
	"gpt-5",
	"gpt-5-thinking",
	"gpt-5-pro",
	"gpt-5-t-mini",
	"gpt-4o",
	"gpt-4-1",
	"o3",
	"o4-mini",
	"chatgpt-4o-latest",
}
