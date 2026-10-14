package billingexpr

import (
	"fmt"
	"math"

	"github.com/expr-lang/expr/ast"
)

var fixedRequestScalarIdentifiers = map[string]struct{}{
	"images_up_to_1_5k": {},
	"images_above_1_5k": {},
	"input_images":      {},
}

func usesFixedRequestScalar(node ast.Node) bool {
	return ast.Find(node, func(part ast.Node) bool {
		identifier, ok := part.(*ast.IdentifierNode)
		if !ok {
			return false
		}
		_, allowed := fixedRequestScalarIdentifiers[identifier.Value]
		return allowed
	}) != nil
}

// UsesFixedPricing includes unselected branches, even when compilation later
// optimizes them away. Hosts use it to reject unsupported billing entrances.
func UsesFixedPricing(expression string) bool {
	return UsesFixedPricingByHash(expression, ExprHashString(expression))
}

// UsesFixedPricingByHash avoids hashing an expression already in a snapshot.
func UsesFixedPricingByHash(expression, hash string) bool {
	entry, err := compileEntryFromCacheByHash(expression, hash)
	return err == nil && entry.fixedPricing
}

func containsPricingMarker(node ast.Node) bool {
	return ast.Find(node, func(part ast.Node) bool {
		identifier, ok := part.(*ast.IdentifierNode)
		return ok && (identifier.Value == "tier" || identifier.Value == "fixed")
	}) != nil
}

func isRequestPriceMultiplier(node ast.Node) bool {
	if identifier, ok := node.(*ast.IdentifierNode); ok && identifier.Value == "image_count" {
		return true
	}
	conditional, ok := node.(*ast.ConditionalNode)
	if !ok || !usesRequestProbe(conditional.Cond) || containsPricingMarker(conditional.Cond) {
		return false
	}
	multiplier, multiplierOK := requestRuleNumber(conditional.Exp1)
	fallback, fallbackOK := requestRuleNumber(conditional.Exp2)
	return multiplierOK && fallbackOK && fallback == 1 && multiplier >= 0 && !math.IsNaN(multiplier) && !math.IsInf(multiplier, 0)
}

func validateDynamicFixedAmount(node ast.Node) (bool, error) {
	switch part := node.(type) {
	case *ast.IntegerNode:
		return false, nil
	case *ast.FloatNode:
		if math.IsNaN(part.Value) || math.IsInf(part.Value, 0) {
			return false, fmt.Errorf("fixed price arithmetic contains a non-finite literal")
		}
		return false, nil
	case *ast.IdentifierNode:
		if _, allowed := fixedRequestScalarIdentifiers[part.Value]; !allowed {
			return false, fmt.Errorf("fixed price arithmetic cannot reference %q", part.Value)
		}
		return true, nil
	case *ast.BinaryNode:
		switch part.Operator {
		case "+", "-", "*":
		default:
			return false, fmt.Errorf("fixed price arithmetic does not allow operator %q", part.Operator)
		}
		leftUsesScalar, err := validateDynamicFixedAmount(part.Left)
		if err != nil {
			return false, err
		}
		rightUsesScalar, err := validateDynamicFixedAmount(part.Right)
		if err != nil {
			return false, err
		}
		return leftUsesScalar || rightUsesScalar, nil
	case *ast.CallNode:
		callee, ok := part.Callee.(*ast.IdentifierNode)
		if !ok || callee.Value != "max" || len(part.Arguments) != 2 {
			return false, fmt.Errorf("fixed price arithmetic allows only max(left, right)")
		}
		leftUsesScalar, err := validateDynamicFixedAmount(part.Arguments[0])
		if err != nil {
			return false, err
		}
		rightUsesScalar, err := validateDynamicFixedAmount(part.Arguments[1])
		if err != nil {
			return false, err
		}
		return leftUsesScalar || rightUsesScalar, nil
	case *ast.BuiltinNode:
		if part.Name != "max" || len(part.Arguments) != 2 {
			return false, fmt.Errorf("fixed price arithmetic allows only max(left, right)")
		}
		leftUsesScalar, err := validateDynamicFixedAmount(part.Arguments[0])
		if err != nil {
			return false, err
		}
		rightUsesScalar, err := validateDynamicFixedAmount(part.Arguments[1])
		if err != nil {
			return false, err
		}
		return leftUsesScalar || rightUsesScalar, nil
	default:
		return false, fmt.Errorf("fixed price arithmetic contains unsupported %T", node)
	}
}

// validateFixedPricingTree enforces one pricing leaf per execution. Without
// this invariant, adding two tiers or multiplying a fixed price by tokens
// would make both the request charge and its billing-unit trace ambiguous.
func validateFixedPricingTree(node ast.Node) error {
	switch part := node.(type) {
	case *ast.ConditionalNode:
		if containsPricingMarker(part.Cond) || usesFixedRequestScalar(part.Cond) {
			break
		}
		if err := validateFixedPricingTree(part.Exp1); err != nil {
			return err
		}
		return validateFixedPricingTree(part.Exp2)
	case *ast.BinaryNode:
		if part.Operator != "*" {
			break
		}
		if isRequestPriceMultiplier(part.Right) {
			return validateFixedPricingTree(part.Left)
		}
		if isRequestPriceMultiplier(part.Left) {
			return validateFixedPricingTree(part.Right)
		}
	case *ast.CallNode:
		callee, ok := part.Callee.(*ast.IdentifierNode)
		if !ok || callee.Value != "tier" || len(part.Arguments) != 2 || containsPricingMarker(part.Arguments[0]) {
			break
		}
		price := part.Arguments[1]
		fixed, ok := price.(*ast.CallNode)
		if ok {
			function, direct := fixed.Callee.(*ast.IdentifierNode)
			if direct && function.Value == "fixed" && len(fixed.Arguments) == 1 {
				amount, literal := requestRuleNumber(fixed.Arguments[0])
				if literal && amount >= 0 && !math.IsNaN(amount) && !math.IsInf(amount*1_000_000, 0) {
					return nil
				}
				usesScalar, err := validateDynamicFixedAmount(fixed.Arguments[0])
				if err == nil && usesScalar {
					return nil
				}
				if err != nil {
					return err
				}
				return fmt.Errorf("fixed price must be a finite, non-negative numeric literal with a finite v1 value")
			}
		}
		if !containsPricingMarker(price) {
			if usesFixedRequestScalar(price) {
				return fmt.Errorf("request billing scalars are allowed only inside fixed price amounts")
			}
			return nil
		}
	}
	return fmt.Errorf("fixed pricing requires tier(name, fixed(amount)) leaves, conditional tiers and request multipliers; token and fixed charges cannot be combined in one leaf")
}
