package blockrunseedance

// ChannelName 是该渠道的内部标识。
const ChannelName = "blockrun-seedance"

// maxAmountAtomicUSDCVideo caps a single video x402 charge to 10 USDC (6 decimals).
// Seedance per-second pricing can exceed the $5 chat cap (e.g. 2.0 @ ~$0.30/s ×10s
// = $3); $10 is a generous ceiling that still refuses an obviously-malicious 402.
const maxAmountAtomicUSDCVideo = 10_000_000

// maxAuthorizationWindowSecondsVideo caps the x402 authorization window for video.
// Unlike chat (settles immediately, 300s cap), the async submit→poll flow settles
// only at the completion poll, so the gateway advertises a longer validBefore
// window — observed 600s in production. 1200s (20 min) accommodates that with
// headroom while keeping the standing-transfer-order window bounded; the $10
// amount cap remains the primary drain protection.
const maxAuthorizationWindowSecondsVideo = 1200

// ModelList 是对客户端暴露的伪模型名（白标，绝不暴露上游 bytedance/blockrun）。
var ModelList = []string{
	"seedance-2.0",
	"seedance-2.0-fast",
	"seedance-1.5-pro",
}

// modelToUpstream maps the whitelabel pseudo model name to the real upstream
// model id sent in the gateway request body. Unknown models are rejected at
// BuildRequestBody (fail fast) so an upstream 4xx never burns a pre-charge.
//
// The wire names (bytedance/seedance-*) map to themselves (identity) so an
// operator-configured model mapping that targets the upstream id directly still
// resolves instead of failing the lookup and burning the request.
var modelToUpstream = map[string]string{
	"seedance-2.0":      "bytedance/seedance-2.0",
	"seedance-2.0-fast": "bytedance/seedance-2.0-fast",
	"seedance-1.5-pro":  "bytedance/seedance-1.5-pro",
	// Identity entries for operator mappings targeting the wire name.
	"bytedance/seedance-2.0":      "bytedance/seedance-2.0",
	"bytedance/seedance-2.0-fast": "bytedance/seedance-2.0-fast",
	"bytedance/seedance-1.5-pro":  "bytedance/seedance-1.5-pro",
}

// upstreamModel resolves the whitelabel pseudo name to the upstream model id.
func upstreamModel(name string) (string, bool) {
	m, ok := modelToUpstream[name]
	return m, ok
}

// supportsRealFaceAsset reports whether the upstream model accepts a
// real_face_asset_id (Seedance 2.0 / 2.0-fast only, per BlockRun docs). Accepts
// both the whitelabel pseudo names and the wire names so an operator mapping
// that targets the upstream id keeps the asset capability.
func supportsRealFaceAsset(model string) bool {
	switch model {
	case "seedance-2.0", "seedance-2.0-fast",
		"bytedance/seedance-2.0", "bytedance/seedance-2.0-fast":
		return true
	default:
		return false
	}
}

// supportsOmniReference reports whether the upstream model accepts
// reference_image_urls (omni reference generation). The vip SDK documents the
// field as Seedance 2.0 only; gate it like real_face so an upstream 4xx never
// reaches the pre-charge. Accepts pseudo and wire names (see above).
func supportsOmniReference(model string) bool {
	switch model {
	case "seedance-2.0", "seedance-2.0-fast",
		"bytedance/seedance-2.0", "bytedance/seedance-2.0-fast":
		return true
	default:
		return false
	}
}
