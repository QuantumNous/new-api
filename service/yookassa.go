package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

const YooKassaCurrencyRUB = "RUB"

var YooKassaAPIBaseURL = "https://api.yookassa.ru/v3"
var YooKassaHTTPClient = http.DefaultClient

type YooKassaAmount struct {
	Value    string `json:"value"`
	Currency string `json:"currency"`
}

type YooKassaConfirmation struct {
	Type            string `json:"type,omitempty"`
	ReturnURL       string `json:"return_url,omitempty"`
	ConfirmationURL string `json:"confirmation_url,omitempty"`
}

type YooKassaPaymentMethodData struct {
	Type string `json:"type"`
}

type YooKassaPaymentRequest struct {
	Amount            YooKassaAmount            `json:"amount"`
	Capture           bool                      `json:"capture"`
	Confirmation      YooKassaConfirmation      `json:"confirmation"`
	PaymentMethodData YooKassaPaymentMethodData `json:"payment_method_data"`
	Description       string                    `json:"description,omitempty"`
	Metadata          map[string]string         `json:"metadata"`
}

type YooKassaPayment struct {
	ID                   string                 `json:"id"`
	Status               string                 `json:"status"`
	Paid                 bool                   `json:"paid"`
	Amount               YooKassaAmount         `json:"amount"`
	Confirmation         YooKassaConfirmation   `json:"confirmation"`
	Metadata             map[string]string      `json:"metadata"`
	PaymentMethod        map[string]interface{} `json:"payment_method,omitempty"`
	PaymentMethodData    map[string]interface{} `json:"payment_method_data,omitempty"`
	CreatedAt            string                 `json:"created_at,omitempty"`
	Description          string                 `json:"description,omitempty"`
	Recipient            map[string]interface{} `json:"recipient,omitempty"`
	RefundedAmount       *YooKassaAmount        `json:"refunded_amount,omitempty"`
	Test                 bool                   `json:"test,omitempty"`
	IncomeAmount         *YooKassaAmount        `json:"income_amount,omitempty"`
	AuthorizationDetails map[string]interface{} `json:"authorization_details,omitempty"`
}

type YooKassaClient struct {
	httpClient *http.Client
	baseURL    string
	shopID     string
	secretKey  string
}

func NewYooKassaClient(httpClient *http.Client) *YooKassaClient {
	if httpClient == nil {
		httpClient = YooKassaHTTPClient
	}
	return &YooKassaClient{
		httpClient: httpClient,
		baseURL:    YooKassaAPIBaseURL,
		shopID:     setting.YooKassaShopID,
		secretKey:  setting.YooKassaSecretKey,
	}
}

func NewYooKassaPaymentRequest(tradeNo string, userID int, topUpID int, amount string, returnURL string, paymentMethodType string) YooKassaPaymentRequest {
	if strings.TrimSpace(paymentMethodType) == "" {
		paymentMethodType = "sbp"
	}
	return YooKassaPaymentRequest{
		Amount: YooKassaAmount{
			Value:    amount,
			Currency: YooKassaCurrencyRUB,
		},
		Capture: true,
		Confirmation: YooKassaConfirmation{
			Type:      "redirect",
			ReturnURL: returnURL,
		},
		PaymentMethodData: YooKassaPaymentMethodData{Type: paymentMethodType},
		Description:       fmt.Sprintf("Top up %s", tradeNo),
		Metadata: map[string]string{
			"trade_no": tradeNo,
			"user_id":  fmt.Sprintf("%d", userID),
			"topup_id": fmt.Sprintf("%d", topUpID),
		},
	}
}

func (client *YooKassaClient) CreatePayment(ctx context.Context, tradeNo string, request YooKassaPaymentRequest) (*YooKassaPayment, error) {
	return client.do(ctx, http.MethodPost, "/payments", tradeNo, request)
}

func (client *YooKassaClient) GetPayment(ctx context.Context, paymentID string) (*YooKassaPayment, error) {
	paymentID = strings.TrimSpace(paymentID)
	if paymentID == "" {
		return nil, errors.New("empty yookassa payment id")
	}
	return client.do(ctx, http.MethodGet, "/payments/"+url.PathEscape(paymentID), "", nil)
}

func (client *YooKassaClient) do(ctx context.Context, method string, path string, idempotenceKey string, body any) (*YooKassaPayment, error) {
	var reader io.Reader
	if body != nil {
		bodyBytes, err := common.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(client.baseURL, "/")+path, reader)
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(client.shopID, client.secretKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	if idempotenceKey != "" {
		req.Header.Set("Idempotence-Key", idempotenceKey)
	}

	resp, err := client.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("yookassa returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var payment YooKassaPayment
	if err := common.Unmarshal(respBody, &payment); err != nil {
		return nil, err
	}
	return &payment, nil
}

func YooKassaRequestTimeoutContext(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, 15*time.Second)
}
