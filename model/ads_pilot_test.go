package model

import (
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAdsPilotTestDB(t *testing.T) {
	t.Helper()
	originalDB := DB
	originalUsingSQLite := common.UsingSQLite

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/ads_pilot.db?_pragma=busy_timeout(5000)"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(4)

	DB = db
	common.UsingSQLite = true
	require.NoError(t, db.AutoMigrate(&AdsPilotProposal{}, &AdsPilotInsight{}))

	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = originalDB
		common.UsingSQLite = originalUsingSQLite
	})
}

func TestDecideAdsPilotProposalStateMachine(t *testing.T) {
	setupAdsPilotTestDB(t)
	p := AdsPilotProposal{Rule: "R6", Kind: "bidding", Title: "switch to tCPA",
		DedupKey: "R6:tcpa:1", Status: AdsPilotProposalPending}
	require.NoError(t, DB.Create(&p).Error)

	require.NoError(t, DecideAdsPilotProposal(p.Id, AdsPilotProposalApproved, 7))

	var got AdsPilotProposal
	require.NoError(t, DB.First(&got, p.Id).Error)
	require.Equal(t, AdsPilotProposalApproved, got.Status)
	require.Equal(t, 7, got.DecidedBy)
	require.NotZero(t, got.DecidedAt)

	// second decision on a non-pending proposal must fail
	err := DecideAdsPilotProposal(p.Id, AdsPilotProposalRejected, 8)
	require.ErrorIs(t, err, ErrAdsPilotProposalDecided)
	require.NoError(t, DB.First(&got, p.Id).Error)
	require.Equal(t, AdsPilotProposalApproved, got.Status)
	require.Equal(t, 7, got.DecidedBy)

	// invalid decision value rejected
	require.Error(t, DecideAdsPilotProposal(p.Id, "executed", 7))
}

func TestDecideAdsPilotProposalConcurrent(t *testing.T) {
	setupAdsPilotTestDB(t)
	p := AdsPilotProposal{Rule: "R2", Kind: "keyword", Title: "promote exact",
		DedupKey: "R2:kw:1", Status: AdsPilotProposalPending}
	require.NoError(t, DB.Create(&p).Error)

	const n = 8
	var wg sync.WaitGroup
	wins := make(chan string, n)
	for i := 0; i < n; i++ {
		decision := AdsPilotProposalApproved
		if i%2 == 1 {
			decision = AdsPilotProposalRejected
		}
		wg.Add(1)
		go func(d string, admin int) {
			defer wg.Done()
			if err := DecideAdsPilotProposal(p.Id, d, admin); err == nil {
				wins <- d
			}
		}(decision, i+1)
	}
	wg.Wait()
	close(wins)
	var winners []string
	for w := range wins {
		winners = append(winners, w)
	}
	require.Len(t, winners, 1, "exactly one concurrent decision must win")

	var got AdsPilotProposal
	require.NoError(t, DB.First(&got, p.Id).Error)
	require.Equal(t, winners[0], got.Status)
}

func TestAckAdsPilotInsight(t *testing.T) {
	setupAdsPilotTestDB(t)
	in := AdsPilotInsight{Rule: "R4", Severity: "warn", Title: "cpc spike",
		DedupKey: "R4:cpc:1", Status: AdsPilotInsightOpen}
	require.NoError(t, DB.Create(&in).Error)

	require.NoError(t, AckAdsPilotInsight(in.Id, 3))
	require.Error(t, AckAdsPilotInsight(in.Id, 4)) // already acked

	var got AdsPilotInsight
	require.NoError(t, DB.First(&got, in.Id).Error)
	require.Equal(t, AdsPilotInsightAcked, got.Status)
	require.Equal(t, 3, got.AckedBy)
}
