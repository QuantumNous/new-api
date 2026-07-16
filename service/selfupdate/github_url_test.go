package selfupdate

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateDownloadURL(t *testing.T) {
	require.NoError(t, ValidateDownloadURL("https://github.com/ChinaToyHunter/new-api/releases/download/v1/x"))
	require.NoError(t, ValidateDownloadURL("https://objects.githubusercontent.com/github-production-release-asset-2e65be/x"))
	require.Error(t, ValidateDownloadURL("http://github.com/x")) // not https
	require.Error(t, ValidateDownloadURL("https://evil.example/x"))
}
