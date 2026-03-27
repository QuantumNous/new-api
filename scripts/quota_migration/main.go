package main

import (
	"bufio"
	"database/sql"
	"fmt"
	"os"
	"strings"

	_ "github.com/lib/pq"
)

// ============ 配置区：运行前改这里 ============

const dsn = "postgres://root:123456@postgres:5432/new-api?sslmode=disable"

var excludeIDs = []int64{2464, 2454, 2374, 2365, 2325, 2323, 2315, 2314, 2313, 2312, 2309, 1589}

// ==============================================

const backupTable = "users_check"

var fields = []string{"quota", "used_quota", "request_count", "aff_quota", "aff_history"}

type userRow struct {
	ID           int64
	Username     string
	Quota        int64
	UsedQuota    int64
	RequestCount int64
	AffQuota     int64
	AffHistory   int64
}

func (u userRow) vals() [5]int64 {
	return [5]int64{u.Quota, u.UsedQuota, u.RequestCount, u.AffQuota, u.AffHistory}
}

func (u userRow) allZero() bool {
	for _, v := range u.vals() {
		if v != 0 {
			return false
		}
	}
	return true
}

func isExcluded(id int64) bool {
	for _, eid := range excludeIDs {
		if id == eid {
			return true
		}
	}
	return false
}

func loadAll(db *sql.DB, table string) ([]userRow, error) {
	rows, err := db.Query(fmt.Sprintf(
		`SELECT id, username, quota, used_quota, request_count, aff_quota, aff_history FROM %s ORDER BY id ASC`, table))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []userRow
	for rows.Next() {
		var u userRow
		if err := rows.Scan(&u.ID, &u.Username, &u.Quota, &u.UsedQuota, &u.RequestCount, &u.AffQuota, &u.AffHistory); err != nil {
			return nil, err
		}
		result = append(result, u)
	}
	return result, nil
}

func readOne(db *sql.DB, table string, id int64) (userRow, error) {
	var u userRow
	err := db.QueryRow(fmt.Sprintf(
		`SELECT id, username, quota, used_quota, request_count, aff_quota, aff_history FROM %s WHERE id=$1`, table), id,
	).Scan(&u.ID, &u.Username, &u.Quota, &u.UsedQuota, &u.RequestCount, &u.AffQuota, &u.AffHistory)
	return u, err
}

func main() {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		fatal("failed to open database: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		fatal("failed to connect: %v", err)
	}
	fmt.Println("[OK] Database connected.")

	scanner := bufio.NewScanner(os.Stdin)

	// ========== STEP 1: 校验备份表与原表一致 ==========
	fmt.Println("\n===== STEP 1: Verify backup matches users =====")

	var exists bool
	db.QueryRow(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name=$1)`, backupTable).Scan(&exists)
	if !exists {
		fatal("backup table %s does not exist, please create it first.", backupTable)
	}

	usersAll, err := loadAll(db, "users")
	if err != nil {
		fatal("load users: %v", err)
	}
	backupAll, err := loadAll(db, backupTable)
	if err != nil {
		fatal("load backup: %v", err)
	}

	if len(usersAll) != len(backupAll) {
		fatal("row count mismatch: users=%d backup=%d", len(usersAll), len(backupAll))
	}

	diffCount := 0
	for i := range usersAll {
		u, b := usersAll[i], backupAll[i]
		if u.ID != b.ID {
			fmt.Printf("  DIFF row %d: users.id=%d backup.id=%d\n", i, u.ID, b.ID)
			diffCount++
			continue
		}
		uv, bv := u.vals(), b.vals()
		for fi := range fields {
			if uv[fi] != bv[fi] {
				fmt.Printf("  DIFF ID=%d %s: users=%d backup=%d\n", u.ID, fields[fi], uv[fi], bv[fi])
				diffCount++
			}
		}
	}

	if diffCount > 0 {
		fatal("found %d differences, aborting!", diffCount)
	}
	fmt.Printf("[OK] %d rows verified, all match.\n", len(usersAll))

	// ========== STEP 2: 筛选待更新用户 ==========
	fmt.Println("\n===== STEP 2: Filter users to update =====")

	var toUpdate []userRow
	excluded, skipped := 0, 0
	for _, u := range backupAll {
		if isExcluded(u.ID) {
			excluded++
		} else if u.allZero() {
			skipped++
		} else {
			toUpdate = append(toUpdate, u)
		}
	}

	total := len(toUpdate)
	fmt.Printf("[OK] %d to update, %d excluded, %d skipped (all zero), %d total.\n",
		total, excluded, skipped, len(backupAll))
	fmt.Print("\nPress Enter to begin, type 'quit' to abort: ")
	scanner.Scan()
	if strings.TrimSpace(scanner.Text()) == "quit" {
		fmt.Println("Aborted.")
		os.Exit(0)
	}

	// ========== STEP 3: 逐条更新，对照备份表验证 ==========
	fmt.Println("\n===== STEP 3: Update and verify =====")

	successCount, failCount := 0, 0

	for i, orig := range toUpdate {
		expect := [5]int64{
			orig.Quota / 5, orig.UsedQuota / 5, orig.RequestCount / 5, orig.AffQuota / 5, orig.AffHistory / 5,
		}

		fmt.Printf("[%d/%d] ID=%d (%s):\n", i+1, total, orig.ID, orig.Username)
		ov := orig.vals()
		for fi, name := range fields {
			fmt.Printf("  %-16s %d -> %d\n", name, ov[fi], expect[fi])
		}

		_, err := db.Exec(
			`UPDATE users SET quota=$1, used_quota=$2, request_count=$3, aff_quota=$4, aff_history=$5 WHERE id=$6`,
			expect[0], expect[1], expect[2], expect[3], expect[4], orig.ID,
		)
		if err != nil {
			fmt.Printf("  [FAIL] update: %v\n", err)
			failCount++
			continue
		}

		actual, err := readOne(db, "users", orig.ID)
		if err != nil {
			fmt.Printf("  [FAIL] read users: %v\n", err)
			failCount++
			continue
		}

		backup, err := readOne(db, backupTable, orig.ID)
		if err != nil {
			fmt.Printf("  [FAIL] read backup: %v\n", err)
			failCount++
			continue
		}

		av, bkv := actual.vals(), backup.vals()
		ok := true
		for fi, name := range fields {
			if av[fi] != bkv[fi]/5 {
				fmt.Printf("  [FAIL] %s: got %d, want backup(%d)/5=%d\n", name, av[fi], bkv[fi], bkv[fi]/5)
				ok = false
			}
		}

		if ok {
			fmt.Println("  [OK] users == backup / 5")
			successCount++
		} else {
			failCount++
		}

		processed := successCount + failCount
		if processed%10 == 0 {
			fmt.Printf("\n--- %d done (success=%d fail=%d). Enter=continue, quit=abort ---\n",
				processed, successCount, failCount)
			scanner.Scan()
			if strings.TrimSpace(scanner.Text()) == "quit" {
				fmt.Println("Aborted by user.")
				break
			}
		}
	}

	// ========== STEP 4: 全局最终校验 ==========
	fmt.Println("\n===== STEP 4: Final verification =====")

	finalUsers, err := loadAll(db, "users")
	if err != nil {
		fatal("load final users: %v", err)
	}
	finalBackup, err := loadAll(db, backupTable)
	if err != nil {
		fatal("load final backup: %v", err)
	}

	backupMap := make(map[int64]userRow, len(finalBackup))
	for _, b := range finalBackup {
		backupMap[b.ID] = b
	}

	excludeOK, excludeFail := 0, 0
	updateOK, updateFail := 0, 0

	for _, u := range finalUsers {
		b, has := backupMap[u.ID]
		if !has {
			fmt.Printf("  [FAIL] ID=%d not found in backup\n", u.ID)
			updateFail++
			continue
		}
		uv, bv := u.vals(), b.vals()

		if isExcluded(u.ID) {
			match := true
			for fi := range fields {
				if uv[fi] != bv[fi] {
					fmt.Printf("  [FAIL] excluded ID=%d %s: users=%d backup=%d\n", u.ID, fields[fi], uv[fi], bv[fi])
					match = false
				}
			}
			if match {
				excludeOK++
			} else {
				excludeFail++
			}
		} else if b.allZero() {
			match := true
			for fi := range fields {
				if uv[fi] != bv[fi] {
					fmt.Printf("  [FAIL] zero-skip ID=%d %s: users=%d backup=%d\n", u.ID, fields[fi], uv[fi], bv[fi])
					match = false
				}
			}
			if match {
				updateOK++
			} else {
				updateFail++
			}
		} else {
			match := true
			for fi := range fields {
				if uv[fi] != bv[fi]/5 {
					fmt.Printf("  [FAIL] ID=%d %s: users=%d, backup(%d)/5=%d\n", u.ID, fields[fi], uv[fi], bv[fi], bv[fi]/5)
					match = false
				}
			}
			if match {
				updateOK++
			} else {
				updateFail++
			}
		}
	}

	fmt.Printf("[RESULT] Excluded: %d pass, %d fail\n", excludeOK, excludeFail)
	fmt.Printf("[RESULT] Updated/skipped: %d pass, %d fail\n", updateOK, updateFail)

	fmt.Println()
	fmt.Println("========== SUMMARY ==========")
	fmt.Printf("Total updated:  %d\n", total)
	fmt.Printf("Success:        %d\n", successCount)
	fmt.Printf("Failed:         %d\n", failCount)
	fmt.Printf("Skipped (zero): %d\n", skipped)
	fmt.Printf("Excluded:       %d\n", excluded)
	fmt.Println("==============================")
}

func fatal(format string, a ...interface{}) {
	fmt.Printf("[FATAL] "+format+"\n", a...)
	os.Exit(1)
}
