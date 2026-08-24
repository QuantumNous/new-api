package model

import (
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm/schema"
)

func TestChannelGroupColumnSupportsMultipleGroups(t *testing.T) {
	channelSchema, err := schema.Parse(&Channel{}, &sync.Map{}, schema.NamingStrategy{})
	require.NoError(t, err)

	groupField := channelSchema.LookUpField("Group")
	require.NotNil(t, groupField)
	require.Equal(t, "varchar(255)", groupField.TagSettings["TYPE"])
}
