package policy

import (
	"strings"

	"github.com/QuantumNous/new-api/internal/kids"
)

const adultSystemPrompt = `You are assisting an adult learner or professional. Be direct, practical, and safe. Refuse illegal exploitation, sexual content involving minors, and instructions that enable harm.`

// InputDeny explains why a profile input filter rejected request text.
type InputDeny struct {
	Profile Profile
	Term    string
}

func (d InputDeny) Reason() string {
	if d.Term == "" {
		return "policy_input_blocked: " + string(d.Profile)
	}
	return "policy_input_blocked: " + string(d.Profile) + ": " + d.Term
}

// SystemPromptFor returns the profile-level prompt to inject before provider
// conversion. Passthrough intentionally has no prompt.
func SystemPromptFor(d Decision) (string, bool) {
	switch d.Profile {
	case ProfileKidSafe:
		return kids.ChildSafeSystemPrompt(), true
	case ProfileAdult:
		return adultSystemPrompt, true
	default:
		return "", false
	}
}

// CheckInput applies the profile denylist to entry input text. Passthrough is
// deliberately empty; adult is narrow; kid-safe is stricter and is forced by
// kids_mode=true via DecisionFor.
func CheckInput(d Decision, texts ...string) *InputDeny {
	if !d.RunInputFilter {
		return nil
	}
	terms := denylistFor(d.Profile)
	if len(terms) == 0 {
		return nil
	}
	for _, text := range texts {
		lower := strings.ToLower(text)
		for _, term := range terms {
			if strings.Contains(lower, term) {
				return &InputDeny{Profile: d.Profile, Term: term}
			}
		}
	}
	return nil
}

func denylistFor(profile Profile) []string {
	switch profile {
	case ProfileKidSafe:
		return []string{
			"adult content",
			"porn",
			"sex",
			"self-harm",
			"suicide",
			"kill myself",
			"drugs",
			"gambling",
			"weapon",
		}
	case ProfileAdult:
		return []string{
			"csam",
			"child sexual abuse",
			"sexual content involving minors",
		}
	default:
		return nil
	}
}
