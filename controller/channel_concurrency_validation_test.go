package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestValidateChannelRejectsInvalidMaxConcurrency(t *testing.T) {
	require.ErrorContains(t, validateChannel(nil, true), "channel cannot be empty")

	err := validateChannel(&model.Channel{MaxConcurrency: -1}, true)
	require.ErrorContains(t, err, "channel max concurrency cannot be negative")
}
