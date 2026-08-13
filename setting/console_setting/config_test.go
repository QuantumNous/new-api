package console_setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultSafetyAnnouncementIsValid(t *testing.T) {
	require.NoError(t, ValidateConsoleSettings(defaultSafetyAnnouncement, "Announcements"))

	announcements := GetAnnouncements()
	require.Len(t, announcements, 1)
	content, ok := announcements[0]["content"].(string)
	require.True(t, ok)
	assert.Contains(t, content, "“宽审核”“低审核”“Global”")
	assert.Contains(t, content, "AI 生成合成内容")
}
