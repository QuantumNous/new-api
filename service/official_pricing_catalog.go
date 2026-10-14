package service

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/pkg/billingexpr"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	builtinplugins "github.com/QuantumNous/new-api/plugins"

	"golang.org/x/net/html"
)

const officialCNYPerUSD = 7.3

func parseDeepSeekPricing(
	sourceURL string,
	body []byte,
	allowedModels map[string]string,
) ([]officialTokenPrice, error) {
	text, err := officialPageText(body)
	if err != nil {
		return nil, err
	}
	required := []string{
		"deepseek-v4-flash",
		"deepseek-v4-pro",
		"off-peak",
		"peak",
		"$0.007",
		"$0.014",
		"$0.22",
		"$0.44",
		"$0.66",
		"$1.32",
		"$1.98",
		"$3.96",
	}
	if missing := missingOfficialMarkers(text, required); len(missing) > 0 {
		return nil, fmt.Errorf("DeepSeek pricing page is missing required markers: %s", strings.Join(missing, ", "))
	}

	schema := map[string]struct {
		canonical             string
		cacheOff, cachePeak   float64
		inputOff, inputPeak   float64
		outputOff, outputPeak float64
	}{
		"deepseek-v4-flash-原厂": {
			canonical: "deepseek-v4-flash",
			cacheOff:  0.007, cachePeak: 0.014,
			inputOff: 0.22, inputPeak: 0.44,
			outputOff: 0.66, outputPeak: 1.32,
		},
		"deepseek-v4-flash-vision-exp-原厂": {
			canonical: "deepseek-v4-flash-vision-exp",
			cacheOff:  0.007, cachePeak: 0.014,
			inputOff: 0.22, inputPeak: 0.44,
			outputOff: 0.66, outputPeak: 1.32,
		},
		"deepseek-v4-pro-原厂": {
			canonical: "deepseek-v4-pro",
			cacheOff:  0.022, cachePeak: 0.044,
			inputOff: 0.66, inputPeak: 1.32,
			outputOff: 1.98, outputPeak: 3.96,
		},
	}

	prices := make([]officialTokenPrice, 0, len(schema))
	for modelName, price := range schema {
		if _, ok := allowedModels[modelName]; !ok {
			continue
		}
		peakCondition := `weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") <= 5 && ((hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12) || (hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18))`
		expression := fmt.Sprintf(
			`%s ? tier("peak", p*%.10g + cr*%.10g + cc*%.10g + cc1h*%.10g + c*%.10g) : tier("off_peak", p*%.10g + cr*%.10g + cc*%.10g + cc1h*%.10g + c*%.10g)`,
			peakCondition,
			price.inputPeak,
			price.cachePeak,
			price.inputPeak,
			price.inputPeak,
			price.outputPeak,
			price.inputOff,
			price.cacheOff,
			price.inputOff,
			price.inputOff,
			price.outputOff,
		)
		prices = append(prices, officialTokenPrice{
			Vendor:         "deepseek",
			ModelName:      modelName,
			CanonicalModel: price.canonical,
			Currency:       "USD",
			Unit:           "per_1m_tokens",
			BillingBasis:   billingexpr.BillingBasisToken,
			Expression:     expression,
			SourceURL:      sourceURL,
			EvidenceHash:   officialDocumentEvidenceHash(sourceURL, body, modelName),
		})
	}
	if len(prices) == 0 {
		return nil, errors.New("DeepSeek pricing page contains no approved direct models")
	}
	return prices, nil
}

func parseVolcenginePricing(
	sourceURL string,
	body []byte,
	allowedModels map[string]string,
	_ time.Time,
) ([]officialTokenPrice, error) {
	text, err := officialPageText(body)
	if err != nil {
		return nil, err
	}
	required := make([]string, 0)
	hasSeedance := false
	hasSeedream := false
	for modelName := range allowedModels {
		if strings.HasPrefix(modelName, "doubao-seedance-") {
			hasSeedance = true
		}
		if strings.HasPrefix(modelName, "doubao-seedream-") {
			hasSeedream = true
		}
	}
	if hasSeedance {
		required = append(required,
			"doubao-seedance-2.5",
			"doubao-seedance-2.0-fast",
			"doubao-seedance-2.0-mini",
			"70.00",
			"46.00",
			"37.00",
			"23.00",
		)
	}
	if hasSeedream {
		required = append(required,
			"doubao-seedream-5-0-pro",
			"doubao-seedream-5-0",
			"doubao-seedream-4-5",
			"doubao-seedream-4-0",
			"0.30",
			"0.22",
			"0.25",
			"0.20",
		)
	}
	if missing := missingOfficialMarkers(text, required); len(missing) > 0 {
		return nil, fmt.Errorf("Volcengine pricing page is missing required markers: %s", strings.Join(missing, ", "))
	}

	promotion25Start := time.Date(2026, time.August, 14, 14, 0, 0, 0, time.FixedZone("Asia/Shanghai", 8*60*60)).Unix()
	promotion25End := time.Date(2026, time.September, 17, 14, 0, 0, 0, time.FixedZone("Asia/Shanghai", 8*60*60)).Unix()
	promotion20Start := time.Date(2026, time.August, 7, 14, 0, 0, 0, time.FixedZone("Asia/Shanghai", 8*60*60)).Unix()
	promotion20End := time.Date(2026, time.October, 7, 14, 0, 0, 0, time.FixedZone("Asia/Shanghai", 8*60*60)).Unix()

	tokenCost := func(cny float64) string {
		return fmt.Sprintf(`u("tokens") * %.10g / 1000000`, cny/officialCNYPerUSD)
	}
	imageCost := func(count string, cny float64) string {
		return fmt.Sprintf(`%s * %.10g`, count, cny/officialCNYPerUSD)
	}
	requestImageCost := func(cny float64) string {
		return fmt.Sprintf(`tier("per_image", fixed(%.10g)) * image_count`, cny/officialCNYPerUSD)
	}
	taskImageCost := func(cny float64) string {
		return fmt.Sprintf(
			`tier("per_image", (u("images_up_to_1_5k") + u("images_above_1_5k")) * %.10g)`,
			cny/officialCNYPerUSD,
		)
	}
	proReferenceCost := imageCost(`max(input_images - 1, 0)`, 0.02)
	proTaskReferenceCost := imageCost(`max(u("input_images") - 1, 0)`, 0.02)
	proRequestCost := fmt.Sprintf(
		`tier("per_image", fixed(%s + %s + %s))`,
		imageCost("images_up_to_1_5k", 0.30),
		imageCost("images_above_1_5k", 0.60),
		proReferenceCost,
	)
	proTaskCost := fmt.Sprintf(
		`tier("per_image", %s + %s + %s)`,
		imageCost(`u("images_up_to_1_5k")`, 0.30),
		imageCost(`u("images_above_1_5k")`, 0.60),
		proTaskReferenceCost,
	)
	video := `u("video_input") == "video"`
	resolution := `u("resolution")`
	promotion := func(start, end int64) string {
		return fmt.Sprintf(`unix() >= %d && unix() < %d`, start, end)
	}
	seedance25Expression := "v2:" + fmt.Sprintf(
		`%s == "1080p" ? (%s ? tier("promotion_1080p", %s ? %s : %s) : tier("list_1080p", %s ? %s : %s)) : tier("list_480p_720p", %s ? %s : %s)`,
		resolution,
		promotion(promotion25Start, promotion25End),
		video,
		tokenCost(33.12),
		tokenCost(55.44),
		video,
		tokenCost(46),
		tokenCost(77),
		video,
		tokenCost(42),
		tokenCost(70),
	)
	expressions := map[string]struct {
		expression       string
		pluginExpression string
		validFrom        int64
		validUntil       int64
	}{
		"doubao-seedance-2-5-260628": {
			expression: seedance25Expression,
			validFrom:  promotion25Start,
			validUntil: promotion25End,
		},
		"doubao-seedance-2-5-draft-preview-260828": {
			expression: seedance25Expression,
			validFrom:  promotion25Start,
			validUntil: promotion25End,
		},
		"doubao-seedance-2-0-260128": {
			expression: fmt.Sprintf(
				`%s == "1080p" ? tier("1080p", %s ? %s : %s) : %s == "4k" ? tier("4k", %s ? %s : %s) : tier("480p_720p", %s ? %s : %s)`,
				resolution,
				video,
				tokenCost(31),
				tokenCost(51),
				resolution,
				video,
				tokenCost(16),
				tokenCost(26),
				video,
				tokenCost(28),
				tokenCost(46),
			),
		},
		"doubao-seedance-2-0-fast-260128": {
			expression: "v2:" + fmt.Sprintf(
				`%s ? tier("promotion", %s ? %s : %s) : tier("list", %s ? %s : %s)`,
				promotion(promotion20Start, promotion20End),
				video,
				tokenCost(16.5),
				tokenCost(27.75),
				video,
				tokenCost(22),
				tokenCost(37),
			),
			validFrom:  promotion20Start,
			validUntil: promotion20End,
		},
		"doubao-seedance-2-0-mini-260615": {
			expression: "v2:" + fmt.Sprintf(
				`%s ? tier("promotion", %s ? %s : %s) : tier("list", %s ? %s : %s)`,
				promotion(promotion20Start, promotion20End),
				video,
				tokenCost(5.6),
				tokenCost(9.2),
				video,
				tokenCost(14),
				tokenCost(23),
			),
			validFrom:  promotion20Start,
			validUntil: promotion20End,
		},
		"doubao-seedance-1-0-pro-250528": {
			expression: fmt.Sprintf(`tier("list", %s)`, tokenCost(15)),
		},
		"doubao-seedance-1-0-pro-fast-251015": {
			expression: fmt.Sprintf(`tier("list", %s)`, tokenCost(4.2)),
		},
		"doubao-seedream-5-0-pro-260628": {
			expression:       proRequestCost,
			pluginExpression: proTaskCost,
		},
		"doubao-seedream-5-0-260128": {
			expression:       requestImageCost(0.22),
			pluginExpression: taskImageCost(0.22),
		},
		"doubao-seedream-4-5-251128": {
			expression:       requestImageCost(0.25),
			pluginExpression: taskImageCost(0.25),
		},
		"doubao-seedream-4-0-250828": {
			expression:       requestImageCost(0.20),
			pluginExpression: taskImageCost(0.20),
		},
		"doubao-seedream-4-0-20260415": {
			expression:       requestImageCost(0.20),
			pluginExpression: taskImageCost(0.20),
		},
	}

	videoUsageSchema := map[string]jsplugin.UsageFieldSchema{
		"tokens":      {Type: "number", Unit: "token"},
		"resolution":  {Enum: []string{"480p", "720p", "1080p", "4k"}},
		"video_input": {Enum: []string{"none", "video"}},
	}
	seedreamAliases := map[string]string{
		"doubao-seedream-4-0":     "doubao-seedream-4-0-20260415",
		"doubao-seedream-4-5":     "doubao-seedream-4-5-251128",
		"doubao-seedream-5-0":     "doubao-seedream-5-0-260128",
		"doubao-seedream-5-0-pro": "doubao-seedream-5-0-pro-260628",
	}
	var doubaoPlugin *jsplugin.LoadedPlugin
	if hasSeedream {
		source, sourceErr := builtinplugins.Source("doubao")
		if sourceErr != nil {
			return nil, fmt.Errorf("load embedded Doubao plugin: %w", sourceErr)
		}
		doubaoPlugin, err = jsplugin.CompilePlugin(source, jsplugin.Options{Key: "doubao"})
		if err != nil {
			return nil, fmt.Errorf("compile embedded Doubao plugin: %w", err)
		}
	}
	prices := make([]officialTokenPrice, 0, len(expressions))
	for modelName := range allowedModels {
		canonicalModel := modelName
		if aliasTarget, alias := seedreamAliases[modelName]; alias {
			canonicalModel = aliasTarget
		}
		price, exists := expressions[canonicalModel]
		if !exists {
			continue
		}
		billingBasis := billingexpr.BillingBasisTask
		usageSchema := videoUsageSchema
		if strings.HasPrefix(canonicalModel, "doubao-seedream-") {
			billingBasis = billingexpr.BillingBasisRequest
			usageSchema, _ = doubaoPlugin.Meta.UsageForModel(canonicalModel)
			if len(usageSchema) == 0 {
				return nil, fmt.Errorf("embedded Doubao plugin has no usage schema for %s", canonicalModel)
			}
		}
		prices = append(prices, officialTokenPrice{
			Vendor:           "volcengine",
			ModelName:        modelName,
			CanonicalModel:   canonicalModel,
			Currency:         "CNY",
			Unit:             "per_1m_tokens",
			BillingBasis:     billingBasis,
			Expression:       price.expression,
			PluginExpression: price.pluginExpression,
			ValidFrom:        price.validFrom,
			ValidUntil:       price.validUntil,
			UsageSchema:      usageSchema,
			SourceURL:        sourceURL,
			EvidenceHash:     officialDocumentEvidenceHash(sourceURL, body, modelName),
		})
	}
	if len(prices) == 0 {
		return nil, errors.New("Volcengine pricing page contains no approved models")
	}
	return prices, nil
}

func officialPageText(body []byte) (string, error) {
	document, err := html.Parse(strings.NewReader(string(body)))
	if err != nil {
		return "", err
	}
	return strings.ToLower(normalizedNodeText(document)), nil
}

func missingOfficialMarkers(text string, markers []string) []string {
	missing := make([]string, 0)
	for _, marker := range markers {
		if !strings.Contains(text, strings.ToLower(marker)) {
			missing = append(missing, marker)
		}
	}
	return missing
}

func officialDocumentEvidenceHash(sourceURL string, body []byte, modelName string) string {
	documentHash := sha256.Sum256(body)
	evidence := sourceURL + "\x00" + hex.EncodeToString(documentHash[:]) + "\x00" + modelName
	hash := sha256.Sum256([]byte(evidence))
	return hex.EncodeToString(hash[:])
}
