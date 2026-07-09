package model

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm/clause"
)

func TestPerfMetricUpsertAssignmentsQualifyColumns(t *testing.T) {
	assignments := perfMetricUpsertAssignments(&PerfMetric{RequestCount: 1})
	for column, value := range assignments {
		expr, ok := value.(clause.Expr)
		require.True(t, ok, "assignment %s should be a clause.Expr", column)
		require.Contains(t, expr.SQL, "perf_metrics."+column)
	}
}
