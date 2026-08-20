package intelligent_routing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"fmt"
)

type RolloutSubject struct {
	AccountID  int
	TokenID    int
	UserGroup  string
	TokenGroup string
}

type RolloutDecision struct {
	Selected      bool
	Bucket        int
	Mode          string
	PolicyVersion int
	Revision      int64
}

func ResolveRollout(snapshot RuntimePolicySnapshot, subject RolloutSubject) RolloutDecision {
	decision := RolloutDecision{
		Mode: snapshot.Rollout.Mode, PolicyVersion: snapshot.Rollout.PolicyVersion, Revision: snapshot.Rollout.Revision,
	}
	if !snapshot.Rollout.Exists || !snapshot.Rollout.Enabled || snapshot.Rollout.TrafficPercent <= 0 {
		return decision
	}
	if !rolloutGroupMatches(snapshot.Rollout.UserGroups, subject.UserGroup) ||
		!rolloutGroupMatches(snapshot.Rollout.TokenGroups, subject.TokenGroup) {
		return decision
	}
	mac := hmac.New(sha256.New, []byte(snapshot.DeploymentSalt))
	_, _ = fmt.Fprintf(mac, "%d/%d/%d", snapshot.Rollout.PolicyVersion, subject.AccountID, subject.TokenID)
	digest := mac.Sum(nil)
	decision.Bucket = int(binary.BigEndian.Uint64(digest[:8]) % 100)
	decision.Selected = decision.Bucket < snapshot.Rollout.TrafficPercent
	return decision
}

func rolloutGroupMatches(allowed []string, actual string) bool {
	if len(allowed) == 0 {
		return true
	}
	for _, candidate := range allowed {
		if candidate == actual {
			return true
		}
	}
	return false
}
