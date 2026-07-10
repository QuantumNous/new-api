/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export const PLAYGROUND_MODEL_CATEGORY_OPTIONS = [
  { label: '聊天', value: 'chat' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
];

export const DEFAULT_PLAYGROUND_ORDER_STEP = 100;
export const UNORDERED_PLAYGROUND_ORDER_BASE = 1000000;
const MIN_PLAYGROUND_ORDER_GAP = 0.000001;

export const PLAYGROUND_CATEGORY_KEYS = PLAYGROUND_MODEL_CATEGORY_OPTIONS.map(
  (item) => item.value,
);

export const PLAYGROUND_CHAT_ENDPOINT_TYPES = new Set([
  'openai',
  'openai-response',
  'openai-response-compact',
  'anthropic',
  'gemini',
]);

export const PLAYGROUND_IMAGE_MODEL_HINTS = [
  'gpt-image',
  'dall-e',
  'imagen',
  'flux',
  'recraft',
  'qwen-image',
];

export const PLAYGROUND_VIDEO_MODEL_HINTS = [
  'seedance',
  'kling',
  'veo',
  'jimeng',
  'cogvideo',
  'luma',
  'hailuo',
  'video',
];

const PLAYGROUND_CATEGORY_SET = new Set(PLAYGROUND_CATEGORY_KEYS);

const naturalCompare = (left, right) =>
  String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  });

const createEmptyOrders = () => ({
  chat: null,
  image: null,
  video: null,
});

const normalizeCategories = (categories) => {
  if (!Array.isArray(categories)) {
    return [];
  }

  return Array.from(
    new Set(
      categories
        .map((item) => String(item || '').trim().toLowerCase())
        .filter((item) => PLAYGROUND_CATEGORY_SET.has(item)),
    ),
  );
};

const parseRuleOrder = (value) => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeRuleOrders = (value = {}) => {
  const normalized = createEmptyOrders();
  const rawOrders =
    value.orders && typeof value.orders === 'object' ? value.orders : null;

  PLAYGROUND_CATEGORY_KEYS.forEach((category) => {
    normalized[category] = parseRuleOrder(rawOrders?.[category]);
  });

  const legacyOrder = parseRuleOrder(value.order);
  if (legacyOrder !== null) {
    PLAYGROUND_CATEGORY_KEYS.forEach((category) => {
      if (normalized[category] === null) {
        normalized[category] = legacyOrder;
      }
    });
  }

  return normalized;
};

const hasAnyOrderValue = (orders) =>
  PLAYGROUND_CATEGORY_KEYS.some((category) => orders?.[category] !== null);

const normalizeRuleEntry = (model, value = {}) => {
  const modelName = String(model || '').trim();
  if (!modelName) {
    return null;
  }

  const hasCategoryOverride =
    Object.prototype.hasOwnProperty.call(value, 'categories') ||
    Object.prototype.hasOwnProperty.call(value, 'category');
  const categories = normalizeCategories(value.categories || value.category);

  return {
    model: modelName,
    orders: normalizeRuleOrders(value),
    categories,
    hasCategoryOverride,
  };
};

export const getPlaygroundRuleOrder = (rule, category) => {
  if (!PLAYGROUND_CATEGORY_SET.has(category)) {
    return null;
  }
  return parseRuleOrder(rule?.orders?.[category]);
};

export const parsePlaygroundModelRules = (rawRules) => {
  if (!rawRules) {
    return [];
  }

  let parsedRules = rawRules;
  if (typeof rawRules === 'string') {
    try {
      parsedRules = JSON.parse(rawRules);
    } catch (error) {
      return [];
    }
  }

  const normalizedRules = [];

  if (Array.isArray(parsedRules)) {
    parsedRules.forEach((item) => {
      if (!item || typeof item !== 'object') {
        return;
      }
      const normalized = normalizeRuleEntry(item.model, item);
      if (normalized) {
        normalizedRules.push(normalized);
      }
    });
    return normalizedRules;
  }

  if (parsedRules && typeof parsedRules === 'object') {
    Object.entries(parsedRules).forEach(([model, value]) => {
      if (Array.isArray(value)) {
        normalizedRules.push(
          normalizeRuleEntry(model, {
            categories: value,
          }),
        );
        return;
      }

      if (value && typeof value === 'object') {
        normalizedRules.push(normalizeRuleEntry(model, value));
      }
    });
  }

  return normalizedRules.filter(Boolean);
};

export const serializePlaygroundModelRules = (rules) =>
  JSON.stringify(
    parsePlaygroundModelRules(rules)
      .map((rule) => {
        const serializedRule = {
          model: rule.model,
        };

        if (rule.hasCategoryOverride) {
          serializedRule.categories = rule.categories;
        }

        if (hasAnyOrderValue(rule.orders)) {
          serializedRule.orders = {};
          PLAYGROUND_CATEGORY_KEYS.forEach((category) => {
            const order = getPlaygroundRuleOrder(rule, category);
            if (order !== null) {
              serializedRule.orders[category] = order;
            }
          });
        }

        return serializedRule;
      })
      .sort((left, right) => naturalCompare(left.model, right.model)),
    null,
    2,
  );

export const sortModelNamesNatural = (modelNames) =>
  [...modelNames].sort(naturalCompare);

export const buildPlaygroundRuleMap = (rawRules) => {
  const ruleMap = new Map();
  parsePlaygroundModelRules(rawRules).forEach((rule) => {
    ruleMap.set(rule.model, rule);
  });
  return ruleMap;
};

export const detectAutoPlaygroundCategories = (
  modelName,
  endpointTypes = [],
) => {
  const normalizedModelName = String(modelName || '').trim().toLowerCase();
  if (!normalizedModelName) {
    return [];
  }

  const hasImageHint = PLAYGROUND_IMAGE_MODEL_HINTS.some((hint) =>
    normalizedModelName.includes(hint),
  );
  const hasVideoHint = PLAYGROUND_VIDEO_MODEL_HINTS.some((hint) =>
    normalizedModelName.includes(hint),
  );

  const categories = [];
  const normalizedEndpoints = Array.isArray(endpointTypes) ? endpointTypes : [];

  if (
    !hasImageHint &&
    !hasVideoHint &&
    normalizedEndpoints.some((endpointType) =>
      PLAYGROUND_CHAT_ENDPOINT_TYPES.has(endpointType),
    )
  ) {
    categories.push('chat');
  }

  if (hasImageHint) {
    categories.push('image');
  }

  if (hasVideoHint) {
    categories.push('video');
  }

  return categories;
};

export const getEffectivePlaygroundCategories = (
  modelName,
  endpointTypes = [],
  rawRules,
) => {
  const ruleMap =
    rawRules instanceof Map ? rawRules : buildPlaygroundRuleMap(rawRules);
  const rule = ruleMap.get(modelName);
  if (rule?.hasCategoryOverride) {
    return rule.categories;
  }
  return detectAutoPlaygroundCategories(modelName, endpointTypes);
};

export const sortPlaygroundModels = (modelNames, category, rawRules) => {
  const ruleMap =
    rawRules instanceof Map ? rawRules : buildPlaygroundRuleMap(rawRules);
  const uniqueModels = [...new Set(modelNames.filter(Boolean))];
  const naturalModels = [...uniqueModels].sort(naturalCompare);
  const fallbackOrders = new Map();

  naturalModels.forEach((modelName, index) => {
    fallbackOrders.set(
      modelName,
      UNORDERED_PLAYGROUND_ORDER_BASE + (index + 1) * DEFAULT_PLAYGROUND_ORDER_STEP,
    );
  });

  return uniqueModels.sort((left, right) => {
    const leftOrder =
      getPlaygroundRuleOrder(ruleMap.get(left), category) ??
      fallbackOrders.get(left);
    const rightOrder =
      getPlaygroundRuleOrder(ruleMap.get(right), category) ??
      fallbackOrders.get(right);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return naturalCompare(left, right);
  });
};

export const calculateInsertedOrder = ({
  orderedModels = [],
  ordersByModel = {},
  draggedModel,
  targetModel,
  position = 'before',
  step = DEFAULT_PLAYGROUND_ORDER_STEP,
  unorderedBase = UNORDERED_PLAYGROUND_ORDER_BASE,
}) => {
  const effectiveOrdersByModel = {};
  orderedModels.forEach((modelName, index) => {
    const explicitOrder = parseRuleOrder(ordersByModel[modelName]);
    effectiveOrdersByModel[modelName] =
      explicitOrder !== null ? explicitOrder : unorderedBase + (index + 1) * step;
  });

  const nextModels = orderedModels.filter((model) => model !== draggedModel);
  const targetIndex = nextModels.indexOf(targetModel);

  if (targetIndex < 0) {
    return null;
  }

  const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
  const previousModel = insertIndex > 0 ? nextModels[insertIndex - 1] : null;
  const nextModel = insertIndex < nextModels.length ? nextModels[insertIndex] : null;

  const previousOrder = parseRuleOrder(
    previousModel ? effectiveOrdersByModel[previousModel] : null,
  );
  const nextOrder = parseRuleOrder(
    nextModel ? effectiveOrdersByModel[nextModel] : null,
  );

  if (previousOrder !== null && nextOrder !== null) {
    const midpoint = (previousOrder + nextOrder) / 2;
    if (Math.abs(nextOrder - previousOrder) <= MIN_PLAYGROUND_ORDER_GAP) {
      return null;
    }
    return midpoint;
  }

  if (previousOrder !== null) {
    return previousOrder + step;
  }

  if (nextOrder !== null) {
    return nextOrder - step;
  }

  return null;
};

export const applyCategoryRebalance = ({
  rulesByModel = {},
  orderedModels = [],
  category,
  step = DEFAULT_PLAYGROUND_ORDER_STEP,
}) => {
  const nextRulesByModel = { ...rulesByModel };

  orderedModels.forEach((modelName, index) => {
    const currentRule = nextRulesByModel[modelName] || {
      orders: createEmptyOrders(),
      categories: [],
      hasCategoryOverride: false,
    };

    nextRulesByModel[modelName] = {
      ...currentRule,
      orders: {
        ...createEmptyOrders(),
        ...(currentRule.orders || {}),
        [category]: (index + 1) * step,
      },
    };
  });

  return nextRulesByModel;
};

export const buildPlaygroundModelCollections = (pricingItems, rawRules) => {
  const mergedByModel = new Map();
  const ruleMap = buildPlaygroundRuleMap(rawRules);

  (Array.isArray(pricingItems) ? pricingItems : []).forEach((item) => {
    const modelName = String(item?.model_name || '').trim();
    if (!modelName) {
      return;
    }

    const merged = mergedByModel.get(modelName) || {
      modelName,
      endpointTypes: new Set(),
    };
    const endpointTypes = Array.isArray(item?.supported_endpoint_types)
      ? item.supported_endpoint_types
      : [];
    endpointTypes.forEach((endpointType) => {
      merged.endpointTypes.add(endpointType);
    });
    mergedByModel.set(modelName, merged);
  });

  const buckets = {
    chat: [],
    image: [],
    video: [],
  };

  mergedByModel.forEach(({ modelName, endpointTypes }) => {
    const categories = getEffectivePlaygroundCategories(
      modelName,
      Array.from(endpointTypes),
      ruleMap,
    );

    categories.forEach((category) => {
      if (buckets[category]) {
        buckets[category].push(modelName);
      }
    });
  });

  return {
    chatModels: sortPlaygroundModels(buckets.chat, 'chat', ruleMap),
    imageModels: sortPlaygroundModels(buckets.image, 'image', ruleMap),
    videoModels: sortPlaygroundModels(buckets.video, 'video', ruleMap),
    ruleMap,
  };
};
