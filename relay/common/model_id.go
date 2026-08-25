package common

import "strings"

// ModelIDWithoutPublisher returns the bare model ID, stripping Gemini/Vertex
// publisher prefixes such as "models/", "google/", or "publishers/google/models/".
// Claude→Gemini conversion takes the model from the Claude request body; that
// name is then placed in the generateContent URL. Leaving a publisher prefix in
// the path makes Vertex/Gemini-compatible gateways parse the ID as
// provider/model and reject names like "gemini-3.7-flash".
func ModelIDWithoutPublisher(model string) string {
	name := strings.TrimSpace(model)
	if name == "" {
		return ""
	}
	name = strings.TrimPrefix(name, "models/")
	if strings.HasPrefix(name, "publishers/") {
		if _, rest, found := strings.Cut(name, "/models/"); found {
			name = rest
		}
	}
	if separator := strings.LastIndex(name, "/"); separator >= 0 {
		name = name[separator+1:]
	}
	return name
}
