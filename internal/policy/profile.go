// Package policy reads the tenant's PolicyProfile and KidsMode flags
// (set on User in model/user.go) and exposes a single PolicyDecision
// that downstream relay code can consult.
//
// Wiring into the existing relay path is intentionally deferred:
// this package compiles as a leaf, ready to be invoked from
// controller/relay.go in a follow-up commit.
package policy

// Profile identifies which behavioural profile a tenant is on.
type Profile string

const (
	// ProfilePassthrough — no system prompt injection, no metadata strip.
	// Provider's own safety only. Default for new tenants.
	ProfilePassthrough Profile = "passthrough"
	// ProfileAdult — light filtering + a soft adult-learner system prompt.
	ProfileAdult Profile = "adult"
	// ProfileKidSafe — strict input/output filtering + system prompt injection.
	// Combined with KidsMode=true triggers the hard constraints in internal/kids.
	ProfileKidSafe Profile = "kid-safe"
)

// Decision is the per-request policy outcome the relay code consults.
type Decision struct {
	// KidsMode means the tenant has User.KidsMode=true; hard constraints below
	// must be applied unconditionally.
	KidsMode bool
	// Profile is the tenant's PolicyProfile field, normalised.
	Profile Profile
	// EnforceModelWhitelist requires kids.IsModelEligible(model) == true.
	EnforceModelWhitelist bool
	// EnforceZDR forces `store: false` for OpenAI-family providers.
	EnforceZDR bool
	// InjectSystemPrompt prepends the profile-level system prompt to messages.
	InjectSystemPrompt bool
	// StripIdentifying removes user_id / family_id / etc. before upstream send.
	StripIdentifying bool
	// RunInputFilter checks entry input text against the profile denylist.
	RunInputFilter bool
}

// DecisionFor returns the Decision implied by a tenant's KidsMode + PolicyProfile.
// KidsMode=true OVERRIDES Profile: all hard constraints are forced on.
func DecisionFor(kidsMode bool, rawProfile string) Decision {
	p := normalise(rawProfile)
	if kidsMode {
		return Decision{
			KidsMode:              true,
			Profile:               ProfileKidSafe,
			EnforceModelWhitelist: true,
			EnforceZDR:            true,
			InjectSystemPrompt:    true,
			StripIdentifying:      true,
			RunInputFilter:        true,
		}
	}
	switch p {
	case ProfileKidSafe:
		return Decision{
			Profile:               ProfileKidSafe,
			EnforceModelWhitelist: true,
			EnforceZDR:            true,
			InjectSystemPrompt:    true,
			StripIdentifying:      true,
			RunInputFilter:        true,
		}
	case ProfileAdult:
		return Decision{Profile: ProfileAdult, InjectSystemPrompt: true, RunInputFilter: true}
	default:
		return Decision{Profile: ProfilePassthrough}
	}
}

func normalise(s string) Profile {
	switch Profile(s) {
	case ProfileKidSafe, ProfileAdult, ProfilePassthrough:
		return Profile(s)
	default:
		return ProfilePassthrough
	}
}
