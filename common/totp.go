package common

import (
	"crypto/rand"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

const (
	// Backup code configuration
	BackupCodeLength = 8 // Spare code length
	BackupCodeCount  = 4 // Number of backup codes generated

	// Limit configuration
	MaxFailAttempts = 5   // Maximum number of failed attempts
	LockoutDuration = 300 // Lock time (seconds)
)

// GenerateTOTPSecret generates TOTP keys and configurations
func GenerateTOTPSecret(accountName string) (*otp.Key, error) {
	issuer := Get2FAIssuer()
	return totp.Generate(totp.GenerateOpts{
		Issuer:      issuer,
		AccountName: accountName,
		Period:      30,
		Digits:      otp.DigitsSix,
		Algorithm:   otp.AlgorithmSHA1,
	})
}

// ValidateTOTPCode Validate TOTP verification code
func ValidateTOTPCode(secret, code string) bool {
	// Clean up verification code format
	cleanCode := strings.ReplaceAll(code, " ", "")
	if len(cleanCode) != 6 {
		return false
	}

	// Verify verification code
	return totp.Validate(cleanCode, secret)
}

// GenerateBackupCodes Generate backup recovery codes
func GenerateBackupCodes() ([]string, error) {
	codes := make([]string, BackupCodeCount)

	for i := range BackupCodeCount {
		code, err := generateRandomBackupCode()
		if err != nil {
			return nil, err
		}
		codes[i] = code
	}

	return codes, nil
}

// generateRandomBackupCode generates a single backup code
func generateRandomBackupCode() (string, error) {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	code := make([]byte, BackupCodeLength)

	for i := range code {
		randomBytes := make([]byte, 1)
		_, err := rand.Read(randomBytes)
		if err != nil {
			return "", err
		}
		code[i] = charset[int(randomBytes[0])%len(charset)]
	}

	// Format to XXXX-XXXX format
	return fmt.Sprintf("%s-%s", string(code[:4]), string(code[4:])), nil
}

// ValidateBackupCode Validate backup code format
func ValidateBackupCode(code string) bool {
	// Remove all separators and convert to uppercase
	cleanCode := strings.ToUpper(strings.ReplaceAll(code, "-", ""))
	if len(cleanCode) != BackupCodeLength {
		return false
	}

	// Check if characters are legal
	for _, char := range cleanCode {
		if !((char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9')) {
			return false
		}
	}

	return true
}

// NormalizeBackupCode standardized backup code format
func NormalizeBackupCode(code string) string {
	cleanCode := strings.ToUpper(strings.ReplaceAll(code, "-", ""))
	if len(cleanCode) == BackupCodeLength {
		return fmt.Sprintf("%s-%s", cleanCode[:4], cleanCode[4:])
	}
	return code
}

// HashBackupCode Hash the backup code
func HashBackupCode(code string) (string, error) {
	normalizedCode := NormalizeBackupCode(code)
	return Password2Hash(normalizedCode)
}

// Get2FAIssuer Gets the 2FA issuer name
func Get2FAIssuer() string {
	return SystemName
}

// getEnvOrDefault gets environment variables or default values
func getEnvOrDefault(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// ValidateNumericCode validates the numeric verification code format
func ValidateNumericCode(code string) (string, error) {
	// Remove spaces
	code = strings.ReplaceAll(code, " ", "")

	if len(code) != 6 {
		return "", errors.New("the verification code must be 6 digits")
	}

	// Check if it is pure number
	if _, err := strconv.Atoi(code); err != nil {
		return "", errors.New("the verification code must contain only digits")
	}

	return code, nil
}

// GenerateQRCodeData generates QR code data
func GenerateQRCodeData(secret, username string) string {
	issuer := Get2FAIssuer()
	accountName := fmt.Sprintf("%s (%s)", username, issuer)
	return fmt.Sprintf("otpauth://totp/%s:%s?secret=%s&issuer=%s&digits=6&period=30",
		issuer, accountName, secret, issuer)
}
