package blockrunseedance

// ChannelName 是该渠道的内部标识。
const ChannelName = "blockrun-seedance"

// maxAmountAtomicUSDCVideo caps a single video x402 charge to 10 USDC (6 decimals).
// Seedance per-second pricing can exceed the $1 chat cap (e.g. 2.0 @ ~$0.30/s ×10s
// = $3); $10 is a generous ceiling that still refuses an obviously-malicious 402.
const maxAmountAtomicUSDCVideo = 10_000_000

// ModelList 是对客户端暴露的伪模型名（白标，绝不暴露上游 bytedance/blockrun）。
var ModelList = []string{
	"seedance-2.0",
	"seedance-2.0-fast",
	"seedance-1.5-pro",
}

// modelToUpstream maps the whitelabel pseudo model name to the real upstream
// model id sent in the gateway request body. Unknown models are rejected at
// BuildRequestBody (fail fast) so an upstream 4xx never burns a pre-charge.
var modelToUpstream = map[string]string{
	"seedance-2.0":      "bytedance/seedance-2.0",
	"seedance-2.0-fast": "bytedance/seedance-2.0-fast",
	"seedance-1.5-pro":  "bytedance/seedance-1.5-pro",
}

// upstreamModel resolves the whitelabel pseudo name to the upstream model id.
func upstreamModel(name string) (string, bool) {
	m, ok := modelToUpstream[name]
	return m, ok
}

// supportsRealFaceAsset reports whether the upstream model accepts a
// real_face_asset_id (Seedance 2.0 / 2.0-fast only, per BlockRun docs).
func supportsRealFaceAsset(pseudoModel string) bool {
	return pseudoModel == "seedance-2.0" || pseudoModel == "seedance-2.0-fast"
}
