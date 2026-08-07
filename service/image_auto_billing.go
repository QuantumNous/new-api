package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
)

func newImageAutoBillingSession(leaseContext context.Context, relayInfo *relaycommon.RelayInfo, reservedQuota int) (*BillingSession, *types.NewAPIError) {
	if reservedQuota <= 0 {
		return nil, types.NewErrorWithStatusCode(
			fmt.Errorf("image-auto reserve quota must be positive"),
			types.ErrorCodeModelPriceError,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}
	pref := common.NormalizeBillingPreference(relayInfo.UserSetting.BillingPreference)
	reserve := func(fundingSource string) (*model.ImageAutoBillingJournal, error) {
		return model.ReserveImageAutoBilling(model.ImageAutoBillingReserveParams{
			RequestId:     relayInfo.RequestId,
			UserId:        relayInfo.UserId,
			TokenId:       relayInfo.TokenId,
			ReservedQuota: reservedQuota,
			FundingSource: fundingSource,
		})
	}

	var journal *model.ImageAutoBillingJournal
	var err error
	switch pref {
	case "wallet_only":
		journal, err = reserve(model.ImageAutoBillingFundingWallet)
	case "subscription_only":
		journal, err = reserve(model.ImageAutoBillingFundingSubscription)
	case "wallet_first":
		journal, err = reserve(model.ImageAutoBillingFundingWallet)
		if errors.Is(err, model.ErrImageAutoBillingInsufficientWallet) {
			journal, err = reserve(model.ImageAutoBillingFundingSubscription)
		}
	case "subscription_first":
		fallthrough
	default:
		journal, err = reserve(model.ImageAutoBillingFundingSubscription)
		if errors.Is(err, model.ErrNoActiveSubscription) {
			journal, err = reserve(model.ImageAutoBillingFundingWallet)
		} else if errors.Is(err, model.ErrSubscriptionQuotaInsufficient) {
			allowWallet, overflowErr := model.UserActiveSubscriptionsAllowWalletOverflow(relayInfo.UserId)
			if overflowErr != nil {
				err = overflowErr
			} else if allowWallet {
				journal, err = reserve(model.ImageAutoBillingFundingWallet)
			}
		}
	}
	if err != nil {
		if errors.Is(err, model.ErrImageAutoBillingInsufficientWallet) ||
			errors.Is(err, model.ErrImageAutoBillingInsufficientToken) ||
			errors.Is(err, model.ErrNoActiveSubscription) ||
			errors.Is(err, model.ErrSubscriptionQuotaInsufficient) {
			return nil, types.NewErrorWithStatusCode(
				err,
				types.ErrorCodeInsufficientUserQuota,
				http.StatusForbidden,
				types.ErrOptionWithSkipRetry(),
				types.ErrOptionWithNoRecordErrorLog(),
			)
		}
		return nil, types.NewError(err, types.ErrorCodeUpdateDataError, types.ErrOptionWithSkipRetry())
	}
	var funding FundingSource
	if journal.FundingSource == model.ImageAutoBillingFundingSubscription {
		subscriptionFunding := &SubscriptionFunding{
			requestId:       journal.RequestId,
			userId:          journal.UserId,
			modelName:       relayInfo.OriginModelName,
			amount:          int64(journal.ReservedQuota),
			subscriptionId:  journal.UserSubscriptionId,
			preConsumed:     int64(journal.ReservedQuota),
			AmountTotal:     journal.SubscriptionAmountTotal,
			AmountUsedAfter: journal.SubscriptionAmountUsedAfter,
		}
		if planInfo, planErr := model.GetSubscriptionPlanInfoByUserSubscriptionId(journal.UserSubscriptionId); planErr == nil && planInfo != nil {
			subscriptionFunding.PlanId = planInfo.PlanId
			subscriptionFunding.PlanTitle = planInfo.PlanTitle
		}
		funding = subscriptionFunding
	} else {
		funding = &WalletFunding{userId: relayInfo.UserId, consumed: journal.ReservedQuota}
	}
	session := &BillingSession{
		relayInfo:        relayInfo,
		funding:          funding,
		durableRequestId: journal.RequestId,
		preConsumedQuota: journal.ReservedQuota,
		tokenConsumed:    journal.ReservedQuota,
	}
	session.syncRelayInfo()
	session.startLeaseHeartbeat(leaseContext)
	return session, nil
}
