package service

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestExtractCodexOfficialNoticeFindingsMatchesConfiguredModels(t *testing.T) {
	findings := ExtractCodexOfficialNoticeFindings(
		"Codex update: gpt-5.3-codex will be retired. gpt-5.4-codex remains available.",
		[]string{"gpt-5.3-codex", "gpt-5.4-codex"},
		[]string{"retired"},
	)

	require.Len(t, findings, 1)
	require.Equal(t, "gpt-5.3-codex", findings[0].ModelName)
	require.Equal(t, model.CodexModelGovernanceSourceOfficialCodexNotice, findings[0].Source)
	require.Equal(t, "retired", findings[0].MatchedRule)
	require.Contains(t, findings[0].LastError, "gpt-5.3-codex")
}
