package webauthn_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
)

// Example_multiFactorRegisterAndLogin demonstrates handling Multi Factor registration and Logins. This uses the higher level APIs to
// perform all of the various requirements. The Crude and Abstract examples are purely domain logic and will often
// describe aspects that should be considered during their implementation if they are important; these aspects
// are not strictly concerns related to the library as there are too many logical implementations to count.
func Example_multiFactorRegisterAndLogin() {
	config := &webauthn.Config{
		RPDisplayName: "Go WebAuthn",
		RPID:          "app.awesome-go-webauthn.com",
		RPOrigins:     []string{"https://app.awesome-go-webauthn.com"},
	}

	w, err := webauthn.New(config)
	if err != nil {
		// Crude example of error handling.
		panic(err)
	}

	mux := http.NewServeMux()

	// Register the handlers. The second component describes the action (i.e. register/login), the final component
	// describes the step (i.e. start/finish).
	mux.HandleFunc("/webauthn/register/start", handlerExampleMultiFactorCreateChallenge(w))
	mux.HandleFunc("/webauthn/register/finish", handlerExampleMultiFactorValidateCreateChallengeResponse(w))
	mux.HandleFunc("/webauthn/login/start", handlerExampleMultiFactorLoginChallenge(w))
	mux.HandleFunc("/webauthn/login/finish", handlerExampleMultiFactorLoginChallengeResponse(w))

	// Crude example that assumes the app is handled exclusively by a proxy which handles TLS termination. You will
	// have to adjust this depending on the context to ensure TLS is used on port 443 or the relevant config options
	// are adjusted.
	server := &http.Server{
		Addr:              ":8080",
		Handler:           mux,
		ReadTimeout:       5 * time.Second,
		ReadHeaderTimeout: 2 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20,
	}

	if err = server.ListenAndServe(); err != nil {
		panic(err)
	}
}

var sessionExampleMultiFactor *webauthn.SessionData

func saveSessionExampleMultiFactor(s *webauthn.SessionData) {
	sessionExampleMultiFactor = s
}

func loadSessionExampleMultiFactor() (*webauthn.SessionData, error) {
	if sessionExampleMultiFactor == nil {
		return nil, fmt.Errorf("no session found")
	}

	return sessionExampleMultiFactor, nil
}

func handlerExampleMultiFactorCreateChallenge(w *webauthn.WebAuthn) func(rw http.ResponseWriter, r *http.Request) {
	return func(rw http.ResponseWriter, r *http.Request) {
		// Crude / Abstract example of retrieving the user this registration will belong to. The user must be logged in
		// for this step unless you plan to register the user and the credential at the same time i.e. usernameless.
		// The user should have a unique and stable value returned from WebAuthnID that can be used to retrieve the
		// account details for the user.
		user, err := LoadUser()
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		var (
			creation *protocol.CredentialCreation
			s        *webauthn.SessionData
		)

		opts := []webauthn.RegistrationOption{
			webauthn.WithExclusions(webauthn.Credentials(user.WebAuthnCredentials()).CredentialDescriptors()),
			webauthn.WithExtensions(map[string]any{"credProps": true}),
		}

		if creation, s, err = w.BeginMediatedRegistration(user, protocol.MediationDefault, opts...); err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		// Crude example saving the session data securely to be loaded in the finish step of the register action. This
		// should be stored in such a way that the user and user agent has no access to it. For example using an opaque
		// session cookie.
		saveSessionExampleMultiFactor(s)

		encoder := json.NewEncoder(rw)

		if err = encoder.Encode(creation); err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		rw.Header().Set("Content-Type", "application/json; charset=utf-8")
		rw.WriteHeader(http.StatusOK)
	}
}

func handlerExampleMultiFactorValidateCreateChallengeResponse(w *webauthn.WebAuthn) func(rw http.ResponseWriter, r *http.Request) {
	return func(rw http.ResponseWriter, r *http.Request) {
		// Crude / Abstract example of retrieving the user performing the multi-factor authentication. The user must be
		// logged in for this step.
		user, err := LoadUser()
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		// Crude example loading the session data securely from the start step for the register action. This should be
		// loaded from a place the user and user agent has no access to it. For example using an opaque session cookie.
		s, err := loadSessionExampleMultiFactor()
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		credential, err := w.FinishRegistration(user, *s, r)
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		// Crude / Abstract example of adding the credential to the list of credentials for the user. This is critical
		// for performing future logins.
		user.credentials = append(user.credentials, *credential)

		// Crude / Abstract example of saving the updated user. This is critical for performing future logins.
		if err = SaveUser(user); err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		rw.WriteHeader(http.StatusOK)
	}
}

func handlerExampleMultiFactorLoginChallenge(w *webauthn.WebAuthn) func(rw http.ResponseWriter, r *http.Request) {
	return func(rw http.ResponseWriter, r *http.Request) {
		// Crude / Abstract example of retrieving the user for this multi-factor authentication. Because this is a
		// multi-factor authentication the user MUST be logged in at this stage and the returned struct/interface must
		// be deterministically matched to their account.
		user, err := LoadUser()
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		assertion, s, err := w.BeginMediatedLogin(user, protocol.MediationDefault)
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		// Crude example saving the session data securely to be loaded in the finish step of the login action. This
		// should be stored in such a way that the user and user agent has no access to it. For example using an opaque
		// session cookie.
		saveSessionExampleMultiFactor(s)

		encoder := json.NewEncoder(rw)

		if err = encoder.Encode(assertion); err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		rw.Header().Set("Content-Type", "application/json; charset=utf-8")
		rw.WriteHeader(http.StatusOK)
	}
}

func handlerExampleMultiFactorLoginChallengeResponse(w *webauthn.WebAuthn) func(rw http.ResponseWriter, r *http.Request) {
	return func(rw http.ResponseWriter, r *http.Request) {
		// Crude / Abstract example of retrieving the user performing the multi-factor authentication. The user must be
		// logged in for this step.
		user, err := LoadUser()
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		// Crude example loading the session data securely from the start step for the login action. This should be
		// loaded from a place the user and user agent has no access to it. For example using an opaque session cookie.
		s, err := loadSessionExampleMultiFactor()
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		validatedCredential, err := w.FinishLogin(user, *s, r)
		if err != nil {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		var found bool

		// Modify the matching credential in the user struct which is critical for proper future validations as the
		// metadata for this credential has been updated. No type assertion is required here since the LoadUser function
		// returns the concrete implementation, you may have to adjust this if you return the abstract implementation
		// instead.
		for i, credential := range user.credentials {
			if bytes.Equal(validatedCredential.ID, credential.ID) {
				user.credentials[i] = *validatedCredential

				// Crude / Abstract example of saving the user with their updated credentials. This is critical for
				// proper future validations.
				if err = SaveUser(user); err != nil {
					rw.WriteHeader(http.StatusInternalServerError)

					return
				}

				found = true

				break
			}
		}

		// Should error if we can't update the credentials for the user.
		if !found {
			rw.WriteHeader(http.StatusInternalServerError)

			return
		}

		rw.WriteHeader(http.StatusOK)
	}
}
