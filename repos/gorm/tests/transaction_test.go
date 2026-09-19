package tests_test

import (
	"context"
	"errors"
	"testing"

	"gorm.io/gorm"
	. "gorm.io/gorm/utils/tests"
)

func TestTransaction(t *testing.T) {
	tx := DB.Begin()
	user := *GetUser("transaction", Config{})

	if err := tx.Save(&user).Error; err != nil {
		t.Fatalf("No error should raise, but got %v", err)
	}

	if err := tx.First(&User{}, "name = ?", "transaction").Error; err != nil {
		t.Fatalf("Should find saved record, but got %v", err)
	}

	user1 := *GetUser("transaction1-1", Config{})

	if err := tx.Save(&user1).Error; err != nil {
		t.Fatalf("No error should raise, but got %v", err)
	}

	if err := tx.First(&User{}, "name = ?", user1.Name).Error; err != nil {
		t.Fatalf("Should find saved record, but got %v", err)
	}

	if sqlTx, ok := tx.Statement.ConnPool.(gorm.TxCommitter); !ok || sqlTx == nil {
		t.Fatalf("Should return the underlying sql.Tx")
	}

	tx.Rollback()

	if err := DB.First(&User{}, "name = ?", "transaction").Error; err == nil {
		t.Fatalf("Should not find record after rollback, but got %v", err)
	}

	txDB := DB.Where("fake_name = ?", "fake_name")
	tx2 := txDB.Session(&gorm.Session{NewDB: true}).Begin()
	user2 := *GetUser("transaction-2", Config{})
	if err := tx2.Save(&user2).Error; err != nil {
		t.Fatalf("No error should raise, but got %v", err)
	}

	if err := tx2.First(&User{}, "name = ?", "transaction-2").Error; err != nil {
		t.Fatalf("Should find saved record, but got %v", err)
	}

	tx2.Commit()

	if err := DB.First(&User{}, "name = ?", "transaction-2").Error; err != nil {
		t.Fatalf("Should be able to find committed record, but got %v", err)
	}

	t.Run("this is test nested transaction and prepareStmt coexist case", func(t *testing.T) {
		// enable prepare statement
		tx3 := DB.Session(&gorm.Session{PrepareStmt: true})
		if err := tx3.Transaction(func(tx4 *gorm.DB) error {
			// nested transaction
			return tx4.Transaction(func(tx5 *gorm.DB) error {
				return tx5.First(&User{}, "name = ?", "transaction-2").Error
			})
		}); err != nil {
			t.Fatalf("prepare statement and nested transcation coexist" + err.Error())
		}
	})
}

func TestCancelTransaction(t *testing.T) {
	ctx := context.Background()
	ctx, cancelFunc := context.WithCancel(ctx)
	cancelFunc()

	user := *GetUser("cancel_transaction", Config{})
	DB.Create(&user)

	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var result User
		tx.First(&result, user.ID)
		return nil
	})

	if err == nil {
		t.Fatalf("Transaction should get error when using cancelled context")
	}
}

func TestTransactionWithBlock(t *testing.T) {
	assertPanic := func(f func()) {
		defer func() {
			if r := recover(); r == nil {
				t.Fatalf("The code did not panic")
			}
		}()
		f()
	}

	// rollback
	err := DB.Transaction(func(tx *gorm.DB) error {
		user := *GetUser("transaction-block", Config{})
		if err := tx.Save(&user).Error; err != nil {
			t.Fatalf("No error should raise")
		}

		if err := tx.First(&User{}, "name = ?", user.Name).Error; err != nil {
			t.Fatalf("Should find saved record")
		}

		return errors.New("the error message")
	})

	if err != nil && err.Error() != "the error message" {
		t.Fatalf("Transaction return error will equal the block returns error")
	}

	if err := DB.First(&User{}, "name = ?", "transaction-block").Error; err == nil {
		t.Fatalf("Should not find record after rollback")
	}

	// commit
	DB.Transaction(func(tx *gorm.DB) error {
		user := *GetUser("transaction-block-2", Config{})
		if err := tx.Save(&user).Error; err != nil {
			t.Fatalf("No error should raise")
		}

		if err := tx.First(&User{}, "name = ?", user.Name).Error; err != nil {
			t.Fatalf("Should find saved record")
		}
		return nil
	})

	if err := DB.First(&User{}, "name = ?", "transaction-block-2").Error; err != nil {
		t.Fatalf("Should be able to find committed record")
	}

	// panic will rollback
	assertPanic(func() {
		DB.Transaction(func(tx *gorm.DB) error {
			user := *GetUser("transaction-block-3", Config{})
			if err := tx.Save(&user).Error; err != nil {
				t.Fatalf("No error should raise")
			}

			if err := tx.First(&User{}, "name = ?", user.Name).Error; err != nil {
				t.Fatalf("Should find saved record")
			}

			panic("force panic")
		})
	})

	if err := DB.First(&User{}, "name = ?", "transaction-block-3").Error; err == nil {
		t.Fatalf("Should not find record after panic rollback")
	}
}

func TestTransactionRaiseErrorOnRollbackAfterCommit(t *testing.T) {
	tx := DB.Begin()
	user := User{Name: "transaction"}
	if err := tx.Save(&user).Error; err != nil {
		t.Fatalf("No error should raise")
	}

	if err := tx.Commit().Error; err != nil {
		t.Fatalf("Commit should not raise error")
	}

	if err := tx.Rollback().Error; err == nil {
		t.Fatalf("Rollback after commit should raise error")
	}
}

func TestTransactionWithSavePoint(t *testing.T) {
	tx := DB.Begin()

	user := *GetUser("transaction-save-point", Config{})
	tx.Create(&user)

	if err := tx.First(&User{}, "name = ?", user.Name).Error; err != nil {
		t.Fatalf("Should find saved record")
	}

	if err := tx.SavePoint("save_point1").Error; err != nil {
		t.Fatalf("Failed to save point, got error %v", err)
	}

	user1 := *GetUser("transaction-save-point-1", Config{})
	tx.Create(&user1)

	if err := tx.First(&User{}, "name = ?", user1.Name).Error; err != nil {
		t.Fatalf("Should find saved record")
	}

	if err := tx.RollbackTo("save_point1").Error; err != nil {
		t.Fatalf("Failed to save point, got error %v", err)
	}

	if err := tx.First(&User{}, "name = ?", user1.Name).Error; err == nil {
		t.Fatalf("Should not find rollbacked record")
	}

	if err := tx.SavePoint("save_point2").Error; err != nil {
		t.Fatalf("Failed to save point, got error %v", err)
	}

	user2 := *GetUser("transaction-save-point-2", Config{})
	tx.Create(&user2)

	if err := tx.First(&User{}, "name = ?", user2.Name).Error; err != nil {
		t.Fatalf("Should find saved record")
	}

	if err := tx.Commit().Error; err != nil {
		t.Fatalf("Failed to commit, got error %v", err)
	}

	if err := DB.First(&User{}, "name = ?", user.Name).Error; err != nil {
		t.Fatalf("Should find saved record")
	}

	if err := DB.First(&User{}, "name = ?", user1.Name).Error; err == nil {
		t.Fatalf("Should not find rollbacked record")
	}

	if err := DB.First(&User{}, "name = ?", user2.Name).Error; err != nil {
		t.Fatalf("Should find saved record")
	}
}

func TestNestedTransactionWithBlock(t *testing.T) {
	var (
		user  = *GetUser("transaction-nested", Config{})
		user1 = *GetUser("transaction-nested-1", Config{})
		user2 = *GetUser("transaction-nested-2", Config{})
	)

	if err := DB.Transaction(func(tx *gorm.DB) error {
		tx.Create(&user)

		if err := tx.First(&User{}, "name = ?", user.Name).Error; err != nil {
			t.Fatalf("Should find saved record")
		}

		if err := tx.Transaction(func(tx1 *gorm.DB) error {
			tx1.Create(&user1)

			if err := tx1.First(&User{}, "name = ?", user1.Name).Error; err != nil {
				t.Fatalf("Should find saved record")
			}

			return errors.New("rollback")
		}); err == nil {
			t.Fatalf("nested transaction should returns error")
		}

		if err := tx.First(&User{}, "name = ?", user1.Name).Error; err == nil {
			t.Fatalf("Should not find rollbacked record")
		}

		if err := tx.Transaction(func(tx2 *gorm.DB) error {
			tx2.Create(&user2)

			if err := tx2.First(&User{}, "name = ?", user2.Name).Error; err != nil {
				t.Fatalf("Should find saved record")
			}

			return nil
		}); err != nil {
			t.Fatalf("nested transaction returns error: %v", err)
		}

		if err := tx.First(&User{}, "name = ?", user2.Name).Error; err != nil {
			t.Fatalf("Should find saved record")
		}
		return nil
	}); err != nil {
		t.Fatalf("no error should return, but got %v", err)
	}

	if err := DB.First(&User{}, "name = ?", user.Name).Error; err != nil {
		t.Fatalf("Should find saved record")
	}

	if err := DB.First(&User{}, "name = ?", user1.Name).Error; err == nil {
		t.Fatalf("Should not find rollbacked record")
	}

	if err := DB.First(&User{}, "name = ?", user2.Name).Error; err != nil {
		t.Fatalf("Should find saved record")
	}
}

func TestDisabledNestedTransaction(t *testing.T) {
	var (
		user  = *GetUser("transaction-nested", Config{})
		user1 = *GetUser("transaction-nested-1", Config{})
		user2 = *GetUser("transaction-nested-2", Config{})
	)

	if err := DB.Session(&gorm.Session{DisableNestedTransaction: true}).Transaction(func(tx *gorm.DB) error {
		tx.Create(&user)

		if err := tx.First(&User{}, "name = ?", user.Name).Error; err != nil {
			t.Fatalf("Should find saved record")
		}

		if err := tx.Transaction(func(tx1 *gorm.DB) error {
			tx1.Create(&user1)

			if err := tx1.First(&User{}, "name = ?", user1.Name).Error; err != nil {
				t.Fatalf("Should find saved record")
			}

			return errors.New("rollback")
		}); err == nil {
			t.Fatalf("nested transaction should returns error")
		}

		if err := tx.First(&User{}, "name = ?", user1.Name).Error; err != nil {
			t.Fatalf("Should not rollback record if disabled nested transaction support")
		}

		if err := tx.Transaction(func(tx2 *gorm.DB) error {
			tx2.Create(&user2)

			if err := tx2.First(&User{}, "name = ?", user2.Name).Error; err != nil {
				t.Fatalf("Should find saved record")
			}

			return nil
		}); err != nil {
			t.Fatalf("nested transaction returns error: %v", err)
		}

		if err := tx.First(&User{}, "name = ?", user2.Name).Error; err != nil {
			t.Fatalf("Should find saved record")
		}
		return nil
	}); err != nil {
		t.Fatalf("no error should return, but got %v", err)
	}

	if err := DB.First(&User{}, "name = ?", user.Name).Error; err != nil {
		t.Fatalf("Should find saved record")
	}

	if err := DB.First(&User{}, "name = ?", user1.Name).Error; err != nil {
		t.Fatalf("Should not rollback record if disabled nested transaction support")
	}

	if err := DB.First(&User{}, "name = ?", user2.Name).Error; err != nil {
		t.Fatalf("Should find saved record")
	}
}

func TestTransactionOnClosedConn(t *testing.T) {
	DB, err := OpenTestConnection(&gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database, got error %v", err)
	}
	rawDB, _ := DB.DB()
	rawDB.Close()

	if err := DB.Transaction(func(tx *gorm.DB) error {
		return nil
	}); err == nil {
		t.Errorf("should returns error when commit with closed conn, got error %v", err)
	}

	if err := DB.Session(&gorm.Session{PrepareStmt: true}).Transaction(func(tx *gorm.DB) error {
		return nil
	}); err == nil {
		t.Errorf("should returns error when commit with closed conn, got error %v", err)
	}
}

func TestTransactionWithHooks(t *testing.T) {
	user := GetUser("tTestTransactionWithHooks", Config{Account: true})
	DB.Create(&user)

	var err error
	err = DB.Transaction(func(tx *gorm.DB) error {
		return tx.Model(&User{}).Limit(1).Transaction(func(tx2 *gorm.DB) error {
			return tx2.Scan(&User{}).Error
		})
	})

	if err != nil {
		t.Error(err)
	}

	// method with hooks
	err = DB.Transaction(func(tx1 *gorm.DB) error {
		// callMethod do
		tx2 := tx1.Find(&User{}).Session(&gorm.Session{NewDB: true})
		// trx in hooks
		return tx2.Transaction(func(tx3 *gorm.DB) error {
			return tx3.Where("user_id", user.ID).Delete(&Account{}).Error
		})
	})

	if err != nil {
		t.Error(err)
	}
}
