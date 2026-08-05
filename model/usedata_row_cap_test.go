package model

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The production overload cap is an immutable constant. These tests reach the
// cap and cap+1 boundary through the rowLimit parameter of the unexported query
// helper, so no shared state is mutated and small limits used by different
// tests (or different goroutines) cannot interfere with each other.

func TestQuotaDataRowCapIsAnImmutableConstant(t *testing.T) {
	// A compile-time constant is addressable only as a value; if this ever
	// becomes a variable the assignment-free guarantee below is void.
	const capValue = maxQuotaDataRows
	assert.Equal(t, 200000, capValue)
	// The user-facing message must quote the real constant, not a stale copy.
	assert.Contains(t, ErrQuotaDataTooManyRows.Error(), fmt.Sprintf("%d", maxQuotaDataRows))
	assert.Contains(t, ErrQuotaDataTooManyRows.Error(), "200000")
}

// Every exported reader must run with the production constant, never a
// test-lowered limit.
func TestExportedQuotaReadersUseTheProductionCap(t *testing.T) {
	truncateQuotaData(t)

	start := analysisCstMidnight
	end := start + 4*3600
	for i := 0; i < 4; i++ {
		require.NoError(t, DB.Table("quota_data").Create(&QuotaData{
			UserID: 1, Username: "prod", ModelName: fmt.Sprintf("model-%d", i),
			CreatedAt: start + int64(i)*3600, Count: 1, Quota: 1,
		}).Error)
	}

	// Four rows are far below 200000, so every exported reader succeeds. A
	// reader accidentally wired to a lowered limit would fail here.
	rows, err := GetQuotaDataByUserId(context.Background(), 1, start, end)
	require.NoError(t, err)
	assert.Len(t, rows, 4)

	rows, err = GetAllQuotaDates(context.Background(), start, end, "")
	require.NoError(t, err)
	assert.Len(t, rows, 4)

	rows, err = GetAllQuotaDates(context.Background(), start, end, "prod")
	require.NoError(t, err)
	assert.Len(t, rows, 4)

	// Grouped by (username, created_at); the four rows sit in four hourly
	// buckets, so four groups come back.
	rows, err = GetQuotaDataGroupByUser(context.Background(), start, end)
	require.NoError(t, err)
	assert.Len(t, rows, 4)
}

func TestQuotaDataRowCapBoundaryAndOverflow(t *testing.T) {
	truncateQuotaData(t)

	start := analysisCstMidnight
	end := start + 10*3600
	seed := func(count int) {
		for i := 0; i < count; i++ {
			require.NoError(t, DB.Table("quota_data").Create(&QuotaData{
				UserID: 1, Username: "cap", ModelName: fmt.Sprintf("model-%d", i),
				CreatedAt: start + int64(i)*3600, Count: 1, Quota: 1,
			}).Error)
		}
	}
	seed(3)

	// Exactly at the limit still succeeds.
	rows, err := runSegmentedQuotaDataQuery(
		context.Background(), start, end, 3, quotaDataByUserIdQuery(1))
	require.NoError(t, err)
	assert.Len(t, rows, 3)

	// limit+1 is refused with the stable overload error rather than truncated.
	require.NoError(t, DB.Table("quota_data").Create(&QuotaData{
		UserID: 1, Username: "cap", ModelName: "model-overflow",
		CreatedAt: start + 3*3600, Count: 1, Quota: 1,
	}).Error)

	rows, err = runSegmentedQuotaDataQuery(
		context.Background(), start, end, 3, quotaDataByUserIdQuery(1))
	require.ErrorIs(t, err, ErrQuotaDataTooManyRows)
	assert.Nil(t, rows)

	rows, err = runSegmentedQuotaDataQuery(
		context.Background(), start, end, 3, quotaDataGroupedByModelQuery())
	require.ErrorIs(t, err, ErrQuotaDataTooManyRows)
	assert.Nil(t, rows)

	// The same data under the production constant is nowhere near the cap.
	rows, err = GetQuotaDataByUserId(context.Background(), 1, start, end)
	require.NoError(t, err)
	assert.Len(t, rows, 4)
}

// A segmented range must apply the cap to the merged total, not per segment, so
// two segments cannot smuggle twice the limit back to the caller.
func TestQuotaDataRowCapAppliesAcrossSegments(t *testing.T) {
	truncateQuotaData(t)

	start, boundary, end := seedQuotaDataAcrossSegments(t, 1, "cap", 10)
	segments, splitErr := common.SplitDashboardRange(start, end)
	require.NoError(t, splitErr)
	require.Len(t, segments, 2)
	require.Less(t, boundary, end)

	// The seed writes 5 rows split across the two segments: 3 in the first and
	// 2 in the second. Neither segment alone exceeds a limit of 3, but the
	// merged result does.
	rows, err := runSegmentedQuotaDataQuery(
		context.Background(), start, end, 3, quotaDataByUserIdQuery(1))
	require.ErrorIs(t, err, ErrQuotaDataTooManyRows)
	assert.Nil(t, rows)

	// A limit that accommodates the merged total succeeds.
	rows, err = runSegmentedQuotaDataQuery(
		context.Background(), start, end, 5, quotaDataByUserIdQuery(1))
	require.NoError(t, err)
	assert.Len(t, rows, 5)
}

// Different limits must be completely independent. With a writable package
// level cap this could not hold: concurrent tests would clobber each other and
// the race detector would fire on the shared variable.
func TestQuotaDataRowLimitsAreIndependentAcrossGoroutines(t *testing.T) {
	truncateQuotaData(t)

	start := analysisCstMidnight
	end := start + 24*3600
	const seeded = 8
	for i := 0; i < seeded; i++ {
		require.NoError(t, DB.Table("quota_data").Create(&QuotaData{
			UserID: 1, Username: "parallel", ModelName: fmt.Sprintf("model-%d", i),
			CreatedAt: start + int64(i)*3600, Count: 1, Quota: 1,
		}).Error)
	}

	type outcome struct {
		limit int
		rows  int
		err   error
	}

	limits := []int{1, 2, 3, 5, 7, seeded, seeded + 4, maxQuotaDataRows}
	results := make([]outcome, len(limits))
	var wg sync.WaitGroup
	for i, limit := range limits {
		wg.Add(1)
		go func(index, rowLimit int) {
			defer wg.Done()
			rows, err := runSegmentedQuotaDataQuery(
				context.Background(), start, end, rowLimit, quotaDataByUserIdQuery(1))
			results[index] = outcome{limit: rowLimit, rows: len(rows), err: err}
		}(i, limit)
	}
	wg.Wait()

	for _, result := range results {
		if result.limit < seeded {
			assert.ErrorIs(t, result.err, ErrQuotaDataTooManyRows,
				"limit %d must overflow on %d rows", result.limit, seeded)
			assert.Zero(t, result.rows)
			continue
		}
		assert.NoError(t, result.err, "limit %d must succeed on %d rows", result.limit, seeded)
		assert.Equal(t, seeded, result.rows, "limit %d", result.limit)
	}

	// Running the same limits sequentially afterwards yields identical results,
	// proving no attempt left shared state behind.
	for _, limit := range limits {
		rows, err := runSegmentedQuotaDataQuery(
			context.Background(), start, end, limit, quotaDataByUserIdQuery(1))
		if limit < seeded {
			require.ErrorIs(t, err, ErrQuotaDataTooManyRows)
			assert.Nil(t, rows)
			continue
		}
		require.NoError(t, err)
		assert.Len(t, rows, seeded)
	}
}

// Static guarantee: no code in this module assigns to the production cap. A
// constant cannot be assigned to at all, and this test documents the intent so
// a future change from const to var is caught with an explanatory failure.
func TestNoAssignmentToTheProductionRowCapExists(t *testing.T) {
	source := readModuleGoSources(t)
	// This file is the checker: its regexes and message literals necessarily
	// contain the very patterns being searched for, so it is excluded from its
	// own scan. Every other file in the module is scanned.
	const checkerPath = "model/usedata_row_cap_test.go"
	require.Contains(t, source, checkerPath)
	delete(source, checkerPath)

	// Assignment forms, as opposed to reads. The const declaration itself is
	// `const maxQuotaDataRows = ...`, which none of these match because they
	// anchor the identifier at the start of a statement.
	forbidden := []*regexp.Regexp{
		regexp.MustCompile(`(?m)^\s*maxQuotaDataRows\s*(=[^=]|:=|\+=|-=|\*=|/=)`),
		regexp.MustCompile(`maxQuotaDataRows\s*(\+\+|--)`),
		regexp.MustCompile(`&maxQuotaDataRows\b`),
		regexp.MustCompile(`(?m)^\s*var\s+maxQuotaDataRows\b`),
	}

	for path, content := range source {
		if !strings.Contains(content, "maxQuotaDataRows") {
			continue
		}
		for _, pattern := range forbidden {
			assert.NotRegexp(t, pattern, content,
				"%s must not assign to or alias the production row cap", path)
		}
	}

	// The declaration itself must be a const, never a var, and the temporary
	// default/var split introduced for testing must be gone.
	usedata, ok := source["model/usedata.go"]
	require.True(t, ok)
	assert.Contains(t, usedata, "const maxQuotaDataRows = 200000")
	assert.NotContains(t, usedata, "defaultMaxQuotaDataRows")

	// No test may reintroduce a helper that mutates a package-level cap.
	for path, content := range source {
		if !strings.HasSuffix(path, "_test.go") {
			continue
		}
		assert.NotContains(t, content, "withMaxQuotaDataRows",
			"%s must not mutate a package-level cap", path)
	}
}
