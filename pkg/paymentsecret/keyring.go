// Package paymentsecret protects payment credentials at rest. Key material never
// belongs in the database, the application's session secret, or its logs.
package paymentsecret

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"regexp"
	"runtime"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

const Prefix = "payenc:v1:"

var keyIDPattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,64}$`)
var ErrSecret = errors.New("payment secret cannot be decrypted; check the payment key file and migration")

type Keyring struct {
	ActiveKeyID string            `json:"active_key_id"`
	Keys        map[string]string `json:"keys"`
}

// Load reads the small, private key file on demand, allowing atomic file rotation
// without retaining an obsolete keyring in process-wide configuration caches.
func Load() (*Keyring, error) {
	path := os.Getenv("PAYMENT_SECRET_KEY_FILE")
	if path == "" {
		return nil, errors.New("PAYMENT_SECRET_KEY_FILE is required for payment credentials")
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, errors.New("cannot open payment key file")
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || !info.Mode().IsRegular() || (runtime.GOOS != "windows" && info.Mode().Perm()&0077 != 0) {
		return nil, errors.New("payment key file must be a regular file readable only by its owner")
	}
	data, err := io.ReadAll(io.LimitReader(f, 65537))
	if err != nil || len(data) > 65536 {
		return nil, errors.New("invalid payment key file")
	}
	defer clear(data)
	var ring Keyring
	if common.Unmarshal(data, &ring) != nil || !keyIDPattern.MatchString(ring.ActiveKeyID) || len(ring.Keys) == 0 {
		return nil, errors.New("invalid payment key file")
	}
	for id, value := range ring.Keys {
		key, err := base64.StdEncoding.DecodeString(value)
		valid := err == nil && len(key) == 32 && keyIDPattern.MatchString(id)
		clear(key)
		if !valid {
			return nil, errors.New("invalid payment key file")
		}
	}
	if _, ok := ring.Keys[ring.ActiveKeyID]; !ok {
		return nil, errors.New("active payment key is missing")
	}
	return &ring, nil
}

func (r *Keyring) Seal(value, binding string) (string, error) {
	if value == "" {
		return "", nil
	}
	key, err := base64.StdEncoding.DecodeString(r.Keys[r.ActiveKeyID])
	if err != nil || len(key) != 32 {
		return "", ErrSecret
	}
	defer clear(key)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", ErrSecret
	}
	// Go generates and prepends a random 96-bit nonce to every ciphertext.
	aead, err := cipher.NewGCMWithRandomNonce(block)
	if err != nil {
		return "", ErrSecret
	}
	header := Prefix + r.ActiveKeyID + ":"
	sealed := aead.Seal(nil, nil, []byte(value), []byte(header+binding))
	return header + base64.RawStdEncoding.EncodeToString(sealed), nil
}

func (r *Keyring) Open(value, binding string) (string, error) {
	if value == "" {
		return "", nil
	}
	encoded, ok := strings.CutPrefix(value, Prefix)
	if !ok {
		return "", ErrSecret
	}
	id, data, ok := strings.Cut(encoded, ":")
	if !ok {
		return "", ErrSecret
	}
	key, err := base64.StdEncoding.DecodeString(r.Keys[id])
	if err != nil || len(key) != 32 {
		return "", ErrSecret
	}
	defer clear(key)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", ErrSecret
	}
	aead, err := cipher.NewGCMWithRandomNonce(block)
	if err != nil {
		return "", ErrSecret
	}
	ciphertext, err := base64.RawStdEncoding.DecodeString(data)
	if err != nil {
		return "", ErrSecret
	}
	plain, err := aead.Open(nil, nil, ciphertext, []byte(Prefix+id+":"+binding))
	if err != nil {
		return "", ErrSecret
	}
	defer clear(plain)
	return string(plain), nil
}

// GenerateFile never overwrites an existing keyring and never prints key material.
func GenerateFile(path string) error {
	return generateKeyFile(path, nil)
}

// RotateFile writes a new keyring retaining all previous decryption keys. Deploy
// this file to every instance before migrating ciphertext to its active key.
func RotateFile(path string) error {
	previous, err := Load()
	if err != nil {
		return err
	}
	return generateKeyFile(path, previous)
}

func generateKeyFile(path string, previous *Keyring) error {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return errors.New("cannot generate payment key")
	}
	defer clear(key)
	idBytes := make([]byte, 12)
	if _, err := rand.Read(idBytes); err != nil {
		return errors.New("cannot generate payment key ID")
	}
	id := base64.RawURLEncoding.EncodeToString(idBytes)
	keys := map[string]string{id: base64.StdEncoding.EncodeToString(key)}
	if previous != nil {
		if _, exists := previous.Keys[id]; exists {
			return errors.New("payment key ID collision; retry generation")
		}
		for keyID, encoded := range previous.Keys {
			keys[keyID] = encoded
		}
	}
	data, err := common.Marshal(Keyring{ActiveKeyID: id, Keys: keys})
	if err != nil {
		return errors.New("cannot encode payment key file")
	}
	defer clear(data)
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0400)
	if err != nil {
		return errors.New("cannot create payment key file (destination must not exist)")
	}
	_, writeErr := f.Write(data)
	syncErr := f.Sync()
	closeErr := f.Close()
	if writeErr != nil || syncErr != nil || closeErr != nil {
		return errors.New("payment key file write failed; remove the incomplete file before retrying")
	}
	return nil
}
