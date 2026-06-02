package service

import "strings"

// ChannelsModelsCommaMatchSQL builds a WHERE fragment for comma-separated channels.models.
// Each candidate must appear as a full token (= / starts-with / ends-with / middle),
// not as a substring of another model id (e.g. gpt-image-2 must not match gpt-image-2-official).
func ChannelsModelsCommaMatchSQL(modelsCol string, candidates []string) (clause string, args []interface{}) {
	if len(candidates) == 0 {
		return "1=0", nil
	}
	parts := make([]string, 0, len(candidates)*4)
	args = make([]interface{}, 0, len(candidates)*4)
	for _, m := range candidates {
		if m == "" {
			continue
		}
		parts = append(parts,
			modelsCol+" = ?",
			modelsCol+" LIKE ?",
			modelsCol+" LIKE ?",
			modelsCol+" LIKE ?",
		)
		args = append(args, m, m+",%", "%,"+m, "%,"+m+",%")
	}
	if len(parts) == 0 {
		return "1=0", nil
	}
	return "(" + strings.Join(parts, " OR ") + ")", args
}
