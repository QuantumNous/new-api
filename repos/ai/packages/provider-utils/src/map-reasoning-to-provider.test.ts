import { describe, it, expect } from 'vitest';
import type { SharedV4Warning } from '@ai-sdk/provider';
import {
  isCustomReasoning,
  mapReasoningToProviderBudget,
  mapReasoningToProviderEffort,
} from './map-reasoning-to-provider';

const effortMap = {
  minimal: 'low' as const,
  low: 'low' as const,
  medium: 'medium' as const,
  high: 'high' as const,
  xhigh: 'max' as const,
};

describe('mapReasoningToProviderEffort', () => {
  it('returns mapped value with no warning for direct match', () => {
    const warnings: SharedV4Warning[] = [];
    const result = mapReasoningToProviderEffort({
      reasoning: 'medium',
      effortMap,
      warnings,
    });
    expect(result).toBe('medium');
    expect(warnings).toEqual([]);
  });

  it('returns mapped value with compatibility warning for renamed match', () => {
    const warnings: SharedV4Warning[] = [];
    const result = mapReasoningToProviderEffort({
      reasoning: 'minimal',
      effortMap,
      warnings,
    });
    expect(result).toBe('low');
    expect(warnings).toEqual([
      {
        type: 'compatibility',
        feature: 'reasoning',
        details:
          'reasoning "minimal" is not directly supported by this model. mapped to effort "low".',
      },
    ]);
  });

  it('returns mapped value with compatibility warning for "xhigh"', () => {
    const warnings: SharedV4Warning[] = [];
    const result = mapReasoningToProviderEffort({
      reasoning: 'xhigh',
      effortMap,
      warnings,
    });
    expect(result).toBe('max');
    expect(warnings).toEqual([
      {
        type: 'compatibility',
        feature: 'reasoning',
        details:
          'reasoning "xhigh" is not directly supported by this model. mapped to effort "max".',
      },
    ]);
  });

  it('returns undefined with unsupported warning for key missing from effortMap', () => {
    const warnings: SharedV4Warning[] = [];
    const partialEffortMap = { medium: 'medium' as const };
    const result = mapReasoningToProviderEffort({
      reasoning: 'high',
      effortMap: partialEffortMap,
      warnings,
    });
    expect(result).toBeUndefined();
    expect(warnings).toEqual([
      {
        type: 'unsupported',
        feature: 'reasoning',
        details: 'reasoning "high" is not supported by this model.',
      },
    ]);
  });
});

describe('isCustomReasoning', () => {
  it('returns false for undefined', () => {
    expect(isCustomReasoning(undefined)).toBe(false);
  });

  it('returns false for provider-default', () => {
    expect(isCustomReasoning('provider-default')).toBe(false);
  });

  it('returns true for none', () => {
    expect(isCustomReasoning('none')).toBe(true);
  });

  it('returns true for all reasoning levels', () => {
    for (const value of [
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
    ] as const) {
      expect(isCustomReasoning(value)).toBe(true);
    }
  });
});

describe('mapReasoningToProviderBudget', () => {
  it('returns correct budget for known key', () => {
    const warnings: SharedV4Warning[] = [];
    const result = mapReasoningToProviderBudget({
      reasoning: 'medium',
      maxOutputTokens: 64000,
      maxReasoningBudget: 64000,
      warnings,
    });
    expect(result).toBe(19200);
    expect(warnings).toEqual([]);
  });

  it('caps result at maxReasoningBudget', () => {
    const warnings: SharedV4Warning[] = [];
    const result = mapReasoningToProviderBudget({
      reasoning: 'xhigh',
      maxOutputTokens: 64000,
      maxReasoningBudget: 50000,
      warnings,
    });
    expect(result).toBe(50000);
    expect(warnings).toEqual([]);
  });

  it('floors result at default minReasoningBudget of 1024', () => {
    const warnings: SharedV4Warning[] = [];
    const result = mapReasoningToProviderBudget({
      reasoning: 'minimal',
      maxOutputTokens: 10000,
      maxReasoningBudget: 10000,
      warnings,
    });
    expect(result).toBe(1024);
    expect(warnings).toEqual([]);
  });

  it('respects custom minReasoningBudget', () => {
    const warnings: SharedV4Warning[] = [];
    const result = mapReasoningToProviderBudget({
      reasoning: 'minimal',
      maxOutputTokens: 10000,
      maxReasoningBudget: 10000,
      minReasoningBudget: 512,
      warnings,
    });
    expect(result).toBe(512);
    expect(warnings).toEqual([]);
  });

  it('respects custom budgetPercentages', () => {
    const warnings: SharedV4Warning[] = [];
    const result = mapReasoningToProviderBudget({
      reasoning: 'medium',
      maxOutputTokens: 10000,
      maxReasoningBudget: 10000,
      budgetPercentages: { medium: 0.5 },
      warnings,
    });
    expect(result).toBe(5000);
    expect(warnings).toEqual([]);
  });

  it('returns undefined with unsupported warning for key missing from custom budgetPercentages', () => {
    const warnings: SharedV4Warning[] = [];
    const result = mapReasoningToProviderBudget({
      reasoning: 'high',
      maxOutputTokens: 64000,
      maxReasoningBudget: 64000,
      budgetPercentages: { medium: 0.5 },
      warnings,
    });
    expect(result).toBeUndefined();
    expect(warnings).toEqual([
      {
        type: 'unsupported',
        feature: 'reasoning',
        details: 'reasoning "high" is not supported by this model.',
      },
    ]);
  });
});
