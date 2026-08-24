package common

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
)

type verificationValue struct {
	code string
	time time.Time
}

const (
	EmailVerificationPurpose = "v"
	PasswordResetPurpose     = "r"
)

var verificationMutex sync.Mutex
var verificationMap map[string]verificationValue
var verificationMapMaxSize = 10
var VerificationValidMinutes = 10

const (
	registrationEmailLinkPrefix      = "registration-email-link:"
	registrationEmailCurrentPrefix   = "registration-email-current:"
	registrationEmailLinkGrantPrefix = "registration-email-link-grant:"
	registrationEmailGrantPrefix     = "registration-email-grant:"
	registrationEmailReservePrefix   = "registration-email-reserve:"
	registrationEmailRedisTimeout    = 2 * time.Second
	registrationEmailReserveSep      = "\x00"
)

var registrationEmailVerificationMutex sync.Mutex
var registrationEmailVerificationMap map[string]verificationValue
var registrationEmailMemoryMaxSize = 4096

func GenerateVerificationCode(length int) string {
	code := uuid.New().String()
	code = strings.Replace(code, "-", "", -1)
	if length == 0 {
		return code
	}
	return code[:length]
}

func verificationRedisKey(key string, purpose string) string {
	return fmt.Sprintf("verification:%s:%s", purpose, key)
}

// RDB stays nil until InitRedisClient even though RedisEnabled defaults to
// true, so guard both (same as PublishConfigChanged in redis_pubsub.go).
func verificationRedisUsable() bool {
	return RedisEnabled && RDB != nil
}

func registrationEmailRedisContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), registrationEmailRedisTimeout)
}

func registrationEmailReservationValue(email, owner string) string {
	return strings.TrimSpace(email) + registrationEmailReserveSep + owner
}

func registrationEmailReservationMatches(value, email, owner string) bool {
	return value == registrationEmailReservationValue(email, owner)
}

func registrationEmailReservationEmail(value string) string {
	email, _, ok := strings.Cut(value, registrationEmailReserveSep)
	if !ok {
		return ""
	}
	return strings.TrimSpace(email)
}

// Codes must be stored in Redis when it is enabled: with multiple instances
// behind a load balancer, the instance that verifies a code is usually not
// the one that generated it, so the in-memory map only works single-instance.
//
// These call RDB directly instead of the RedisSet/RedisGet wrappers: codes
// are credentials, and the wrappers log keys and values in debug mode.
func RegisterVerificationCodeWithKey(key string, code string, purpose string) {
	if verificationRedisUsable() {
		err := RDB.Set(context.Background(), verificationRedisKey(key, purpose), code, time.Duration(VerificationValidMinutes)*time.Minute).Err()
		if err == nil {
			return
		}
		SysError("failed to store verification code in Redis, falling back to memory: " + err.Error())
	}
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap[purpose+key] = verificationValue{
		code: code,
		time: time.Now(),
	}
	if len(verificationMap) > verificationMapMaxSize {
		removeExpiredPairs()
	}
}

func VerifyCodeWithKey(key string, code string, purpose string) bool {
	if verificationRedisUsable() {
		storedCode, err := RDB.Get(context.Background(), verificationRedisKey(key, purpose)).Result()
		if err == nil {
			return code == storedCode
		}
		if !errors.Is(err, redis.Nil) {
			SysError("failed to read verification code from Redis: " + err.Error())
		}
		// fall through to the in-memory map, which may hold codes stored
		// there when a Redis write failed
	}
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	value, okay := verificationMap[purpose+key]
	now := time.Now()
	if !okay || int(now.Sub(value.time).Seconds()) >= VerificationValidMinutes*60 {
		return false
	}
	return code == value.code
}

func DeleteKey(key string, purpose string) {
	if verificationRedisUsable() {
		if err := RDB.Del(context.Background(), verificationRedisKey(key, purpose)).Err(); err != nil {
			SysError("failed to delete verification code from Redis: " + err.Error())
		}
	}
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	delete(verificationMap, purpose+key)
}

func registrationEmailCredentialTTL() time.Duration {
	return time.Duration(VerificationValidMinutes) * time.Minute
}

func registrationEmailDigest(email string) string {
	digest := sha256.Sum256([]byte(strings.TrimSpace(email)))
	return hex.EncodeToString(digest[:])
}

func generateRegistrationEmailCredential() (string, error) {
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return "", fmt.Errorf("generate registration email credential: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(random), nil
}

func registrationEmailMemorySetBatchAt(values map[string]string, issuedAt time.Time) bool {
	now := time.Now()
	for existingKey, existingValue := range registrationEmailVerificationMap {
		if now.Sub(existingValue.time) >= registrationEmailCredentialTTL() {
			delete(registrationEmailVerificationMap, existingKey)
		}
	}
	newEntryCount := 0
	for key := range values {
		if _, exists := registrationEmailVerificationMap[key]; !exists {
			newEntryCount++
		}
	}
	if len(registrationEmailVerificationMap)+newEntryCount > registrationEmailMemoryMaxSize {
		return false
	}
	for key, value := range values {
		registrationEmailVerificationMap[key] = verificationValue{code: value, time: issuedAt}
	}
	return true
}

func registrationEmailMemorySetBatch(values map[string]string) bool {
	return registrationEmailMemorySetBatchAt(values, time.Now())
}

func registrationEmailMemorySet(key, value string) bool {
	return registrationEmailMemorySetBatch(map[string]string{key: value})
}

func registrationEmailMemoryGet(key string) (string, bool) {
	value, ok := registrationEmailVerificationMap[key]
	if !ok {
		return "", false
	}
	if time.Since(value.time) >= registrationEmailCredentialTTL() {
		delete(registrationEmailVerificationMap, key)
		return "", false
	}
	return value.code, true
}

// RegisterRegistrationEmailLink stores an opaque email-link token. Redis
// failures are returned instead of falling back to process memory because a
// link sent from one production node must be resolvable by every other node.
func RegisterRegistrationEmailLink(email string) (string, error) {
	email = strings.TrimSpace(email)
	if email == "" {
		return "", errors.New("registration email is empty")
	}
	token, err := generateRegistrationEmailCredential()
	if err != nil {
		return "", err
	}
	currentKey := registrationEmailCurrentPrefix + registrationEmailDigest(email)
	linkKey := registrationEmailLinkPrefix + token
	if verificationRedisUsable() {
		ctx, cancel := registrationEmailRedisContext()
		defer cancel()
		_, err = RDB.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.Set(ctx, linkKey, email, registrationEmailCredentialTTL())
			pipe.Set(ctx, currentKey, token, registrationEmailCredentialTTL())
			return nil
		})
		if err != nil {
			return "", fmt.Errorf("store registration email link in Redis: %w", err)
		}
		return token, nil
	}

	registrationEmailVerificationMutex.Lock()
	defer registrationEmailVerificationMutex.Unlock()
	if previousToken, ok := registrationEmailMemoryGet(currentKey); ok && previousToken != token {
		delete(registrationEmailVerificationMap, registrationEmailLinkPrefix+previousToken)
	}
	if !registrationEmailMemorySetBatch(map[string]string{
		linkKey:    email,
		currentKey: token,
	}) {
		return "", errors.New("registration email verification store is full")
	}
	return token, nil
}

// ResolveRegistrationEmailLink validates a token without consuming it. This is
// intentionally idempotent so link scanners and repeated clicks cannot burn a
// user's verification link before it expires.
func ResolveRegistrationEmailLink(token string) (string, bool, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return "", false, nil
	}
	linkKey := registrationEmailLinkPrefix + token
	if verificationRedisUsable() {
		ctx, cancel := registrationEmailRedisContext()
		defer cancel()
		email, err := RDB.Get(ctx, linkKey).Result()
		if errors.Is(err, redis.Nil) {
			return "", false, nil
		}
		if err != nil {
			return "", false, fmt.Errorf("read registration email link from Redis: %w", err)
		}
		current, err := RDB.Get(ctx, registrationEmailCurrentPrefix+registrationEmailDigest(email)).Result()
		if errors.Is(err, redis.Nil) {
			return "", false, nil
		}
		if err != nil {
			return "", false, fmt.Errorf("read current registration email link from Redis: %w", err)
		}
		if current != token {
			return "", false, nil
		}
		return strings.TrimSpace(email), true, nil
	}

	registrationEmailVerificationMutex.Lock()
	defer registrationEmailVerificationMutex.Unlock()
	email, ok := registrationEmailMemoryGet(linkKey)
	if !ok {
		return "", false, nil
	}
	current, ok := registrationEmailMemoryGet(registrationEmailCurrentPrefix + registrationEmailDigest(email))
	if !ok || current != token {
		return "", false, nil
	}
	return strings.TrimSpace(email), true, nil
}

// RegisterRegistrationEmailGrantForLink binds one link token to one grant.
// Repeated exchanges reuse the active grant, and the grant expires with the
// original link instead of extending the verification window.
func RegisterRegistrationEmailGrantForLink(token, email string) (string, time.Duration, bool, error) {
	token = strings.TrimSpace(token)
	email = strings.TrimSpace(email)
	if token == "" || email == "" {
		return "", 0, false, nil
	}
	candidate, err := generateRegistrationEmailCredential()
	if err != nil {
		return "", 0, false, err
	}
	linkKey := registrationEmailLinkPrefix + token
	currentKey := registrationEmailCurrentPrefix + registrationEmailDigest(email)
	linkGrantKey := registrationEmailLinkGrantPrefix + token
	candidateGrantKey := registrationEmailGrantPrefix + candidate
	if verificationRedisUsable() {
		const registerGrantForLinkScript = `
local storedEmail = redis.call('GET', KEYS[1])
if storedEmail ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[2] then
  return {'', 0}
end

local existingGrant = redis.call('GET', KEYS[3])
if existingGrant then
  local grantKey = ARGV[3] .. existingGrant
  local grantTTL = redis.call('PTTL', grantKey)
  if grantTTL > 0 and redis.call('GET', grantKey) == ARGV[1] then
    return {existingGrant, grantTTL}
  end

  local reserveKey = ARGV[4] .. existingGrant
  local reserveTTL = redis.call('PTTL', reserveKey)
  local reserveValue = redis.call('GET', reserveKey)
  local reservePrefix = ARGV[1] .. ARGV[6]
  if reserveTTL > 0 and reserveValue and string.sub(reserveValue, 1, string.len(reservePrefix)) == reservePrefix then
    return {existingGrant, reserveTTL}
  end
  return {'', 0}
end

local linkTTL = redis.call('PTTL', KEYS[1])
if linkTTL <= 0 then
  return {'', 0}
end
redis.call('PSETEX', KEYS[3], linkTTL, ARGV[5])
redis.call('PSETEX', KEYS[4], linkTTL, ARGV[1])
return {ARGV[5], linkTTL}`
		ctx, cancel := registrationEmailRedisContext()
		defer cancel()
		result, err := RDB.Eval(
			ctx,
			registerGrantForLinkScript,
			[]string{linkKey, currentKey, linkGrantKey, candidateGrantKey},
			email,
			token,
			registrationEmailGrantPrefix,
			registrationEmailReservePrefix,
			candidate,
			registrationEmailReserveSep,
		).Result()
		if err != nil {
			return "", 0, false, fmt.Errorf("bind registration email link grant in Redis: %w", err)
		}
		values, ok := result.([]interface{})
		if !ok || len(values) != 2 {
			return "", 0, false, errors.New("invalid registration email link grant response from Redis")
		}
		grant, grantOK := values[0].(string)
		ttlMilliseconds, ttlOK := values[1].(int64)
		if !grantOK || !ttlOK {
			return "", 0, false, errors.New("invalid registration email link grant values from Redis")
		}
		if grant == "" || ttlMilliseconds <= 0 {
			return "", 0, false, nil
		}
		return grant, time.Duration(ttlMilliseconds) * time.Millisecond, true, nil
	}

	registrationEmailVerificationMutex.Lock()
	defer registrationEmailVerificationMutex.Unlock()
	storedEmail, ok := registrationEmailMemoryGet(linkKey)
	if !ok || strings.TrimSpace(storedEmail) != email {
		return "", 0, false, nil
	}
	linkValue := registrationEmailVerificationMap[linkKey]
	current, ok := registrationEmailMemoryGet(currentKey)
	if !ok || current != token {
		return "", 0, false, nil
	}
	if existingGrant, exists := registrationEmailMemoryGet(linkGrantKey); exists {
		if storedGrantEmail, active := registrationEmailMemoryGet(registrationEmailGrantPrefix + existingGrant); active && strings.TrimSpace(storedGrantEmail) == email {
			remaining := time.Until(linkValue.time.Add(registrationEmailCredentialTTL()))
			return existingGrant, remaining, remaining > 0, nil
		}
		if storedReservation, active := registrationEmailMemoryGet(registrationEmailReservePrefix + existingGrant); active && registrationEmailReservationEmail(storedReservation) == email {
			remaining := time.Until(linkValue.time.Add(registrationEmailCredentialTTL()))
			return existingGrant, remaining, remaining > 0, nil
		}
		return "", 0, false, nil
	}
	if !registrationEmailMemorySetBatchAt(map[string]string{
		linkGrantKey:      candidate,
		candidateGrantKey: email,
	}, linkValue.time) {
		return "", 0, false, errors.New("registration email verification store is full")
	}
	remaining := time.Until(linkValue.time.Add(registrationEmailCredentialTTL()))
	if remaining <= 0 {
		delete(registrationEmailVerificationMap, linkGrantKey)
		delete(registrationEmailVerificationMap, candidateGrantKey)
		return "", 0, false, nil
	}
	return candidate, remaining, true, nil
}

func DeleteRegistrationEmailLink(token string) {
	token = strings.TrimSpace(token)
	if token == "" {
		return
	}
	linkKey := registrationEmailLinkPrefix + token
	if verificationRedisUsable() {
		ctx, cancel := registrationEmailRedisContext()
		defer cancel()
		email, err := RDB.Get(ctx, linkKey).Result()
		if errors.Is(err, redis.Nil) {
			return
		}
		if err != nil {
			SysError("failed to read registration email link for deletion: " + err.Error())
			return
		}
		currentKey := registrationEmailCurrentPrefix + registrationEmailDigest(email)
		const deleteLinkScript = `
local current = redis.call('GET', KEYS[2])
redis.call('DEL', KEYS[1])
if current == ARGV[1] then
  redis.call('DEL', KEYS[2])
end
return 1`
		if err := RDB.Eval(ctx, deleteLinkScript, []string{linkKey, currentKey}, token).Err(); err != nil {
			SysError("failed to delete registration email link from Redis: " + err.Error())
		}
		return
	}

	registrationEmailVerificationMutex.Lock()
	defer registrationEmailVerificationMutex.Unlock()
	email, ok := registrationEmailMemoryGet(linkKey)
	delete(registrationEmailVerificationMap, linkKey)
	if !ok {
		return
	}
	currentKey := registrationEmailCurrentPrefix + registrationEmailDigest(email)
	if current, ok := registrationEmailMemoryGet(currentKey); ok && current == token {
		delete(registrationEmailVerificationMap, currentKey)
	}
}

func RegisterRegistrationEmailGrant(email string) (string, error) {
	email = strings.TrimSpace(email)
	if email == "" {
		return "", errors.New("registration email is empty")
	}
	grant, err := generateRegistrationEmailCredential()
	if err != nil {
		return "", err
	}
	grantKey := registrationEmailGrantPrefix + grant
	if verificationRedisUsable() {
		ctx, cancel := registrationEmailRedisContext()
		defer cancel()
		if err := RDB.Set(ctx, grantKey, email, registrationEmailCredentialTTL()).Err(); err != nil {
			return "", fmt.Errorf("store registration email grant in Redis: %w", err)
		}
		return grant, nil
	}

	registrationEmailVerificationMutex.Lock()
	defer registrationEmailVerificationMutex.Unlock()
	if !registrationEmailMemorySet(grantKey, email) {
		return "", errors.New("registration email verification store is full")
	}
	return grant, nil
}

func VerifyRegistrationEmailGrant(grant, email string) bool {
	grant = strings.TrimSpace(grant)
	email = strings.TrimSpace(email)
	if grant == "" || email == "" {
		return false
	}
	grantKey := registrationEmailGrantPrefix + grant
	if verificationRedisUsable() {
		ctx, cancel := registrationEmailRedisContext()
		defer cancel()
		storedEmail, err := RDB.Get(ctx, grantKey).Result()
		if errors.Is(err, redis.Nil) {
			return false
		}
		if err != nil {
			SysError("failed to read registration email grant from Redis: " + err.Error())
			return false
		}
		return strings.TrimSpace(storedEmail) == email
	}

	registrationEmailVerificationMutex.Lock()
	defer registrationEmailVerificationMutex.Unlock()
	storedEmail, ok := registrationEmailMemoryGet(grantKey)
	return ok && strings.TrimSpace(storedEmail) == email
}

func ConsumeRegistrationEmailGrant(grant, email string) bool {
	owner, ok := ReserveRegistrationEmailGrant(grant, email)
	if !ok {
		return false
	}
	CommitRegistrationEmailGrantReservation(grant, email, owner)
	return true
}

func ReserveRegistrationEmailGrant(grant, email string) (string, bool) {
	owner, err := generateRegistrationEmailCredential()
	if err != nil {
		SysError("failed to generate registration email grant reservation owner: " + err.Error())
		return "", false
	}
	if !reserveRegistrationEmailGrant(grant, email, owner) {
		return "", false
	}
	return owner, true
}

func reserveRegistrationEmailGrant(grant, email, owner string) bool {
	grant = strings.TrimSpace(grant)
	email = strings.TrimSpace(email)
	owner = strings.TrimSpace(owner)
	if grant == "" || email == "" || owner == "" {
		return false
	}
	grantKey := registrationEmailGrantPrefix + grant
	reserveKey := registrationEmailReservePrefix + grant
	if verificationRedisUsable() {
		const reserveGrantScript = `
local expectedReservation = ARGV[1] .. ARGV[3] .. ARGV[2]
local existingReservation = redis.call('GET', KEYS[2])
if existingReservation then
  if existingReservation == expectedReservation then
    return 1
  end
  return 0
end

if redis.call('GET', KEYS[1]) ~= ARGV[1] then
  return 0
end
local grantTTL = redis.call('PTTL', KEYS[1])
if grantTTL <= 0 then
  return 0
end
redis.call('PSETEX', KEYS[2], grantTTL, expectedReservation)
redis.call('DEL', KEYS[1])
return 1`
		reserve := func() (int, error) {
			ctx, cancel := registrationEmailRedisContext()
			defer cancel()
			return RDB.Eval(ctx, reserveGrantScript, []string{grantKey, reserveKey}, email, owner, registrationEmailReserveSep).Int()
		}
		reserved, err := reserve()
		if err != nil {
			reserved, err = reserve()
		}
		if err != nil {
			SysError("failed to reserve registration email grant in Redis: " + err.Error())
			return false
		}
		return reserved == 1
	}

	registrationEmailVerificationMutex.Lock()
	defer registrationEmailVerificationMutex.Unlock()
	if reservation, reserved := registrationEmailMemoryGet(reserveKey); reserved {
		return registrationEmailReservationMatches(reservation, email, owner)
	}
	storedEmail, ok := registrationEmailMemoryGet(grantKey)
	if !ok || strings.TrimSpace(storedEmail) != email {
		return false
	}
	reservedValue := registrationEmailVerificationMap[grantKey]
	delete(registrationEmailVerificationMap, grantKey)
	reservedValue.code = registrationEmailReservationValue(email, owner)
	registrationEmailVerificationMap[reserveKey] = reservedValue
	return true
}

func RollbackRegistrationEmailGrantReservation(grant, email, owner string) bool {
	grant = strings.TrimSpace(grant)
	email = strings.TrimSpace(email)
	owner = strings.TrimSpace(owner)
	if grant == "" || email == "" || owner == "" {
		return false
	}
	grantKey := registrationEmailGrantPrefix + grant
	reserveKey := registrationEmailReservePrefix + grant
	if verificationRedisUsable() {
		const rollbackGrantScript = `
local expectedReservation = ARGV[1] .. ARGV[3] .. ARGV[2]
local existingReservation = redis.call('GET', KEYS[1])
if not existingReservation then
  if redis.call('GET', KEYS[2]) == ARGV[1] then
    return 1
  end
  return 0
end
if existingReservation ~= expectedReservation or redis.call('EXISTS', KEYS[2]) == 1 then
  return 0
end

local reserveTTL = redis.call('PTTL', KEYS[1])
if reserveTTL <= 0 then
  return 0
end
redis.call('PSETEX', KEYS[2], reserveTTL, ARGV[1])
redis.call('DEL', KEYS[1])
return 1`
		rollback := func() (int, error) {
			ctx, cancel := registrationEmailRedisContext()
			defer cancel()
			return RDB.Eval(ctx, rollbackGrantScript, []string{reserveKey, grantKey}, email, owner, registrationEmailReserveSep).Int()
		}
		rolledBack, err := rollback()
		if err != nil {
			rolledBack, err = rollback()
		}
		if err != nil {
			SysError("failed to roll back registration email grant reservation in Redis: " + err.Error())
			return false
		}
		return rolledBack == 1
	}

	registrationEmailVerificationMutex.Lock()
	defer registrationEmailVerificationMutex.Unlock()
	if _, available := registrationEmailMemoryGet(grantKey); available {
		return strings.TrimSpace(registrationEmailVerificationMap[grantKey].code) == email
	}
	reservation, ok := registrationEmailMemoryGet(reserveKey)
	if !ok || !registrationEmailReservationMatches(reservation, email, owner) {
		return false
	}
	reservedValue := registrationEmailVerificationMap[reserveKey]
	delete(registrationEmailVerificationMap, reserveKey)
	reservedValue.code = email
	registrationEmailVerificationMap[grantKey] = reservedValue
	return true
}

func CommitRegistrationEmailGrantReservation(grant, email, owner string) {
	grant = strings.TrimSpace(grant)
	email = strings.TrimSpace(email)
	owner = strings.TrimSpace(owner)
	if grant == "" || email == "" || owner == "" {
		return
	}
	reserveKey := registrationEmailReservePrefix + grant
	if verificationRedisUsable() {
		const commitGrantScript = `
local expectedReservation = ARGV[1] .. ARGV[3] .. ARGV[2]
if redis.call('GET', KEYS[1]) ~= expectedReservation then
  return 0
end
redis.call('DEL', KEYS[1])
return 1`
		ctx, cancel := registrationEmailRedisContext()
		defer cancel()
		if err := RDB.Eval(ctx, commitGrantScript, []string{reserveKey}, email, owner, registrationEmailReserveSep).Err(); err != nil {
			SysError("failed to commit registration email grant reservation in Redis: " + err.Error())
		}
	}
	registrationEmailVerificationMutex.Lock()
	defer registrationEmailVerificationMutex.Unlock()
	if reservation, ok := registrationEmailMemoryGet(reserveKey); ok && registrationEmailReservationMatches(reservation, email, owner) {
		delete(registrationEmailVerificationMap, reserveKey)
	}
}

func DeleteRegistrationEmailGrant(grant string) {
	grant = strings.TrimSpace(grant)
	if grant == "" {
		return
	}
	grantKey := registrationEmailGrantPrefix + grant
	reserveKey := registrationEmailReservePrefix + grant
	if verificationRedisUsable() {
		ctx, cancel := registrationEmailRedisContext()
		defer cancel()
		if err := RDB.Del(ctx, grantKey, reserveKey).Err(); err != nil {
			SysError("failed to delete registration email grant from Redis: " + err.Error())
		}
	}
	registrationEmailVerificationMutex.Lock()
	defer registrationEmailVerificationMutex.Unlock()
	delete(registrationEmailVerificationMap, grantKey)
	delete(registrationEmailVerificationMap, reserveKey)
}

// no lock inside, so the caller must lock the verificationMap before calling!
func removeExpiredPairs() {
	now := time.Now()
	for key := range verificationMap {
		if int(now.Sub(verificationMap[key].time).Seconds()) >= VerificationValidMinutes*60 {
			delete(verificationMap, key)
		}
	}
}

func init() {
	verificationMutex.Lock()
	defer verificationMutex.Unlock()
	verificationMap = make(map[string]verificationValue)
	registrationEmailVerificationMap = make(map[string]verificationValue)
}
