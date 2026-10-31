# Breaking Changes

This document contains notable breaking changes for particular versions that are likely to require manual intervention.

## v0.11.0

In v0.11.0 we started validating the backup related flags to ensure that they were in a valid state as per the
requirements in the spec. This introduced issues for some users as they had not been storing them and at least at one
point the flag values were challenging to obtain.

This has lead to an effective breaking change and a state where some credentials cannot be validated. The resolution to
this particular issue is to adapt current storage methods so that the values of the flags or each individual flag default
to a null-like value and manually perform an update to the storage and struct when a credential with null-like values is
observed.

The values can be obtained before validating the parsed response similar to the example below:

```go
package example

import (
	"net/http"
	
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
)

func FinishLogin(w http.ResponseWriter, r *http.Request) {
  // Abstract Business Logic: Get the WebAuthn User. 
  user := datastore.GetUser()

  // Abstract Business Logic: Get the WebAuthn Session Data. 
  session := datastore.GetSession()

  parsedResponse, err := protocol.ParseCredentialRequestResponse(r)
  if err != nil {
    // Handle Error and return.
    return
  }

  // Handle updating the appropriate credential using the flags value.
  flags := webauthn.NewCredentialFlags(parsedResponse.Response.AuthenticatorData.Flags)
}
```