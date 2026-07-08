export const VIDEO_SECONDS_CONTROLLED_TIERS = ['720p', '1080p', '2k', '4k'];
export const VIDEO_SECONDS_CONTROLLED_PRICE_KEYS = [
  'default',
  'silent',
  'audio',
];

const parseVideoSecondsPrice = (rawVideoSecondsPrice) => {
  if (!rawVideoSecondsPrice) {
    return {};
  }
  try {
    const parsed = JSON.parse(rawVideoSecondsPrice);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Failed to parse VideoSecondsPrice:', error);
    return {};
  }
};

const cloneVideoSecondsPriceMap = (map) =>
  JSON.parse(JSON.stringify(map || {}));

export function extractVideoSecondsPriceMap(rawVideoSecondsPrice) {
  const parsed = parseVideoSecondsPrice(rawVideoSecondsPrice);
  const result = {};

  Object.entries(parsed).forEach(([modelName, tierMap]) => {
    if (!tierMap || typeof tierMap !== 'object') {
      return;
    }

    const modelResult = {};
    Object.entries(tierMap).forEach(([tier, priceMap]) => {
      if (!priceMap || typeof priceMap !== 'object') {
        return;
      }
      Object.entries(priceMap).forEach(([priceKey, value]) => {
        modelResult[`${tier}_${priceKey}`] = value;
      });
    });

    if (Object.keys(modelResult).length > 0) {
      result[modelName] = modelResult;
    }
  });

  return result;
}

export function buildVideoSecondsPriceValueFromModelMap(
  rawVideoSecondsPrice,
  modelMap,
) {
  const parsed = parseVideoSecondsPrice(rawVideoSecondsPrice);
  const nextVideoSecondsPrice = cloneVideoSecondsPriceMap(parsed);

  Object.entries(modelMap || {}).forEach(([modelName, fields]) => {
    const nextModelValue = cloneVideoSecondsPriceMap(
      nextVideoSecondsPrice[modelName] || {},
    );

    VIDEO_SECONDS_CONTROLLED_TIERS.forEach((tier) => {
      const existingTierValue =
        nextModelValue[tier] && typeof nextModelValue[tier] === 'object'
          ? { ...nextModelValue[tier] }
          : {};

      VIDEO_SECONDS_CONTROLLED_PRICE_KEYS.forEach((priceKey) => {
        const fieldKey = `${tier}_${priceKey}`;
        const value = fields?.[fieldKey];

        if (value !== null && value !== undefined && value !== '') {
          existingTierValue[priceKey] = value;
        } else {
          delete existingTierValue[priceKey];
        }
      });

      if (Object.keys(existingTierValue).length > 0) {
        nextModelValue[tier] = existingTierValue;
      } else {
        delete nextModelValue[tier];
      }
    });

    if (Object.keys(nextModelValue).length > 0) {
      nextVideoSecondsPrice[modelName] = nextModelValue;
    } else {
      delete nextVideoSecondsPrice[modelName];
    }
  });

  return JSON.stringify(nextVideoSecondsPrice, null, 2);
}
