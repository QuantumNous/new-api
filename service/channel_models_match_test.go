package service

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestChannelsModelsCommaMatchSQLRejectsSubstringCollision(t *testing.T) {
	clause, args := ChannelsModelsCommaMatchSQL("c.models", []string{"gpt-image-2"})
	require.Contains(t, clause, "c.models = ?")
	require.NotContains(t, clause, "LIKE '%gpt-image-2%'")
	require.Equal(t, []interface{}{
		"gpt-image-2", "gpt-image-2,%", "%,gpt-image-2", "%,gpt-image-2,%",
	}, args)
}

func TestChannelsModelsCommaMatchSQLAcceptsCommaSeparatedToken(t *testing.T) {
	clause, args := ChannelsModelsCommaMatchSQL(`c."models"`, []string{"gpt-image-2-official", "gpt-image-2"})
	require.Equal(t, 8, len(args))
	require.Contains(t, clause, `c."models" LIKE ?`)
	// middle-of-list pattern for gpt-image-2
	require.Contains(t, args, "%,gpt-image-2,%")
}

func TestChannelsModelsCommaMatchSQLEmptyCandidates(t *testing.T) {
	clause, args := ChannelsModelsCommaMatchSQL("c.models", nil)
	require.Equal(t, "1=0", clause)
	require.Nil(t, args)
}
