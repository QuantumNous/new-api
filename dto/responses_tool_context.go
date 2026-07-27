package dto

// Codex custom-tool kinds.
const (
	CodexToolKindRaw        = "raw"
	CodexToolKindApplyPatch = "apply_patch"
	CodexToolKindBuiltIn    = "builtin"
)

// apply_patch proxy sub-tool actions (suffixes on the fanned-out function tools).
const (
	CodexPatchActionAddFile     = "add_file"
	CodexPatchActionDeleteFile  = "delete_file"
	CodexPatchActionUpdateFile  = "update_file"
	CodexPatchActionReplaceFile = "replace_file"
	CodexPatchActionBatch       = "batch"
)

// CodexCustomToolSpec describes how an upstream (chat) tool name maps back to the
// original Responses custom tool.
type CodexCustomToolSpec struct {
	OpenAIName  string // original custom tool name (e.g. "apply_patch")
	Kind        string // CodexToolKindRaw | ApplyPatch | BuiltIn
	ProxyAction string // "" for non-fanned tools, else a CodexPatchAction* suffix
}

// CodexFunctionToolSpec describes how a flattened function tool name maps back to
// its original (namespaced) name.
type CodexFunctionToolSpec struct {
	Namespace string
	Name      string
}

// ResponsesToolContext carries the request-side tool taxonomy so the response
// side can map upstream (chat) tool-call names back to the original Responses
// tool shapes (function_call vs custom_tool_call, namespace un-flattening,
// apply_patch reconstruction). It is built from the Responses request `tools`.
type ResponsesToolContext struct {
	CustomTools       map[string]CodexCustomToolSpec
	FunctionTools     map[string]CodexFunctionToolSpec
	HasCustomTools    bool
	HasNamespaceTools bool
	// OriginalRequest is retained only for the responses-via-chat response
	// conversion so response metadata can mirror the originating request.
	OriginalRequest *OpenAIResponsesRequest
}

func NewResponsesToolContext() *ResponsesToolContext {
	return &ResponsesToolContext{
		CustomTools:   make(map[string]CodexCustomToolSpec),
		FunctionTools: make(map[string]CodexFunctionToolSpec),
	}
}

// IsCustomToolProxy reports whether name is a custom/proxy tool (apply_patch
// sub-tool, raw freeform, or built-in) rather than a plain function tool.
func (c *ResponsesToolContext) IsCustomToolProxy(name string) bool {
	if c == nil {
		return false
	}
	_, ok := c.CustomTools[name]
	return ok
}

// OriginalCustomToolName collapses a proxy sub-tool name back to the original
// custom tool name (e.g. "apply_patch_add_file" -> "apply_patch").
func (c *ResponsesToolContext) OriginalCustomToolName(name string) string {
	if c != nil {
		if spec, ok := c.CustomTools[name]; ok && spec.OpenAIName != "" {
			return spec.OpenAIName
		}
	}
	return name
}

func (c *ResponsesToolContext) LookupCustomTool(name string) (CodexCustomToolSpec, bool) {
	if c == nil {
		return CodexCustomToolSpec{}, false
	}
	spec, ok := c.CustomTools[name]
	return spec, ok
}

// OpenAINameForFunctionTool un-flattens a function tool name, returning
// (displayName, namespace).
func (c *ResponsesToolContext) OpenAINameForFunctionTool(name string) (string, string) {
	if c != nil {
		if spec, ok := c.FunctionTools[name]; ok {
			display := spec.Name
			if display == "" {
				display = name
			}
			return display, spec.Namespace
		}
	}
	return name, ""
}
