package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
)

func TestShouldRunDatabaseMigration(t *testing.T) {
	testCases := []struct {
		name               string
		isMasterNode       bool
		skipMigrationValue string
		want               bool
	}{
		{
			name:         "master defaults to migration enabled",
			isMasterNode: true,
			want:         true,
		},
		{
			name:               "master explicit false keeps migration enabled",
			isMasterNode:       true,
			skipMigrationValue: "false",
			want:               true,
		},
		{
			name:               "master exact true skips migration",
			isMasterNode:       true,
			skipMigrationValue: "true",
			want:               false,
		},
		{
			name:               "master non-exact true does not skip migration",
			isMasterNode:       true,
			skipMigrationValue: "TRUE",
			want:               true,
		},
		{
			name:         "slave skips migration by default",
			isMasterNode: false,
			want:         false,
		},
		{
			name:               "slave still skips with flag enabled",
			isMasterNode:       false,
			skipMigrationValue: "true",
			want:               false,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			assert.Equal(
				t,
				testCase.want,
				shouldRunDatabaseMigration(testCase.isMasterNode, testCase.skipMigrationValue),
			)
		})
	}
}

func TestShouldRunDatabaseMigrationForCurrentNodePreservesMasterRole(t *testing.T) {
	originalMasterNode := common.IsMasterNode
	t.Cleanup(func() {
		common.IsMasterNode = originalMasterNode
	})

	common.IsMasterNode = true
	t.Setenv(skipDatabaseMigrationEnv, "true")

	assert.False(t, shouldRunDatabaseMigrationForCurrentNode())
	assert.True(t, common.IsMasterNode)
}
