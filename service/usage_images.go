package service

import (
	"crypto/sha256"
	"encoding/hex"

	"github.com/QuantumNous/new-api/dto"
)

// ImageHashes returns one hash per distinct image in the request, in first-seen
// order. Hashing the payload rather than counting parts means a re-sent image
// costs the user nothing: an agentic document loop re-sends the same picture on
// every turn, and a retried request hashes identically to its first attempt.
func ImageHashes(messages []dto.Message) []string {
	seen := make(map[string]struct{})
	hashes := make([]string, 0)
	for i := range messages {
		for _, part := range messages[i].ParseContent() {
			if part.Type != dto.ContentTypeImageURL {
				continue
			}
			img := part.GetImageMedia()
			if img == nil || img.Url == "" {
				continue
			}
			sum := sha256.Sum256([]byte(img.Url))
			h := hex.EncodeToString(sum[:])
			if _, dup := seen[h]; dup {
				continue
			}
			seen[h] = struct{}{}
			hashes = append(hashes, h)
		}
	}
	return hashes
}
