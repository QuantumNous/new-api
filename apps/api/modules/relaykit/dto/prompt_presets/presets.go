// Package promptpresets embeds built-in system prompt presets that channels
// can select by name. The prompt content ships inside the binary so operators
// pick a preset from a dropdown instead of pasting 50KB of text into a textarea.
package promptpresets

import _ "embed"

//go:embed silly_tavern.txt
var sillyTavernPrompt string

//go:embed tavern_card.txt
var tavernCardPrompt string

// Preset names matching the frontend dropdown values.
const (
	PresetSillyTavern = "silly_tavern"
	PresetTavernCard  = "tavern_card"
)

// presets maps a preset name to its prompt content.
var presets = map[string]string{
	PresetSillyTavern: sillyTavernPrompt,
	PresetTavernCard:  tavernCardPrompt,
}

// Get returns the built-in prompt for the given preset name.
// An empty name or unknown preset returns "".
func Get(name string) string {
	if name == "" {
		return ""
	}
	return presets[name]
}

// IsValid reports whether name is a known preset.
func IsValid(name string) bool {
	_, ok := presets[name]
	return ok
}
