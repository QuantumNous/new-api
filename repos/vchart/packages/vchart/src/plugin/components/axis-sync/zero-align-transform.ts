import { isValidNumber, last } from '@visactor/vutils';
import type { CartesianAxis } from '../../../component';
import type { LinearAxisMixin } from '../../../component/axis/mixin/linear-axis-mixin';

type ScaleInfo = {
  total: number;
  negative: number;
  positive: number;
  includeZero: boolean;
  extendable_min: boolean;
  extendable_max: boolean;
  domain: number[];
  break?: boolean;
};

export function isValidAlignDomain(domain: number[]): boolean {
  return domain.length >= 2 && isValidNumber(domain[0]) && isValidNumber(last(domain)) && last(domain) >= domain[0];
}

export function getScaleInfo(axis: LinearAxisMixin, domain: number[]): ScaleInfo {
  // example: -10 -20 total = 10 negative = 10
  const total = last(domain) - domain[0];
  const includeZero = last(domain) * domain[0] < 0;
  let negative = domain[0] <= 0 ? 0 - domain[0] : 0;
  let positive = last(domain) > 0 ? last(domain) - 0 : 0;
  if (total === 0) {
    if (domain[0] < 0) {
      negative = 1;
      positive = 0;
    } else if (domain[0] > 0) {
      negative = 0;
      positive = 1;
    }
  } else {
    negative = negative / total;
    positive = positive / total;
  }
  const domainSpec = axis.getDomainSpec();
  const result: ScaleInfo = {
    total,
    negative,
    positive,
    includeZero,
    domain,
    extendable_min: !isValidNumber(domainSpec.min),
    extendable_max: !isValidNumber(domainSpec.max)
  };
  if (axis._break?.scope) {
    // 当前轴有截断
    const index = domain.findIndex(value => value >= 0);

    let scope;
    let domainTemp;
    // 得到0值位置
    if (index === 0) {
      scope = axis._break.scope[index];
      domainTemp = [domain[0], domain[1]];
      result.positive = 1;
      result.negative = 0;
    } else {
      // 如果最大值小于 0
      if (last(domain) <= 0) {
        result.positive = 0;
        result.negative = 1;
        domainTemp = [domain[domain.length - 2], domain[domain.length - 1]];
      } else {
        // 0值在中间
        scope = axis._break.scope[index - 1];
        domainTemp = [domain[index - 1], domain[index]];
        // 得到0值在range中的实际比例
        result.negative = scope[0] + ((0 - domainTemp[0]) / (domainTemp[1] - domainTemp[0])) * (scope[1] - scope[0]);
        result.positive = 1 - result.negative;
      }
    }
    // 只要有截断，就不做domain修改
    result.break = true;
    result.extendable_max = false;
    result.extendable_min = false;
    result.domain = domainTemp;
  }
  return result;
}

function inDifferentCrossZero(info1: ScaleInfo, info2: ScaleInfo): boolean {
  const {
    positive: positive1,
    negative: negative1,
    extendable_min: s1Extendable_min,
    extendable_max: s1Extendable_max,
    domain: domain1
  } = info1;
  const {
    positive: positive2,
    negative: negative2,
    extendable_min: s2Extendable_min,
    extendable_max: s2Extendable_max,
    domain: domain2
  } = info2;
  //  make s2 percent same as s1
  if (positive2 > 0) {
    if (!s2Extendable_min) {
      return false;
    }
    let comp = negative1 / positive1;
    // if s1 could extend max, then expand s1
    // example:【0.5，0.5】 + 【0，1】 = 【0.5，1】
    if (s1Extendable_max) {
      // change s1 percent
      comp = negative1 / Math.max(positive1, positive2);
      domain1[1] = -domain1[0] / comp;
    }
    domain2[0] = -domain2[1] * comp;
  } else if (negative2 > 0) {
    if (!s2Extendable_max) {
      return false;
    }
    let comp = positive1 / negative1;
    // if s1 could extend max, then expand s1
    // example:【0.5，0.5】 + 【1，0】 = 【1，0.5】
    if (s1Extendable_min) {
      // change s1 percent
      comp = positive1 / Math.max(negative1, negative1);
      domain1[0] = -domain1[1] / comp;
    }
    domain2[1] = -domain2[0] * comp;
  }
  return true;
}

function inOnlyZeroDomain(info1: ScaleInfo, info2: ScaleInfo): boolean {
  const { extendable_min: s1Extendable_min, extendable_max: s1Extendable_max, domain: domain1 } = info1;
  const { positive: positive2, negative: negative2, domain: domain2 } = info2;
  // both [0,0]
  if (positive2 === 0 && negative2 === 0) {
    return false;
  }
  // 如果副轴 有正值部分  主轴无法正值扩展，跳过
  if (positive2 > 0 && !s1Extendable_max) {
    return false;
  }
  // 如果副轴 有负值部分  主轴无法负值扩展，跳过
  if (negative2 > 0 && !s1Extendable_min) {
    return false;
  }
  // 其他场景，将主轴设置为与副轴相同
  domain1[0] = domain2[0];
  domain1[1] = domain2[1];
  return true;
}

function inAllCrossZero(info1: ScaleInfo, info2: ScaleInfo): boolean {
  const { positive: positive1, negative: negative1, extendable_max: s1Extendable_max, domain: domain1 } = info1;
  const { positive: positive2, negative: negative2, extendable_min: s2Extendable_min, domain: domain2 } = info2;
  if (s1Extendable_max && s2Extendable_min) {
    // percent
    const comp = Math.max(negative1, negative2) / Math.max(positive1, positive2);
    domain1[1] = -domain1[0] / comp;
    domain2[0] = -domain2[1] * comp;
  }
  // only on side extendable
  else if (s2Extendable_min) {
    const comp = negative1 / positive1;
    domain2[0] = -domain2[1] * comp;
  } else if (s1Extendable_max) {
    const comp = negative2 / positive2;
    domain1[1] = -domain1[0] / comp;
  } else {
    // skip
    return false;
  }
  return true;
}

function inNoCrossDifferentSide(info1: ScaleInfo, info2: ScaleInfo): boolean {
  const { extendable_min: s1Extendable_min, domain: domain1 } = info1;
  const { extendable_max: s2Extendable_max, domain: domain2 } = info2;
  // extendable
  if (!s1Extendable_min || !s2Extendable_max) {
    return false;
  }
  domain1[0] = -domain1[1];
  domain2[1] = -domain2[0];
  return true;
}

export const zeroAlign = (targetAxis: CartesianAxis, currentAxis: CartesianAxis) => {
  const s1 = targetAxis.getScale();
  const s2 = currentAxis.getScale();

  if (!s1 || !s2) {
    return;
  }

  const domain1 = (targetAxis as any).getDomainAfterSpec?.() ?? [0, 1];
  const domain2 = (currentAxis as any).getDomainAfterSpec?.() ?? [0, 1];

  if (!domain1 || !domain2 || !isValidAlignDomain(domain1) || !isValidAlignDomain(domain2)) {
    return;
  }

  // 先分别获取正负比例
  const info1 = getScaleInfo(<LinearAxisMixin>(<unknown>targetAxis), domain1);
  const info2 = getScaleInfo(<LinearAxisMixin>(<unknown>currentAxis), domain2);
  if (info1.break === true && info2.break === true) {
    return;
  }
  const {
    positive: positive1,
    negative: negative1,
    extendable_min: s1Extendable_min,
    extendable_max: s1Extendable_max,
    includeZero: includeZero1
  } = info1;
  const {
    positive: positive2,
    negative: negative2,
    extendable_min: s2Extendable_min,
    extendable_max: s2Extendable_max,
    includeZero: includeZero2
  } = info2;

  // first check [0,0]
  // axis 1 in [0,0]
  if (positive1 === 0 && negative1 === 0) {
    if (!inOnlyZeroDomain(info1, info2)) {
      return;
    }
  }
  // axis 2 in [0,0]
  else if (positive2 === 0 && negative2 === 0) {
    if (!inOnlyZeroDomain(info2, info1)) {
      return;
    }
  }
  // check of both of axis are not cross zero
  else if (!includeZero1 && !includeZero2) {
    // if in different side s1 * s2 < 0
    // s1 > 0 s2 < 0
    if (negative1 === 0 && positive2 === 0) {
      if (!inNoCrossDifferentSide(info1, info2)) {
        return;
      }
    }
    // s1 < 0 s2 > 0
    else if (negative2 === 0 && positive1 === 0) {
      if (!inNoCrossDifferentSide(info2, info1)) {
        return;
      }
    }

    // if in same side s1 * s2 > 0
    // both positive
    if (negative1 === 0 && negative2 === 0) {
      // make sure has zero
      if (domain1[0] === 0 && domain2[0] > 0) {
        if (!s2Extendable_min) {
          return;
        }
        domain2[0] = 0;
      } else if (domain2[0] === 0 && domain1[0] > 0) {
        if (!s1Extendable_min) {
          return;
        }
        domain1[0] = 0;
      } else {
        return;
      }
    }
    // both negative1
    if (positive1 === 0 && positive2 === 0) {
      // s1 has 0 in domain & s2 has not
      if (domain1[1] === 0 && domain2[1] > 0) {
        if (!s2Extendable_max) {
          return;
        }
        domain2[1] = 0;
      }
      // s2 has 0 in domain & s1 has not
      else if (domain2[1] === 0 && domain1[1] > 0) {
        if (!s1Extendable_max) {
          return;
        }
        domain1[1] = 0;
      } else {
        return;
      }
    }
  }
  // check one axis cross zero axis1
  else if (includeZero1 && !includeZero2) {
    if (!inDifferentCrossZero(info1, info2)) {
      return;
    }
  }
  // check one axis cross zero axis2
  else if (includeZero2 && !includeZero1) {
    if (!inDifferentCrossZero(info2, info1)) {
      return;
    }
  }
  // check of both of axis are cross zero
  else {
    // same percent of negative
    if (negative1 === negative2) {
      return;
    }
    // negative percent s1 > s2
    else if (negative1 > negative2) {
      if (!inAllCrossZero(info1, info2)) {
        return;
      }
    }
    // negative percent s1 < s2
    else {
      if (!inAllCrossZero(info2, info1)) {
        return;
      }
    }
  }
  s1.domain(domain1);
  s2.domain(domain2);
};
