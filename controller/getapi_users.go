package controller

import (
	"errors"
	"io"
	"net/http"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

var getAPIExternalIdentity = regexp.MustCompile(`^[A-Za-z0-9_-]{1,128}$`)

func ProvisionGetAPIUser(c *gin.Context) {
	raw, err := io.ReadAll(http.MaxBytesReader(c.Writer, c.Request.Body, 4096))
	var fields map[string]interface{}
	if err != nil || common.Unmarshal(raw, &fields) != nil || len(fields) != 4 {
		writeGetAPIError(c, model.ErrGetAPIInvalidRequest)
		return
	}
	for _, name := range []string{"external_account_id", "username", "password", "display_name"} {
		if _, ok := fields[name].(string); !ok {
			writeGetAPIError(c, model.ErrGetAPIInvalidRequest)
			return
		}
	}
	var request model.GetAPICreateUserRequest
	if common.Unmarshal(raw, &request) != nil || !getAPIExternalIdentity.MatchString(request.ExternalAccountID) || c.GetHeader("Idempotency-Key") != request.ExternalAccountID || strings.TrimSpace(request.Username) == "" || request.Password == "" {
		writeGetAPIError(c, model.ErrGetAPIInvalidRequest)
		return
	}
	user := model.User{Username: strings.TrimSpace(request.Username), Password: request.Password, DisplayName: request.DisplayName}
	if common.Validate.Struct(&user) != nil {
		writeGetAPIError(c, model.ErrGetAPIInvalidRequest)
		return
	}
	c.Set("getapi_external_account_id", request.ExternalAccountID)
	credential, created, err := model.ProvisionGetAPIUser(c.GetString("getapi_integration_id"), c.GetInt("role"), request)
	if err != nil {
		writeGetAPIError(c, err)
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	c.JSON(status, gin.H{"success": true, "data": credential})
	c.Set("getapi_target_user_id", credential.UserID)
}

func GetGetAPIUserCredential(c *gin.Context) {
	external := c.Param("external_account_id")
	if !getAPIExternalIdentity.MatchString(external) {
		writeGetAPIError(c, model.ErrGetAPIInvalidRequest)
		return
	}
	c.Set("getapi_external_account_id", external)
	credential, err := model.ReadGetAPICredential(c.GetString("getapi_integration_id"), external, c.GetInt("role"))
	if err != nil {
		writeGetAPIError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": credential})
	c.Set("getapi_target_user_id", credential.UserID)
}

func writeGetAPIError(c *gin.Context, err error) {
	status := http.StatusServiceUnavailable
	code := model.ErrGetAPICredentialUnavailable.Error()
	switch {
	case errors.Is(err, model.ErrGetAPIInvalidRequest):
		status = http.StatusBadRequest
		code = err.Error()
	case errors.Is(err, model.ErrGetAPICapabilityDenied):
		status = http.StatusForbidden
		code = err.Error()
	case errors.Is(err, model.ErrGetAPIAccountNotFound), errors.Is(err, gorm.ErrRecordNotFound):
		status = http.StatusNotFound
		code = model.ErrGetAPIAccountNotFound.Error()
	case errors.Is(err, model.ErrGetAPICreateConflict), errors.Is(err, model.ErrGetAPIBindingConflict), errors.Is(err, model.ErrGetAPIPATMissing):
		status = http.StatusConflict
		code = err.Error()
	}
	c.JSON(status, gin.H{"success": false, "code": code, "message": "GetAPI request could not be completed"})
}
