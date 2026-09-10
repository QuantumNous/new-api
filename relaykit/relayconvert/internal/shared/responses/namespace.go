// Package responses holds conversion rules shared by the OpenAI Responses
// request and response converters.
package responses

import "strings"

// namespaceSeparator joins a namespace to its member when a Responses
// "namespace" tool group is flattened into individual chat completions
// functions. Chat completions has no grouping of its own, but the Responses
// function_call item carries the namespace in a dedicated field, so the flat
// name has to be splittable again on the way back to the client.
const namespaceSeparator = "__"

// JoinNamespacedTool builds the flat chat completions function name for a
// namespace member. An empty namespace leaves the name untouched.
func JoinNamespacedTool(namespace string, name string) string {
	if namespace == "" {
		return name
	}
	return namespace + namespaceSeparator + name
}

// SplitNamespacedTool reverses JoinNamespacedTool. Either half can itself
// contain the separator, so the last occurrence wins: nested namespace names
// such as "mcp__zai_vision" are common, member names containing "__" are not.
func SplitNamespacedTool(fullName string) (namespace string, name string) {
	if index := strings.LastIndex(fullName, namespaceSeparator); index > 0 {
		return fullName[:index], fullName[index+len(namespaceSeparator):]
	}
	return "", fullName
}
