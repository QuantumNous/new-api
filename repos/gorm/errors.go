package gorm

import (
	"errors"

	"gorm.io/gorm/logger"
)

var (
	// ErrRecordNotFound record not found error
	ErrRecordNotFound = logger.ErrRecordNotFound
	// ErrInvalidTransaction invalid transaction when you are trying to `Commit` or `Rollback`
	ErrInvalidTransaction = errors.New("invalid transaction")
	// ErrNotImplemented not implemented
	ErrNotImplemented = errors.New("not implemented")
	// ErrMissingWhereClause missing where clause
	ErrMissingWhereClause = errors.New("WHERE conditions required")
	// ErrUnsupportedRelation unsupported relations
	ErrUnsupportedRelation = errors.New("unsupported relations")
	// ErrPrimaryKeyRequired primary keys required
	ErrPrimaryKeyRequired = errors.New("primary key required")
	// ErrModelValueRequired model value required
	ErrModelValueRequired = errors.New("model value required")
	// ErrModelAccessibleFieldsRequired model accessible fields required
	ErrModelAccessibleFieldsRequired = errors.New("model accessible fields required")
	// ErrSubQueryRequired sub query required
	ErrSubQueryRequired = errors.New("sub query required")
	// ErrInvalidData unsupported data
	ErrInvalidData = errors.New("unsupported data")
	// ErrUnsupportedDriver unsupported driver
	ErrUnsupportedDriver = errors.New("unsupported driver")
	// ErrRegistered registered
	ErrRegistered = errors.New("registered")
	// ErrInvalidField invalid field
	ErrInvalidField = errors.New("invalid field")
	// ErrEmptySlice empty slice found
	ErrEmptySlice = errors.New("empty slice found")
	// ErrDryRunModeUnsupported dry run mode unsupported
	ErrDryRunModeUnsupported = errors.New("dry run mode unsupported")
	// ErrInvalidDB invalid db
	ErrInvalidDB = errors.New("invalid db")
	// ErrInvalidValue invalid value
	ErrInvalidValue = errors.New("invalid value, should be pointer to struct or slice")
	// ErrInvalidValueOfLength invalid values do not match length
	ErrInvalidValueOfLength = errors.New("invalid association values, length doesn't match")
	// ErrPreloadNotAllowed preload is not allowed when count is used
	ErrPreloadNotAllowed = errors.New("preload is not allowed when count is used")
	// ErrDuplicatedKey occurs when there is a unique key constraint violation
	ErrDuplicatedKey = errors.New("duplicated key not allowed")
	// ErrForeignKeyViolated occurs when there is a foreign key constraint violation
	ErrForeignKeyViolated = errors.New("violates foreign key constraint")
)
