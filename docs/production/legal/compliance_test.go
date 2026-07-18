package legal

import (
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUserAgreementDocumentsAIContentSafetyRules(t *testing.T) {
	contentBytes, err := os.ReadFile("user-agreement.md")
	require.NoError(t, err)

	content := strings.ToLower(string(contentBytes))
	requiredTerms := []string{
		"ai content generation and acceptable use",
		"sexual",
		"nsfw",
		"violence",
		"gore",
		"hate speech",
		"child sexual abuse material",
		"csam",
		"deepfake",
		"impersonation",
		"copyright",
		"trademark",
		"moderation",
		"report",
		"support@opwan.ai",
		"suspend",
		"terminate",
	}

	for _, term := range requiredTerms {
		assert.True(t, strings.Contains(content, term), "missing required term %q", term)
	}
}
