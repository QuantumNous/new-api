package service

import (
	"encoding/base64"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLoadFromBase64SniffsPDFMIME(t *testing.T) {
	t.Parallel()
	encoded := base64.StdEncoding.EncodeToString([]byte("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"))
	cached, err := loadFromBase64(encoded, "")
	require.NoError(t, err)
	t.Cleanup(func() { _ = cached.Close() })
	require.Equal(t, "application/pdf", cached.MimeType)
}
