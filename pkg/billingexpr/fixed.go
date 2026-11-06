package billingexpr

import (
	"fmt"
	"math"

	"github.com/expr-lang/expr/ast"
)

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
	if identifier, ok := node.(*ast.IdentifierNode); ok && (identifier.Value == "image_count" || identifier.Value == "image_input_count") {
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

func isFixedPricingLeaf(node ast.Node) bool {
	call, ok := node.(*ast.CallNode)
	if !ok || len(call.Arguments) != 2 {
		return false
	}
	tier, ok := call.Callee.(*ast.IdentifierNode)
	if !ok || tier.Value != "tier" {
		return false
	}
	fixed, ok := call.Arguments[1].(*ast.CallNode)
	if !ok || len(fixed.Arguments) != 1 {
		return false
	}
	name, ok := fixed.Callee.(*ast.IdentifierNode)
	if !ok || name.Value != "fixed" {
		return false
	}
	amount, literal := requestRuleNumber(fixed.Arguments[0])
	return literal && amount >= 0 && !math.IsNaN(amount) && !math.IsInf(amount*1_000_000, 0)
}

// validateFixedPricingSumOperand requires every branch of an operand in a
// fixed-price sum to remain request-priced. Token-priced alternatives are
// valid in a standalone conditional, but not when their result is added to a
// fixed request charge.
func validateFixedPricingSumOperand(node ast.Node) error {
	switch part := node.(type) {
	case *ast.ConditionalNode:
		if containsPricingMarker(part.Cond) {
			break
		}
		if err := validateFixedPricingSumOperand(part.Exp1); err != nil {
			return err
		}
		return validateFixedPricingSumOperand(part.Exp2)
	case *ast.BinaryNode:
		if part.Operator == "+" {
			if err := validateFixedPricingSumOperand(part.Left); err != nil {
				return err
			}
			return validateFixedPricingSumOperand(part.Right)
		}
		if part.Operator == "*" {
			if isRequestPriceMultiplier(part.Right) {
				return validateFixedPricingSumOperand(part.Left)
			}
			if isRequestPriceMultiplier(part.Left) {
				return validateFixedPricingSumOperand(part.Right)
			}
		}
	case *ast.CallNode:
		if isFixedPricingLeaf(part) {
			return nil
		}
	}
	return fmt.Errorf("fixed pricing requires fixed request-priced branches")
}

// validateFixedPricingTree enforces one pricing leaf per execution. Without
// this invariant, adding two tiers or multiplying a fixed price by tokens
// would make both the request charge and its billing-unit trace ambiguous.
func validateFixedPricingTree(node ast.Node) error {
	switch part := node.(type) {
	case *ast.ConditionalNode:
		if containsPricingMarker(part.Cond) {
			break
		}
		if err := validateFixedPricingTree(part.Exp1); err != nil {
			return err
		}
		return validateFixedPricingTree(part.Exp2)
	case *ast.BinaryNode:
		if part.Operator == "+" {
			if err := validateFixedPricingSumOperand(part.Left); err != nil {
				return err
			}
			return validateFixedPricingSumOperand(part.Right)
		}
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
				return fmt.Errorf("fixed price must be a finite, non-negative numeric literal with a finite v1 value")
			}
		}
		if !containsPricingMarker(price) {
			return nil
		}
	}
	return fmt.Errorf("fixed pricing requires tier(name, fixed(amount)) leaves, conditional tiers and request multipliers; token and fixed charges cannot be combined in one leaf")
}
