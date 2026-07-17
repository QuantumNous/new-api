package controller

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCheckReadinessSucceedsWhenDependenciesAreHealthy(t *testing.T) {
	component, err := checkReadiness(
		context.Background(),
		func(context.Context) error { return nil },
		func(context.Context) error { return nil },
	)

	require.NoError(t, err)
	require.Empty(t, component)
}

func TestCheckReadinessReportsDatabaseFailure(t *testing.T) {
	component, err := checkReadiness(
		context.Background(),
		func(context.Context) error { return errors.New("database unavailable") },
		nil,
	)

	require.Error(t, err)
	require.Equal(t, "database", component)
}

func TestCheckReadinessReportsRedisFailure(t *testing.T) {
	component, err := checkReadiness(
		context.Background(),
		func(context.Context) error { return nil },
		func(context.Context) error { return errors.New("redis unavailable") },
	)

	require.Error(t, err)
	require.Equal(t, "redis", component)
}
