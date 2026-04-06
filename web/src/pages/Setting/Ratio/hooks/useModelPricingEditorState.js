import { useEffect, useMemo, useState } from 'react';
import { API, showError, showSuccess } from '../../../../helpers';

export const PAGE_SIZE = 10;
export const PRICE_SUFFIX = '$/1M tokens';
const EMPTY_CANDIDATE_MODEL_NAMES = [];
const TIER_BASIS_PROMPT_TOKENS = 'prompt_tokens';

const EMPTY_MODEL = {
  name: '',
  billingMode: 'per-token',
  fixedPrice: '',
  inputPrice: '',
  completionPrice: '',
  lockedCompletionRatio: '',
  completionRatioLocked: false,
  cachePrice: '',
  createCachePrice: '',
  imagePrice: '',
  audioInputPrice: '',
  audioOutputPrice: '',
  tierPricingEnabled: false,
  tierPricingBasis: TIER_BASIS_PROMPT_TOKENS,
  tierPricingTiers: [],
  rawRatios: {
    modelRatio: '',
    completionRatio: '',
    cacheRatio: '',
    createCacheRatio: '',
    imageRatio: '',
    audioRatio: '',
    audioCompletionRatio: '',
  },
  hasConflict: false,
};

const NUMERIC_INPUT_REGEX = /^(\d+(\.\d*)?|\.\d*)?$/;

export const hasValue = (value) =>
  value !== '' && value !== null && value !== undefined && value !== false;

const toNumericString = (value) => {
  if (!hasValue(value) && value !== 0) {
    return '';
  }
  const num = Number(value);
  return Number.isFinite(num) ? String(num) : '';
};

const toNumberOrNull = (value) => {
  if (!hasValue(value) && value !== 0) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const isNonNegativeInteger = (value) =>
  Number.isInteger(value) && value >= 0;

const formatNumber = (value) => {
  const num = toNumberOrNull(value);
  if (num === null) {
    return '';
  }
  return parseFloat(num.toFixed(12)).toString();
};

const toNormalizedNumber = (value) => {
  const formatted = formatNumber(value);
  return formatted === '' ? null : Number(formatted);
};

const parseOptionJSON = (rawValue) => {
  if (!rawValue || rawValue.trim() === '') {
    return {};
  }
  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('JSON解析错误:', error);
    return {};
  }
};

const ratioToBasePrice = (ratio) => {
  const num = toNumberOrNull(ratio);
  if (num === null) return '';
  return formatNumber(num * 2);
};

const normalizeCompletionRatioMeta = (rawMeta) => {
  if (!rawMeta || typeof rawMeta !== 'object' || Array.isArray(rawMeta)) {
    return {
      locked: false,
      ratio: '',
    };
  }

  return {
    locked: Boolean(rawMeta.locked),
    ratio: toNumericString(rawMeta.ratio),
  };
};

const normalizeTierPricingConfig = (rawConfig) => {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
    return {
      enabled: false,
      basis: TIER_BASIS_PROMPT_TOKENS,
      tiers: [],
    };
  }

  const tiers = Array.isArray(rawConfig.tiers)
    ? rawConfig.tiers.map((tier) => ({
        minTokens: toNumericString(tier?.min_tokens),
        maxTokens: hasValue(tier?.max_tokens)
          ? toNumericString(tier.max_tokens)
          : '',
        inputPrice: toNumericString(tier?.input_price),
        completionPrice: toNumericString(tier?.completion_price),
        cacheReadPrice: toNumericString(tier?.cache_read_price),
      }))
    : [];

  return {
    enabled: Boolean(rawConfig.enabled),
    basis:
      rawConfig.basis === TIER_BASIS_PROMPT_TOKENS
        ? rawConfig.basis
        : TIER_BASIS_PROMPT_TOKENS,
    tiers,
  };
};

const getTierReferenceInputPrice = (model) =>
  toNumberOrNull(model?.tierPricingTiers?.[0]?.inputPrice);

const getExtensionReferenceInputPrice = (model) => {
  if (model?.tierPricingEnabled) {
    return getTierReferenceInputPrice(model);
  }
  return toNumberOrNull(model?.inputPrice);
};

const buildDefaultTierRowFromModel = (model) => ({
  minTokens: '0',
  maxTokens: '',
  inputPrice: model?.inputPrice || '',
  completionPrice: model?.completionPrice || '',
  cacheReadPrice: model?.cachePrice || '',
});

const sortTierRows = (tiers) =>
  [...tiers].sort((left, right) => {
    const leftMin = toNumberOrNull(left.minTokens);
    const rightMin = toNumberOrNull(right.minTokens);
    if (leftMin === null && rightMin === null) return 0;
    if (leftMin === null) return 1;
    if (rightMin === null) return -1;
    return leftMin - rightMin;
  });

export const breakpointsFromTiers = (tiers) => {
  if (!Array.isArray(tiers) || tiers.length === 0) return [];
  const sorted = sortTierRows(tiers);
  return sorted
    .filter((tier) => hasValue(tier.maxTokens))
    .map((tier) => Number(tier.maxTokens));
};

const tiersFromBreakpoints = (breakpoints, existingTiers) => {
  const sorted = [...breakpoints].sort((a, b) => a - b);
  const boundaries = [0, ...sorted];
  const newTiers = [];
  for (let i = 0; i < boundaries.length; i++) {
    const min = boundaries[i];
    const max = i < sorted.length ? sorted[i] : null;
    const existing = (existingTiers || []).find(
      (t) =>
        toNumberOrNull(t.minTokens) === min &&
        (max === null
          ? !hasValue(t.maxTokens)
          : toNumberOrNull(t.maxTokens) === max),
    );
    if (existing) {
      newTiers.push({ ...existing });
      continue;
    }
    const overlapping = (existingTiers || []).find(
      (t) => toNumberOrNull(t.minTokens) === min,
    );
    if (overlapping) {
      newTiers.push({
        ...overlapping,
        minTokens: String(min),
        maxTokens: max !== null ? String(max) : '',
      });
      continue;
    }
    const prevTier = i > 0 ? newTiers[i - 1] : null;
    newTiers.push({
      minTokens: String(min),
      maxTokens: max !== null ? String(max) : '',
      inputPrice: prevTier?.inputPrice || '',
      completionPrice: prevTier?.completionPrice || '',
      cacheReadPrice: prevTier?.cacheReadPrice || '',
    });
  }
  return newTiers;
};

const syncBasePricingFromFirstTier = (model) => {
  const firstTier = model?.tierPricingTiers?.[0];
  if (!firstTier) {
    return model;
  }
  return {
    ...model,
    inputPrice: firstTier.inputPrice ?? '',
    completionPrice: firstTier.completionPrice ?? '',
    cachePrice: firstTier.cacheReadPrice ?? '',
  };
};

const buildModelState = (name, sourceMaps) => {
  const modelRatio = toNumericString(sourceMaps.ModelRatio[name]);
  const completionRatio = toNumericString(sourceMaps.CompletionRatio[name]);
  const completionRatioMeta = normalizeCompletionRatioMeta(
    sourceMaps.CompletionRatioMeta?.[name],
  );
  const cacheRatio = toNumericString(sourceMaps.CacheRatio[name]);
  const createCacheRatio = toNumericString(sourceMaps.CreateCacheRatio[name]);
  const imageRatio = toNumericString(sourceMaps.ImageRatio[name]);
  const audioRatio = toNumericString(sourceMaps.AudioRatio[name]);
  const audioCompletionRatio = toNumericString(
    sourceMaps.AudioCompletionRatio[name],
  );
  const fixedPrice = toNumericString(sourceMaps.ModelPrice[name]);
  const tierPricingConfig = normalizeTierPricingConfig(
    sourceMaps.ModelTierPricing?.[name],
  );
  const tierReferenceInputPrice = toNumberOrNull(
    tierPricingConfig.tiers[0]?.inputPrice,
  );
  const inputPrice = ratioToBasePrice(modelRatio) || tierPricingConfig.tiers[0]?.inputPrice || '';
  const completionPriceFromRatio =
    inputPrice !== '' &&
    hasValue(
      completionRatioMeta.locked ? completionRatioMeta.ratio : completionRatio,
    )
      ? formatNumber(
          Number(inputPrice) *
            Number(
              completionRatioMeta.locked
                ? completionRatioMeta.ratio
                : completionRatio,
            ),
        )
      : tierPricingConfig.tiers[0]?.completionPrice || '';
  const cachePriceFromRatio =
    inputPrice !== '' && hasValue(cacheRatio)
      ? formatNumber(Number(inputPrice) * Number(cacheRatio))
      : tierPricingConfig.tiers[0]?.cacheReadPrice || '';
  const extensionInputPriceNumber =
    tierReferenceInputPrice !== null ? tierReferenceInputPrice : toNumberOrNull(inputPrice);
  const audioInputPrice =
    extensionInputPriceNumber !== null && hasValue(audioRatio)
      ? formatNumber(extensionInputPriceNumber * Number(audioRatio))
      : '';

  return {
    ...EMPTY_MODEL,
    name,
    billingMode: hasValue(fixedPrice) ? 'per-request' : 'per-token',
    fixedPrice,
    inputPrice,
    tierPricingEnabled: tierPricingConfig.enabled,
    tierPricingBasis: tierPricingConfig.basis,
    tierPricingTiers: tierPricingConfig.tiers,
    completionRatioLocked: completionRatioMeta.locked,
    lockedCompletionRatio: completionRatioMeta.ratio,
    completionPrice: completionPriceFromRatio,
    cachePrice: cachePriceFromRatio,
    createCachePrice:
      extensionInputPriceNumber !== null && hasValue(createCacheRatio)
        ? formatNumber(extensionInputPriceNumber * Number(createCacheRatio))
        : '',
    imagePrice:
      extensionInputPriceNumber !== null && hasValue(imageRatio)
        ? formatNumber(extensionInputPriceNumber * Number(imageRatio))
        : '',
    audioInputPrice,
    audioOutputPrice:
      toNumberOrNull(audioInputPrice) !== null && hasValue(audioCompletionRatio)
        ? formatNumber(Number(audioInputPrice) * Number(audioCompletionRatio))
        : '',
    rawRatios: {
      modelRatio,
      completionRatio,
      cacheRatio,
      createCacheRatio,
      imageRatio,
      audioRatio,
      audioCompletionRatio,
    },
    hasConflict:
      hasValue(fixedPrice) &&
      [
        modelRatio,
        completionRatio,
        cacheRatio,
        createCacheRatio,
        imageRatio,
        audioRatio,
        audioCompletionRatio,
      ].some(hasValue),
  };
};

export const isBasePricingUnset = (model) => {
  if (model.billingMode === 'per-request') {
    return !hasValue(model.fixedPrice);
  }
  if (model.tierPricingEnabled && model.tierPricingTiers.length > 0) {
    return false;
  }
  return !hasValue(model.inputPrice);
};

export const getModelWarnings = (model, t) => {
  if (!model) {
    return [];
  }
  const warnings = [];
  const hasDerivedPricing = [
    model.inputPrice,
    model.completionPrice,
    model.cachePrice,
    model.createCachePrice,
    model.imagePrice,
    model.audioInputPrice,
    model.audioOutputPrice,
  ].some(hasValue);

  if (model.hasConflict) {
    warnings.push(
      t('当前模型同时存在按次价格和倍率配置，保存时会按当前计费方式覆盖。'),
    );
  }

  if (
    model.tierPricingEnabled &&
    [
      model.rawRatios.modelRatio,
      model.rawRatios.completionRatio,
      model.rawRatios.cacheRatio,
    ].some(hasValue)
  ) {
    warnings.push(
      t('开启阶梯定价后，文本主价格将改为写入 ModelTierPricing，不再保留旧的平面基础倍率。'),
    );
  }

  if (model.completionRatioLocked && model.tierPricingEnabled) {
    warnings.push(
      t('该模型补全倍率由后端锁定，不支持阶梯定价；请关闭阶梯定价后再保存。'),
    );
  }

  if (
    !hasValue(model.inputPrice) &&
    !model.tierPricingEnabled &&
    [
      model.rawRatios.completionRatio,
      model.rawRatios.cacheRatio,
      model.rawRatios.createCacheRatio,
      model.rawRatios.imageRatio,
      model.rawRatios.audioRatio,
      model.rawRatios.audioCompletionRatio,
    ].some(hasValue)
  ) {
    warnings.push(
      t(
        '当前模型存在未显式设置输入倍率的扩展倍率；填写输入价格后会自动换算为价格字段。',
      ),
    );
  }

  if (
    model.billingMode === 'per-token' &&
    !model.tierPricingEnabled &&
    hasDerivedPricing &&
    !hasValue(model.inputPrice)
  ) {
    warnings.push(t('按量计费下需要先填写输入价格，才能保存其它价格项。'));
  }

  if (
    model.billingMode === 'per-token' &&
    hasValue(model.audioOutputPrice) &&
    !hasValue(model.audioInputPrice)
  ) {
    warnings.push(t('填写音频补全价格前，需要先填写音频输入价格。'));
  }

  if (
    model.tierPricingEnabled &&
    [
      model.createCachePrice,
      model.imagePrice,
      model.audioInputPrice,
      model.audioOutputPrice,
    ].some(hasValue)
  ) {
    warnings.push(
      t('非阶梯扩展价格会按第一档输入价格换算为全局倍率，命中更高阶梯时实际价格会随输入单价等比例变化。'),
    );
  }

  return warnings;
};

const formatCompactTokenCount = (value) => {
  const num = toNumberOrNull(value);
  if (num === null) return '-';
  if (num >= 1000 && num % 1000 === 0) {
    return `${num / 1000}k`;
  }
  return String(num);
};

const buildTierRangeLabel = (tier) => {
  const minLabel = formatCompactTokenCount(tier?.minTokens);
  if (!hasValue(tier?.maxTokens)) {
    return `>= ${minLabel}`;
  }
  return `${minLabel} <= x < ${formatCompactTokenCount(tier.maxTokens)}`;
};

const buildTierSummaryText = (model, t) => {
  if (!model.tierPricingEnabled || model.tierPricingTiers.length === 0) {
    return '';
  }
  const ranges = model.tierPricingTiers.map(buildTierRangeLabel).join(' / ');
  return `${t('阶梯定价')} ${model.tierPricingTiers.length}${t('档')} ${ranges}`;
};

export const buildSummaryText = (model, t) => {
  if (model.billingMode === 'per-request' && hasValue(model.fixedPrice)) {
    return `${t('按次')} $${model.fixedPrice} / ${t('次')}`;
  }

  if (model.tierPricingEnabled && model.tierPricingTiers.length > 0) {
    const extraCount = [
      model.createCachePrice,
      model.imagePrice,
      model.audioInputPrice,
      model.audioOutputPrice,
    ].filter(hasValue).length;
    const extraLabel =
      extraCount > 0 ? `，${t('额外价格项')} ${extraCount}` : '';
    return `${buildTierSummaryText(model, t)}${extraLabel}`;
  }

  if (hasValue(model.inputPrice)) {
    const extraCount = [
      model.completionPrice,
      model.cachePrice,
      model.createCachePrice,
      model.imagePrice,
      model.audioInputPrice,
      model.audioOutputPrice,
    ].filter(hasValue).length;
    const extraLabel =
      extraCount > 0 ? `，${t('额外价格项')} ${extraCount}` : '';
    return `${t('输入')} $${model.inputPrice}${extraLabel}`;
  }

  return t('未设置价格');
};

export const buildOptionalFieldToggles = (model) => ({
  completionPrice:
    !model.tierPricingEnabled &&
    (model.completionRatioLocked || hasValue(model.completionPrice)),
  cachePrice: !model.tierPricingEnabled && hasValue(model.cachePrice),
  createCachePrice: hasValue(model.createCachePrice),
  imagePrice: hasValue(model.imagePrice),
  audioInputPrice: hasValue(model.audioInputPrice),
  audioOutputPrice: hasValue(model.audioOutputPrice),
});

const validateAndSerializeTierPricing = (model, t) => {
  if (model.billingMode !== 'per-token' || !model.tierPricingEnabled) {
    return null;
  }

  if (model.completionRatioLocked) {
    throw new Error(
      t('模型 {{name}} 的补全倍率由后端锁定，不支持阶梯定价', {
        name: model.name,
      }),
    );
  }

  const tiers = model.tierPricingTiers.map((tier, index) => {
    const minTokens = toNumberOrNull(tier.minTokens);
    const maxTokens = hasValue(tier.maxTokens)
      ? toNumberOrNull(tier.maxTokens)
      : null;
    const inputPrice = toNumberOrNull(tier.inputPrice);
    const completionPrice = toNumberOrNull(tier.completionPrice);
    const cacheReadPrice = toNumberOrNull(tier.cacheReadPrice);

    if (minTokens === null || inputPrice === null || completionPrice === null) {
      throw new Error(
        t('模型 {{name}} 的第 {{index}} 档缺少必填字段', {
          name: model.name,
          index: index + 1,
        }),
      );
    }

    return {
      min_tokens: minTokens,
      max_tokens: maxTokens,
      input_price: inputPrice,
      completion_price: completionPrice,
      ...(cacheReadPrice !== null
        ? { cache_read_price: cacheReadPrice }
        : {}),
    };
  });

  if (model.tierPricingEnabled && tiers.length === 0) {
    throw new Error(
      t('模型 {{name}} 已开启阶梯定价，但还没有配置任何阶梯', {
        name: model.name,
      }),
    );
  }

  tiers.sort((a, b) => a.min_tokens - b.min_tokens);

  tiers.forEach((tier, index) => {
    if (
      !isNonNegativeInteger(tier.min_tokens) ||
      (tier.max_tokens !== null && !isNonNegativeInteger(tier.max_tokens))
    ) {
      throw new Error(
        t('模型 {{name}} 的阶梯 tokens 必须是非负整数', {
          name: model.name,
        }),
      );
    }
    if (tier.min_tokens < 0) {
      throw new Error(
        t('模型 {{name}} 的第 {{index}} 档最小输入 tokens 不能小于 0', {
          name: model.name,
          index: index + 1,
        }),
      );
    }
    if (index === 0 && tier.min_tokens !== 0) {
      throw new Error(
        t('模型 {{name}} 的第一档必须从 0 开始', { name: model.name }),
      );
    }
    if (tier.input_price < 0 || tier.completion_price < 0) {
      throw new Error(
        t('模型 {{name}} 的阶梯价格不能为负数', { name: model.name }),
      );
    }
    if (hasValue(tier.cache_read_price) && tier.cache_read_price < 0) {
      throw new Error(
        t('模型 {{name}} 的缓存读取价格不能为负数', { name: model.name }),
      );
    }
    if (
      tier.input_price === 0 &&
      (tier.completion_price !== 0 ||
        (hasValue(tier.cache_read_price) && tier.cache_read_price !== 0))
    ) {
      throw new Error(
        t('模型 {{name}} 的某个阶梯输入价格为 0 时，输出和缓存读取价格也必须为 0', {
          name: model.name,
        }),
      );
    }
    if (tier.max_tokens !== null && tier.max_tokens <= tier.min_tokens) {
      throw new Error(
        t('模型 {{name}} 的第 {{index}} 档最大输入 tokens 必须大于最小值', {
          name: model.name,
          index: index + 1,
        }),
      );
    }
    if (index < tiers.length - 1) {
      if (tier.max_tokens === null) {
        throw new Error(
          t('模型 {{name}} 只有最后一档可以不填写最大值', {
            name: model.name,
          }),
        );
      }
      if (tiers[index + 1].min_tokens !== tier.max_tokens) {
        throw new Error(
          t('模型 {{name}} 的阶梯必须连续且不能重叠', { name: model.name }),
        );
      }
    } else if (tier.max_tokens !== null) {
      throw new Error(
        t('模型 {{name}} 的最后一档最大值必须留空，表示无上限', {
          name: model.name,
        }),
      );
    }
  });

  return {
    enabled: model.tierPricingEnabled,
    basis: TIER_BASIS_PROMPT_TOKENS,
    tiers,
  };
};

const serializeModel = (model, t) => {
  const result = {
    ModelTierPricing: null,
    ModelPrice: null,
    ModelRatio: null,
    CompletionRatio: null,
    CacheRatio: null,
    CreateCacheRatio: null,
    ImageRatio: null,
    AudioRatio: null,
    AudioCompletionRatio: null,
  };

  if (model.billingMode === 'per-request') {
    if (hasValue(model.fixedPrice)) {
      result.ModelPrice = toNormalizedNumber(model.fixedPrice);
    }
    return result;
  }

  result.ModelTierPricing = validateAndSerializeTierPricing(model, t);

  const inputPrice = model.tierPricingEnabled
    ? getTierReferenceInputPrice(model)
    : toNumberOrNull(model.inputPrice);
  const completionPrice = model.tierPricingEnabled
    ? null
    : toNumberOrNull(model.completionPrice);
  const cachePrice = model.tierPricingEnabled
    ? null
    : toNumberOrNull(model.cachePrice);
  const createCachePrice = toNumberOrNull(model.createCachePrice);
  const imagePrice = toNumberOrNull(model.imagePrice);
  const audioInputPrice = toNumberOrNull(model.audioInputPrice);
  const audioOutputPrice = toNumberOrNull(model.audioOutputPrice);

  const hasDependentPrice = [
    createCachePrice,
    imagePrice,
    audioInputPrice,
    audioOutputPrice,
    ...(model.tierPricingEnabled ? [] : [completionPrice, cachePrice]),
  ].some((value) => value !== null);

  if (inputPrice === null) {
    if (hasDependentPrice) {
      throw new Error(
        t(
          '模型 {{name}} 缺少参考输入价格，无法计算扩展价格对应的倍率',
          {
            name: model.name,
          },
        ),
      );
    }

    if (!model.tierPricingEnabled && hasValue(model.rawRatios.modelRatio)) {
      result.ModelRatio = toNormalizedNumber(model.rawRatios.modelRatio);
    }
    if (!model.tierPricingEnabled && hasValue(model.rawRatios.completionRatio)) {
      result.CompletionRatio = toNormalizedNumber(
        model.rawRatios.completionRatio,
      );
    }
    if (!model.tierPricingEnabled && hasValue(model.rawRatios.cacheRatio)) {
      result.CacheRatio = toNormalizedNumber(model.rawRatios.cacheRatio);
    }
    if (hasValue(model.rawRatios.createCacheRatio)) {
      result.CreateCacheRatio = toNormalizedNumber(
        model.rawRatios.createCacheRatio,
      );
    }
    if (hasValue(model.rawRatios.imageRatio)) {
      result.ImageRatio = toNormalizedNumber(model.rawRatios.imageRatio);
    }
    if (hasValue(model.rawRatios.audioRatio)) {
      result.AudioRatio = toNormalizedNumber(model.rawRatios.audioRatio);
    }
    if (hasValue(model.rawRatios.audioCompletionRatio)) {
      result.AudioCompletionRatio = toNormalizedNumber(
        model.rawRatios.audioCompletionRatio,
      );
    }
    return result;
  }

  if (!model.tierPricingEnabled) {
    result.ModelRatio = toNormalizedNumber(inputPrice / 2);

    if (!model.completionRatioLocked && completionPrice !== null) {
      result.CompletionRatio = toNormalizedNumber(completionPrice / inputPrice);
    } else if (
      model.completionRatioLocked &&
      hasValue(model.rawRatios.completionRatio)
    ) {
      result.CompletionRatio = toNormalizedNumber(
        model.rawRatios.completionRatio,
      );
    }
    if (cachePrice !== null) {
      result.CacheRatio = toNormalizedNumber(cachePrice / inputPrice);
    }
  }
  if (createCachePrice !== null && inputPrice !== 0) {
    result.CreateCacheRatio = toNormalizedNumber(createCachePrice / inputPrice);
  }
  if (imagePrice !== null && inputPrice !== 0) {
    result.ImageRatio = toNormalizedNumber(imagePrice / inputPrice);
  }
  if (audioInputPrice !== null && inputPrice !== 0) {
    result.AudioRatio = toNormalizedNumber(audioInputPrice / inputPrice);
  }
  if (audioOutputPrice !== null) {
    if (audioInputPrice === null || audioInputPrice === 0) {
      throw new Error(
        t('模型 {{name}} 缺少音频输入价格，无法计算音频补全倍率', {
          name: model.name,
        }),
      );
    }
    result.AudioCompletionRatio = toNormalizedNumber(
      audioOutputPrice / audioInputPrice,
    );
  }

  return result;
};

export const buildPreviewSections = (model, t) => {
  if (!model) return [];

  if (model.billingMode === 'per-request') {
    return [
      {
        key: 'legacy-flat-fields',
        title: t('Legacy Flat Fields'),
        rows: [
          {
            key: 'ModelPrice',
            label: 'ModelPrice',
            value: hasValue(model.fixedPrice) ? model.fixedPrice : t('空'),
          },
        ],
      },
    ];
  }

  if (model.tierPricingEnabled) {
    const referenceInputPrice = getTierReferenceInputPrice(model);
    const tierPreviewValue = JSON.stringify(
      {
        [model.name]: {
          enabled: model.tierPricingEnabled,
          basis: TIER_BASIS_PROMPT_TOKENS,
          tiers: model.tierPricingTiers.map((tier) => ({
            min_tokens: hasValue(tier.minTokens) ? Number(tier.minTokens) : null,
            max_tokens: hasValue(tier.maxTokens) ? Number(tier.maxTokens) : null,
            input_price: hasValue(tier.inputPrice) ? Number(tier.inputPrice) : null,
            completion_price: hasValue(tier.completionPrice)
              ? Number(tier.completionPrice)
              : null,
            ...(hasValue(tier.cacheReadPrice)
              ? { cache_read_price: Number(tier.cacheReadPrice) }
              : {}),
          })),
        },
      },
      null,
      2,
    );

    return [
      {
        key: 'model-tier-pricing',
        title: 'ModelTierPricing',
        code: tierPreviewValue,
      },
      {
        key: 'legacy-flat-fields',
        title: t('Legacy Flat Fields'),
        rows: [
          {
            key: 'CreateCacheRatio',
            label: 'CreateCacheRatio',
            value:
              referenceInputPrice !== null &&
              referenceInputPrice !== 0 &&
              hasValue(model.createCachePrice)
                ? formatNumber(Number(model.createCachePrice) / referenceInputPrice)
                : t('空'),
          },
          {
            key: 'ImageRatio',
            label: 'ImageRatio',
            value:
              referenceInputPrice !== null &&
              referenceInputPrice !== 0 &&
              hasValue(model.imagePrice)
                ? formatNumber(Number(model.imagePrice) / referenceInputPrice)
                : t('空'),
          },
          {
            key: 'AudioRatio',
            label: 'AudioRatio',
            value:
              referenceInputPrice !== null &&
              referenceInputPrice !== 0 &&
              hasValue(model.audioInputPrice)
                ? formatNumber(Number(model.audioInputPrice) / referenceInputPrice)
                : t('空'),
          },
          {
            key: 'AudioCompletionRatio',
            label: 'AudioCompletionRatio',
            value:
              hasValue(model.audioOutputPrice) &&
              hasValue(model.audioInputPrice) &&
              Number(model.audioInputPrice) !== 0
                ? formatNumber(
                    Number(model.audioOutputPrice) / Number(model.audioInputPrice),
                  )
                : t('空'),
          },
        ],
      },
    ];
  }

  const inputPrice = toNumberOrNull(model.inputPrice);
  if (inputPrice === null) {
    return [
      {
        key: 'legacy-flat-fields',
        title: t('Legacy Flat Fields'),
        rows: [
          {
            key: 'ModelRatio',
            label: 'ModelRatio',
            value: hasValue(model.rawRatios.modelRatio)
              ? model.rawRatios.modelRatio
              : t('空'),
          },
          {
            key: 'CompletionRatio',
            label: 'CompletionRatio',
            value: hasValue(model.rawRatios.completionRatio)
              ? model.rawRatios.completionRatio
              : t('空'),
          },
          {
            key: 'CacheRatio',
            label: 'CacheRatio',
            value: hasValue(model.rawRatios.cacheRatio)
              ? model.rawRatios.cacheRatio
              : t('空'),
          },
          {
            key: 'CreateCacheRatio',
            label: 'CreateCacheRatio',
            value: hasValue(model.rawRatios.createCacheRatio)
              ? model.rawRatios.createCacheRatio
              : t('空'),
          },
          {
            key: 'ImageRatio',
            label: 'ImageRatio',
            value: hasValue(model.rawRatios.imageRatio)
              ? model.rawRatios.imageRatio
              : t('空'),
          },
          {
            key: 'AudioRatio',
            label: 'AudioRatio',
            value: hasValue(model.rawRatios.audioRatio)
              ? model.rawRatios.audioRatio
              : t('空'),
          },
          {
            key: 'AudioCompletionRatio',
            label: 'AudioCompletionRatio',
            value: hasValue(model.rawRatios.audioCompletionRatio)
              ? model.rawRatios.audioCompletionRatio
              : t('空'),
          },
        ],
      },
    ];
  }

  const completionPrice = toNumberOrNull(model.completionPrice);
  const cachePrice = toNumberOrNull(model.cachePrice);
  const createCachePrice = toNumberOrNull(model.createCachePrice);
  const imagePrice = toNumberOrNull(model.imagePrice);
  const audioInputPrice = toNumberOrNull(model.audioInputPrice);
  const audioOutputPrice = toNumberOrNull(model.audioOutputPrice);

  return [
    {
      key: 'legacy-flat-fields',
      title: t('Legacy Flat Fields'),
      rows: [
        {
          key: 'ModelRatio',
          label: 'ModelRatio',
          value: formatNumber(inputPrice / 2),
        },
        {
          key: 'CompletionRatio',
          label: 'CompletionRatio',
          value: model.completionRatioLocked
            ? `${model.lockedCompletionRatio || t('空')} (${t('后端固定')})`
            : completionPrice !== null
              ? formatNumber(completionPrice / inputPrice)
              : t('空'),
        },
        {
          key: 'CacheRatio',
          label: 'CacheRatio',
          value:
            cachePrice !== null ? formatNumber(cachePrice / inputPrice) : t('空'),
        },
        {
          key: 'CreateCacheRatio',
          label: 'CreateCacheRatio',
          value:
            createCachePrice !== null
              ? formatNumber(createCachePrice / inputPrice)
              : t('空'),
        },
        {
          key: 'ImageRatio',
          label: 'ImageRatio',
          value:
            imagePrice !== null ? formatNumber(imagePrice / inputPrice) : t('空'),
        },
        {
          key: 'AudioRatio',
          label: 'AudioRatio',
          value:
            audioInputPrice !== null
              ? formatNumber(audioInputPrice / inputPrice)
              : t('空'),
        },
        {
          key: 'AudioCompletionRatio',
          label: 'AudioCompletionRatio',
          value:
            audioOutputPrice !== null &&
            audioInputPrice !== null &&
            audioInputPrice !== 0
              ? formatNumber(audioOutputPrice / audioInputPrice)
              : t('空'),
        },
      ],
    },
  ];
};

export function useModelPricingEditorState({
  options,
  refresh,
  t,
  candidateModelNames = EMPTY_CANDIDATE_MODEL_NAMES,
  filterMode = 'all',
}) {
  const [models, setModels] = useState([]);
  const [initialVisibleModelNames, setInitialVisibleModelNames] = useState([]);
  const [selectedModelName, setSelectedModelName] = useState('');
  const [selectedModelNames, setSelectedModelNames] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [conflictOnly, setConflictOnly] = useState(false);
  const [optionalFieldToggles, setOptionalFieldToggles] = useState({});

  useEffect(() => {
    const sourceMaps = {
      ModelPrice: parseOptionJSON(options.ModelPrice),
      ModelRatio: parseOptionJSON(options.ModelRatio),
      ModelTierPricing: parseOptionJSON(options.ModelTierPricing),
      CompletionRatio: parseOptionJSON(options.CompletionRatio),
      CompletionRatioMeta: parseOptionJSON(options.CompletionRatioMeta),
      CacheRatio: parseOptionJSON(options.CacheRatio),
      CreateCacheRatio: parseOptionJSON(options.CreateCacheRatio),
      ImageRatio: parseOptionJSON(options.ImageRatio),
      AudioRatio: parseOptionJSON(options.AudioRatio),
      AudioCompletionRatio: parseOptionJSON(options.AudioCompletionRatio),
    };

    const names = new Set([
      ...candidateModelNames,
      ...Object.keys(sourceMaps.ModelPrice),
      ...Object.keys(sourceMaps.ModelRatio),
      ...Object.keys(sourceMaps.ModelTierPricing),
      ...Object.keys(sourceMaps.CompletionRatio),
      ...Object.keys(sourceMaps.CompletionRatioMeta),
      ...Object.keys(sourceMaps.CacheRatio),
      ...Object.keys(sourceMaps.CreateCacheRatio),
      ...Object.keys(sourceMaps.ImageRatio),
      ...Object.keys(sourceMaps.AudioRatio),
      ...Object.keys(sourceMaps.AudioCompletionRatio),
    ]);

    const nextModels = Array.from(names)
      .map((name) => buildModelState(name, sourceMaps))
      .sort((a, b) => a.name.localeCompare(b.name));

    setModels(nextModels);
    setInitialVisibleModelNames(
      filterMode === 'unset'
        ? nextModels
            .filter((model) => isBasePricingUnset(model))
            .map((model) => model.name)
        : nextModels.map((model) => model.name),
    );
    setOptionalFieldToggles(
      nextModels.reduce((acc, model) => {
        acc[model.name] = buildOptionalFieldToggles(model);
        return acc;
      }, {}),
    );
    setSelectedModelName((previous) => {
      if (previous && nextModels.some((model) => model.name === previous)) {
        return previous;
      }
      const nextVisibleModels =
        filterMode === 'unset'
          ? nextModels.filter((model) => isBasePricingUnset(model))
          : nextModels;
      return nextVisibleModels[0]?.name || '';
    });
  }, [candidateModelNames, filterMode, options]);

  const visibleModels = useMemo(() => {
    return filterMode === 'unset'
      ? models.filter((model) => initialVisibleModelNames.includes(model.name))
      : models;
  }, [filterMode, initialVisibleModelNames, models]);

  const filteredModels = useMemo(() => {
    return visibleModels.filter((model) => {
      const keyword = searchText.trim().toLowerCase();
      const keywordMatch = keyword
        ? model.name.toLowerCase().includes(keyword)
        : true;
      const conflictMatch = conflictOnly ? model.hasConflict : true;
      return keywordMatch && conflictMatch;
    });
  }, [conflictOnly, searchText, visibleModels]);

  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredModels.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredModels]);

  const selectedModel = useMemo(
    () =>
      visibleModels.find((model) => model.name === selectedModelName) || null,
    [selectedModelName, visibleModels],
  );

  const selectedWarnings = useMemo(
    () => getModelWarnings(selectedModel, t),
    [selectedModel, t],
  );

  const previewSections = useMemo(
    () => buildPreviewSections(selectedModel, t),
    [selectedModel, t],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, conflictOnly, filterMode, candidateModelNames]);

  useEffect(() => {
    setSelectedModelNames((previous) =>
      previous.filter((name) =>
        visibleModels.some((model) => model.name === name),
      ),
    );
  }, [visibleModels]);

  useEffect(() => {
    if (visibleModels.length === 0) {
      setSelectedModelName('');
      return;
    }
    if (!visibleModels.some((model) => model.name === selectedModelName)) {
      setSelectedModelName(visibleModels[0].name);
    }
  }, [selectedModelName, visibleModels]);

  const upsertModel = (name, updater) => {
    setModels((previous) =>
      previous.map((model) => {
        if (model.name !== name) return model;
        return typeof updater === 'function' ? updater(model) : updater;
      }),
    );
  };

  const isOptionalFieldEnabled = (model, field) => {
    if (!model) return false;
    const modelToggles = optionalFieldToggles[model.name];
    if (modelToggles && typeof modelToggles[field] === 'boolean') {
      return modelToggles[field];
    }
    return buildOptionalFieldToggles(model)[field];
  };

  const updateOptionalFieldToggle = (modelName, field, checked) => {
    setOptionalFieldToggles((prev) => ({
      ...prev,
      [modelName]: {
        ...(prev[modelName] || {}),
        [field]: checked,
      },
    }));
  };

  const handleOptionalFieldToggle = (field, checked) => {
    if (!selectedModel) return;

    updateOptionalFieldToggle(selectedModel.name, field, checked);

    if (checked) {
      return;
    }

    upsertModel(selectedModel.name, (model) => {
      const nextModel = { ...model, [field]: '' };

      if (field === 'audioInputPrice') {
        nextModel.audioOutputPrice = '';
        setOptionalFieldToggles((prev) => ({
          ...prev,
          [selectedModel.name]: {
            ...(prev[selectedModel.name] || {}),
            audioInputPrice: false,
            audioOutputPrice: false,
          },
        }));
      }

      return nextModel;
    });
  };

  const handleTierPricingToggle = (checked) => {
    if (!selectedModel) return;
    if (checked && selectedModel.completionRatioLocked) {
      showError(t('该模型补全倍率由后端锁定，不支持阶梯定价'));
      return;
    }
    upsertModel(selectedModel.name, (model) => {
      const nextModel = {
        ...model,
        tierPricingEnabled: checked,
        tierPricingBasis: TIER_BASIS_PROMPT_TOKENS,
      };
      if (checked && nextModel.tierPricingTiers.length === 0) {
        nextModel.tierPricingTiers = [buildDefaultTierRowFromModel(model)];
      }
      if (!checked) {
        return syncBasePricingFromFirstTier(nextModel);
      }
      return nextModel;
    });
  };

  const handleTierFieldChange = (index, field, value) => {
    if (!selectedModel || !NUMERIC_INPUT_REGEX.test(value)) {
      return;
    }

    upsertModel(selectedModel.name, (model) =>
      syncBasePricingFromFirstTier({
        ...model,
        tierPricingTiers: model.tierPricingTiers.map((tier, tierIndex) =>
          tierIndex === index ? { ...tier, [field]: value } : tier,
        ),
      }),
    );
  };

  const handleAddBreakpoint = (value) => {
    if (!selectedModel) return;
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) return;
    upsertModel(selectedModel.name, (model) => {
      const existing = breakpointsFromTiers(model.tierPricingTiers);
      if (existing.includes(num)) return model;
      const nextBreakpoints = [...existing, num];
      return syncBasePricingFromFirstTier({
        ...model,
        tierPricingTiers: tiersFromBreakpoints(
          nextBreakpoints,
          model.tierPricingTiers,
        ),
      });
    });
  };

  const handleRemoveBreakpoint = (bpIndex) => {
    if (!selectedModel) return;
    upsertModel(selectedModel.name, (model) => {
      const existing = breakpointsFromTiers(model.tierPricingTiers);
      const nextBreakpoints = existing.filter((_, i) => i !== bpIndex);
      return syncBasePricingFromFirstTier({
        ...model,
        tierPricingTiers: tiersFromBreakpoints(
          nextBreakpoints,
          model.tierPricingTiers,
        ),
      });
    });
  };

  const handleEditBreakpoint = (bpIndex, newValue) => {
    if (!selectedModel) return;
    const num = Number(newValue);
    if (!Number.isInteger(num) || num <= 0) return;
    upsertModel(selectedModel.name, (model) => {
      const existing = breakpointsFromTiers(model.tierPricingTiers);
      if (existing.some((v, i) => i !== bpIndex && v === num)) return model;
      const nextBreakpoints = existing.map((v, i) => (i === bpIndex ? num : v));
      return syncBasePricingFromFirstTier({
        ...model,
        tierPricingTiers: tiersFromBreakpoints(
          nextBreakpoints,
          model.tierPricingTiers,
        ),
      });
    });
  };

  const handleSaveTierRow = (index, priceData) => {
    if (!selectedModel || index === null || index === undefined) return;
    upsertModel(selectedModel.name, (model) => {
      const nextTiers = model.tierPricingTiers.map((tier, tierIndex) =>
        tierIndex === index
          ? {
              ...tier,
              inputPrice: priceData.inputPrice,
              completionPrice: priceData.completionPrice,
              cacheReadPrice: priceData.cacheReadPrice,
            }
          : tier,
      );
      return syncBasePricingFromFirstTier({
        ...model,
        tierPricingTiers: nextTiers,
      });
    });
  };

  const fillDerivedPricesFromBase = (model, nextInputPrice) => {
    const baseNumber = toNumberOrNull(nextInputPrice);
    if (baseNumber === null) {
      return model;
    }

    return {
      ...model,
      completionPrice:
        model.completionRatioLocked && hasValue(model.lockedCompletionRatio)
          ? formatNumber(baseNumber * Number(model.lockedCompletionRatio))
          : !hasValue(model.completionPrice) &&
              hasValue(model.rawRatios.completionRatio)
            ? formatNumber(baseNumber * Number(model.rawRatios.completionRatio))
            : model.completionPrice,
      cachePrice:
        !hasValue(model.cachePrice) && hasValue(model.rawRatios.cacheRatio)
          ? formatNumber(baseNumber * Number(model.rawRatios.cacheRatio))
          : model.cachePrice,
      createCachePrice:
        !hasValue(model.createCachePrice) &&
        hasValue(model.rawRatios.createCacheRatio)
          ? formatNumber(baseNumber * Number(model.rawRatios.createCacheRatio))
          : model.createCachePrice,
      imagePrice:
        !hasValue(model.imagePrice) && hasValue(model.rawRatios.imageRatio)
          ? formatNumber(baseNumber * Number(model.rawRatios.imageRatio))
          : model.imagePrice,
      audioInputPrice:
        !hasValue(model.audioInputPrice) && hasValue(model.rawRatios.audioRatio)
          ? formatNumber(baseNumber * Number(model.rawRatios.audioRatio))
          : model.audioInputPrice,
      audioOutputPrice:
        !hasValue(model.audioOutputPrice) &&
        hasValue(model.rawRatios.audioRatio) &&
        hasValue(model.rawRatios.audioCompletionRatio)
          ? formatNumber(
              baseNumber *
                Number(model.rawRatios.audioRatio) *
                Number(model.rawRatios.audioCompletionRatio),
            )
          : model.audioOutputPrice,
    };
  };

  const handleNumericFieldChange = (field, value) => {
    if (!selectedModel || !NUMERIC_INPUT_REGEX.test(value)) {
      return;
    }

    upsertModel(selectedModel.name, (model) => {
      const updatedModel = { ...model, [field]: value };

      if (field === 'inputPrice') {
        return fillDerivedPricesFromBase(updatedModel, value);
      }

      return updatedModel;
    });
  };

  const handleBillingModeChange = (value) => {
    if (!selectedModel) return;
    upsertModel(selectedModel.name, (model) => ({
      ...model,
      billingMode: value,
      tierPricingEnabled: value === 'per-request' ? false : model.tierPricingEnabled,
    }));
  };

  const addModel = (modelName) => {
    const trimmedName = modelName.trim();
    if (!trimmedName) {
      showError(t('请输入模型名称'));
      return false;
    }
    if (models.some((model) => model.name === trimmedName)) {
      showError(t('模型名称已存在'));
      return false;
    }

    const nextModel = {
      ...EMPTY_MODEL,
      name: trimmedName,
      rawRatios: { ...EMPTY_MODEL.rawRatios },
    };

    setModels((previous) => [nextModel, ...previous]);
    setOptionalFieldToggles((prev) => ({
      ...prev,
      [trimmedName]: buildOptionalFieldToggles(nextModel),
    }));
    setSelectedModelName(trimmedName);
    setCurrentPage(1);
    return true;
  };

  const deleteModel = (name) => {
    const nextModels = models.filter((model) => model.name !== name);
    setModels(nextModels);
    setOptionalFieldToggles((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setSelectedModelNames((previous) =>
      previous.filter((item) => item !== name),
    );
    if (selectedModelName === name) {
      setSelectedModelName(nextModels[0]?.name || '');
    }
  };

  const applySelectedModelPricing = () => {
    if (!selectedModel) {
      showError(t('请先选择一个作为模板的模型'));
      return false;
    }
    if (selectedModelNames.length === 0) {
      showError(t('请先勾选需要批量设置的模型'));
      return false;
    }

    if (selectedModel.tierPricingEnabled) {
      const lockedTargets = selectedModelNames.filter((modelName) => {
        const targetModel = models.find((item) => item.name === modelName);
        return targetModel?.completionRatioLocked;
      });
      if (lockedTargets.length > 0) {
        showError(
          t('已勾选模型中包含补全倍率锁定模型，不能批量应用阶梯定价'),
        );
        return false;
      }
    }

    const sourceToggles = optionalFieldToggles[selectedModel.name] || {};

    setModels((previous) =>
      previous.map((model) => {
        if (!selectedModelNames.includes(model.name)) {
          return model;
        }

        const nextModel = {
          ...model,
          billingMode: selectedModel.billingMode,
          fixedPrice: selectedModel.fixedPrice,
          inputPrice: selectedModel.inputPrice,
          completionPrice: selectedModel.completionPrice,
          cachePrice: selectedModel.cachePrice,
          createCachePrice: selectedModel.createCachePrice,
          imagePrice: selectedModel.imagePrice,
          audioInputPrice: selectedModel.audioInputPrice,
          audioOutputPrice: selectedModel.audioOutputPrice,
          tierPricingEnabled: selectedModel.tierPricingEnabled,
          tierPricingBasis: selectedModel.tierPricingBasis,
          tierPricingTiers: selectedModel.tierPricingTiers.map((tier) => ({
            ...tier,
          })),
        };

        if (
          nextModel.billingMode === 'per-token' &&
          nextModel.completionRatioLocked &&
          hasValue(nextModel.inputPrice) &&
          hasValue(nextModel.lockedCompletionRatio)
        ) {
          nextModel.completionPrice = formatNumber(
            Number(nextModel.inputPrice) *
              Number(nextModel.lockedCompletionRatio),
          );
        }

        return nextModel;
      }),
    );

    setOptionalFieldToggles((previous) => {
      const next = { ...previous };
      selectedModelNames.forEach((modelName) => {
        const targetModel = models.find((item) => item.name === modelName);
        next[modelName] = {
          completionPrice:
            selectedModel.tierPricingEnabled
              ? false
              : targetModel?.completionRatioLocked
                ? true
                : Boolean(sourceToggles.completionPrice),
          cachePrice: selectedModel.tierPricingEnabled
            ? false
            : Boolean(sourceToggles.cachePrice),
          createCachePrice: Boolean(sourceToggles.createCachePrice),
          imagePrice: Boolean(sourceToggles.imagePrice),
          audioInputPrice: Boolean(sourceToggles.audioInputPrice),
          audioOutputPrice:
            Boolean(sourceToggles.audioInputPrice) &&
            Boolean(sourceToggles.audioOutputPrice),
        };
      });
      return next;
    });

    showSuccess(
      t('已将模型 {{name}} 的价格配置批量应用到 {{count}} 个模型', {
        name: selectedModel.name,
        count: selectedModelNames.length,
      }),
    );
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const output = {
        ModelTierPricing: {},
        ModelPrice: {},
        ModelRatio: {},
        CompletionRatio: {},
        CacheRatio: {},
        CreateCacheRatio: {},
        ImageRatio: {},
        AudioRatio: {},
        AudioCompletionRatio: {},
      };

      for (const model of models) {
        const serialized = serializeModel(model, t);
        Object.entries(serialized).forEach(([key, value]) => {
          if (value !== null) {
            output[key][model.name] = value;
          }
        });
      }

      const orderedKeys = [
        'ModelTierPricing',
        'ModelPrice',
        'ModelRatio',
        'CompletionRatio',
        'CacheRatio',
        'CreateCacheRatio',
        'ImageRatio',
        'AudioRatio',
        'AudioCompletionRatio',
      ];

      for (const key of orderedKeys) {
        const res = await API.put('/api/option/', {
          key,
          value: JSON.stringify(output[key], null, 2),
        });
        if (!res?.data?.success) {
          throw new Error(res?.data?.message || t('保存失败，请重试'));
        }
      }

      showSuccess(t('保存成功'));
      await refresh();
    } catch (error) {
      console.error('保存失败:', error);
      showError(error.message || t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return {
    models,
    selectedModel,
    selectedModelName,
    selectedModelNames,
    setSelectedModelName,
    setSelectedModelNames,
    searchText,
    setSearchText,
    currentPage,
    setCurrentPage,
    loading,
    conflictOnly,
    setConflictOnly,
    filteredModels,
    pagedData,
    selectedWarnings,
    previewSections,
    isOptionalFieldEnabled,
    handleOptionalFieldToggle,
    handleTierPricingToggle,
    handleTierFieldChange,
    handleAddBreakpoint,
    handleRemoveBreakpoint,
    handleEditBreakpoint,
    handleSaveTierRow,
    handleNumericFieldChange,
    handleBillingModeChange,
    handleSubmit,
    addModel,
    deleteModel,
    applySelectedModelPricing,
  };
}
