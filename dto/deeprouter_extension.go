package dto

// DeepRouterExtension is the vendor extension embedded in OpenAI-compatible
// requests under the "deeprouter" key (tasks/03 §9).
// Clients send: {"deeprouter": {"skill_id": "<uuid>", "skill_version_id": "<uuid>", "entry_point": "skill_package"}, ...}
// The relay strips this field before forwarding to the provider.
type DeepRouterExtension struct {
	SkillID        string `json:"skill_id,omitempty"`
	SkillVersionID string `json:"skill_version_id,omitempty"`
	EntryPoint     string `json:"entry_point,omitempty"`
}
