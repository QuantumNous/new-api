package main

import (
	"fmt"
	"sort"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func openPostgres(dsn string) (*gorm.DB, error) {
	if dsn == "" {
		return nil, fmt.Errorf("postgres DSN is required")
	}
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{PrepareStmt: false, Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return nil, err
	}
	return db, nil
}

func exportSourceBundle(sourceDSN string, agentID int) (MigrationBundle, error) {
	if agentID <= 0 {
		return MigrationBundle{}, fmt.Errorf("agent id must be positive")
	}
	db, err := openPostgres(sourceDSN)
	if err != nil {
		return MigrationBundle{}, fmt.Errorf("open source database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return MigrationBundle{}, err
	}
	defer sqlDB.Close()

	var bundle MigrationBundle
	bundle.Version = migrationBundleVersion
	bundle.AgentID = agentID
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY").Error; err != nil {
			return fmt.Errorf("set read-only transaction: %w", err)
		}
		if err := tx.Where("id = ?", agentID).First(&bundle.Agent).Error; err != nil {
			return fmt.Errorf("load agent user %d: %w", agentID, err)
		}
		if err := tx.Where("bound_agent_id = ?", agentID).Order("id ASC").Find(&bundle.Customers).Error; err != nil {
			return fmt.Errorf("load bound customers: %w", err)
		}

		customerIDs := make([]int, 0, len(bundle.Customers))
		customerIDs = append(customerIDs, agentID)
		for _, customer := range bundle.Customers {
			customerIDs = append(customerIDs, customer.Id)
		}
		if err := tx.Where("user_id = ?", agentID).Find(&bundle.Credits).Error; err != nil {
			return fmt.Errorf("load agent credit: %w", err)
		}
		if err := tx.Where("user_id = ?", agentID).Order("id ASC").Find(&bundle.CreditLogs).Error; err != nil {
			return fmt.Errorf("load agent credit logs: %w", err)
		}

		var sourcePackages []SourcePackage
		if err := tx.Order("id ASC").Find(&sourcePackages).Error; err != nil {
			return fmt.Errorf("load packages: %w", err)
		}
		packageIDs := make(map[int]bool)
		for _, pkg := range sourcePackages {
			if pkg.ProductType == "subscription" && pkg.Status == 1 {
				packageIDs[pkg.Id] = true
			}
		}
		for _, log := range bundle.CreditLogs {
			if log.PackageId > 0 {
				packageIDs[log.PackageId] = true
			}
		}
		if err := tx.Where("agent_id = ?", agentID).Order("id ASC").Find(&bundle.Redemptions).Error; err != nil {
			return fmt.Errorf("load agent redemptions: %w", err)
		}
		for _, redemption := range bundle.Redemptions {
			if redemption.PackageId > 0 {
				packageIDs[redemption.PackageId] = true
			}
		}

		for _, pkg := range sourcePackages {
			if packageIDs[pkg.Id] {
				bundle.Packages = append(bundle.Packages, pkg)
			}
		}
		if len(packageIDs) > 0 {
			if err := tx.Where("package_id IN ? AND offer_type = ?", sortedIntKeys(packageIDs), "agent").Order("id ASC").Find(&bundle.Offers).Error; err != nil {
				return fmt.Errorf("load agent offers: %w", err)
			}
		}
		if err := tx.Where("user_id IN ?", customerIDs).Order("id ASC").Find(&bundle.UserPackages).Error; err != nil {
			return fmt.Errorf("load customer packages: %w", err)
		}
		if err := tx.Where("user_id IN ?", customerIDs).Order("id ASC").Find(&bundle.QuotaGrants).Error; err != nil {
			return fmt.Errorf("load customer quota grants: %w", err)
		}
		if err := tx.Where("user_id IN ?", customerIDs).Order("id ASC").Find(&bundle.Tokens).Error; err != nil {
			return fmt.Errorf("load customer tokens: %w", err)
		}

		return tx.Where("user_id IN ?", bundleCustomerIDs(bundle.Customers)).Order("id ASC").Find(&bundle.Logs).Error
	})
	if err != nil {
		return MigrationBundle{}, err
	}
	return bundle, nil
}

func bundleCustomerIDs(customers []SourceUser) []int {
	ids := make([]int, 0, len(customers))
	for _, customer := range customers {
		ids = append(ids, customer.Id)
	}
	return ids
}

func sortedIntKeys(values map[int]bool) []int {
	keys := make([]int, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Ints(keys)
	return keys
}
