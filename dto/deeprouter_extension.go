package dto

// DeepRouterExtension is the vendor extension embedded in OpenAI-compatible
// requests under the "deeprouter" key (tasks/03 §9).
// Clients send: {"deeprouter": {"skill_id": "<uuid>"}, ...}
// The relay strips this field before forwarding to the provider (security T-21).
type DeepRouterExtension struct {
	SkillID string `json:"skill_id,omitempty"`
}
