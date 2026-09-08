package model

import (
	"path/filepath"
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupAgentCustomerModelDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := DB
	dsn := "file:" + filepath.Join(t.TempDir(), "agent-customer-model.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &AgentAccount{}))
	DB = db
	t.Cleanup(func() {
		DB = originalDB
		sqlDB, dbErr := db.DB()
		require.NoError(t, dbErr)
		require.NoError(t, sqlDB.Close())
	})
	return db
}

func TestTryBindUserToAgentUsesAtomicFirstBind(t *testing.T) {
	db := setupAgentCustomerModelDB(t)
	require.NoError(t, db.Create(&User{Id: 7101, Username: "customer-7101"}).Error)
	require.NoError(t, db.Create(&AgentAccount{UserId: 7102, Status: AgentAccountStatusActive}).Error)
	require.NoError(t, db.Create(&AgentAccount{UserId: 7103, Status: AgentAccountStatusDisabled}).Error)

	bound, err := TryBindUserToAgent(7101, 7102)
	require.NoError(t, err)
	assert.True(t, bound)

	bound, err = TryBindUserToAgent(7101, 7103)
	require.NoError(t, err)
	assert.False(t, bound)

	var customer User
	require.NoError(t, db.First(&customer, 7101).Error)
	assert.Equal(t, 7102, customer.BoundAgentId)
	assert.Positive(t, customer.BoundAt)
}

func TestTryBindUserToAgentConcurrentCallsHaveOneWinner(t *testing.T) {
	db := setupAgentCustomerModelDB(t)
	require.NoError(t, db.Create(&User{Id: 7111, Username: "customer-7111"}).Error)
	require.NoError(t, db.Create(&AgentAccount{UserId: 7112, Status: AgentAccountStatusActive}).Error)
	require.NoError(t, db.Create(&AgentAccount{UserId: 7113, Status: AgentAccountStatusActive}).Error)

	results := make(chan bool, 2)
	errs := make(chan error, 2)
	var wg sync.WaitGroup
	for _, agentID := range []int{7112, 7113} {
		wg.Add(1)
		go func(agentID int) {
			defer wg.Done()
			bound, err := TryBindUserToAgent(7111, agentID)
			results <- bound
			errs <- err
		}(agentID)
	}
	wg.Wait()
	close(results)
	close(errs)

	winners := 0
	for bound := range results {
		if bound {
			winners++
		}
	}
	for err := range errs {
		require.NoError(t, err)
	}
	assert.Equal(t, 1, winners)
}
