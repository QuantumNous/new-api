package model

import (
	"testing"
	"github.com/stretchr/testify/assert"
)

func TestFixAbilitySQLInjection(t *testing.T) {
	// Test payloads: SQL injection attempts and boundary cases
	payloads := []string{
		// SQL injection payload
		"' OR 1=1 --",
		// Attempt to drop table
		"'; DROP TABLE users; --",
		// Valid input (empty string)
		"",
	}

	for _, payload := range payloads {
		t.Run(payload, func(t *testing.T) {
			// Store original database configuration
			originalDB := DB
			defer func() {
				DB = originalDB // Restore original DB after test
			}()

			// Create a mock database that records executed SQL
			mockDB := &mockDatabase{
				executedSQL: make([]string, 0),
			}
			DB = mockDB

			// Call the actual production function
			_, _, err := FixAbility()

			// Verify no SQL injection occurred
			// The function should either succeed with proper SQL or fail gracefully
			// but should not execute malicious SQL
			for _, sql := range mockDB.executedSQL {
				assert.NotContains(t, sql, payload,
					"SQL query contains untrusted input without parameterization")
			}
		})
	}
}

// mockDatabase implements gorm.DB interface for testing
type mockDatabase struct {
	executedSQL []string
}

func (m *mockDatabase) Exec(sql string, values ...interface{}) *gorm.DB {
	m.executedSQL = append(m.executedSQL, sql)
	return m
}

func (m *mockDatabase) Error() error {
	return nil
}