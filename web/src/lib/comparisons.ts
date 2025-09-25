/**
 * 对象比较和差异检测工具函数
 */

export interface PropertyChange {
  key: string
  oldValue: any
  newValue: any
}

/**
 * 比较两个对象的属性，找出有变化的属性
 * @param oldObject 旧对象
 * @param newObject 新对象
 * @returns 包含变化属性信息的数组
 */
export function compareObjects(
  oldObject: Record<string, any>,
  newObject: Record<string, any>
): PropertyChange[] {
  const changedProperties: PropertyChange[] = []

  // 比较两个对象的属性
  for (const key in oldObject) {
    if (oldObject.hasOwnProperty(key) && newObject.hasOwnProperty(key)) {
      if (oldObject[key] !== newObject[key]) {
        changedProperties.push({
          key: key,
          oldValue: oldObject[key],
          newValue: newObject[key],
        })
      }
    }
  }

  // 检查新对象中新增的属性
  for (const key in newObject) {
    if (newObject.hasOwnProperty(key) && !oldObject.hasOwnProperty(key)) {
      changedProperties.push({
        key: key,
        oldValue: undefined,
        newValue: newObject[key],
      })
    }
  }

  return changedProperties
}

/**
 * 深度比较两个对象是否相等
 * @param obj1 对象1
 * @param obj2 对象2
 * @returns 是否相等
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true

  if (obj1 == null || obj2 == null) return false

  if (typeof obj1 !== typeof obj2) return false

  if (typeof obj1 !== 'object') return obj1 === obj2

  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false

  const keys1 = Object.keys(obj1)
  const keys2 = Object.keys(obj2)

  if (keys1.length !== keys2.length) return false

  for (const key of keys1) {
    if (!keys2.includes(key)) return false
    if (!deepEqual(obj1[key], obj2[key])) return false
  }

  return true
}

/**
 * 获取对象的差异
 * @param source 源对象
 * @param target 目标对象
 * @returns 差异对象
 */
export function getDifference(
  source: Record<string, any>,
  target: Record<string, any>
): Record<string, any> {
  const diff: Record<string, any> = {}

  // 检查修改和新增的属性
  for (const key in target) {
    if (!deepEqual(source[key], target[key])) {
      diff[key] = target[key]
    }
  }

  // 检查删除的属性（设为undefined）
  for (const key in source) {
    if (!(key in target)) {
      diff[key] = undefined
    }
  }

  return diff
}

/**
 * 合并对象（深度合并）
 * @param target 目标对象
 * @param sources 源对象数组
 * @returns 合并后的对象
 */
export function deepMerge(target: any, ...sources: any[]): any {
  if (!sources.length) return target
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} })
        deepMerge(target[key], source[key])
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return deepMerge(target, ...sources)
}

/**
 * 检查是否为对象
 * @param item 检查项
 * @returns 是否为对象
 */
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item)
}

/**
 * 克隆对象（深度克隆）
 * @param obj 要克隆的对象
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj

  if (obj instanceof Date) return new Date(obj.getTime()) as T

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as T
  }

  if (typeof obj === 'object') {
    const cloned = {} as T
    Object.keys(obj).forEach((key) => {
      ;(cloned as any)[key] = deepClone((obj as any)[key])
    })
    return cloned
  }

  return obj
}

/**
 * 检查对象是否为空
 * @param obj 对象
 * @returns 是否为空
 */
export function isEmpty(obj: any): boolean {
  if (obj == null) return true
  if (Array.isArray(obj)) return obj.length === 0
  if (typeof obj === 'object') return Object.keys(obj).length === 0
  if (typeof obj === 'string') return obj.trim().length === 0
  return false
}

/**
 * 选择对象的特定属性
 * @param obj 源对象
 * @param keys 要选择的属性键
 * @returns 包含选定属性的新对象
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>
  keys.forEach((key) => {
    if (key in obj) {
      result[key] = obj[key]
    }
  })
  return result
}

/**
 * 省略对象的特定属性
 * @param obj 源对象
 * @param keys 要省略的属性键
 * @returns 省略指定属性后的新对象
 */
export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj } as any
  keys.forEach((key) => {
    delete result[key]
  })
  return result
}

/**
 * 扁平化嵌套对象
 * @param obj 嵌套对象
 * @param prefix 键前缀
 * @returns 扁平化后的对象
 */
export function flatten(
  obj: Record<string, any>,
  prefix: string = ''
): Record<string, any> {
  let flattened: Record<string, any> = {}

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key

      if (
        typeof obj[key] === 'object' &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        Object.assign(flattened, flatten(obj[key], newKey))
      } else {
        flattened[newKey] = obj[key]
      }
    }
  }

  return flattened
}

/**
 * 反扁平化对象
 * @param obj 扁平化的对象
 * @returns 嵌套对象
 */
export function unflatten(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {}

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const keys = key.split('.')
      let current = result

      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i]
        if (!(k in current)) {
          current[k] = {}
        }
        current = current[k]
      }

      current[keys[keys.length - 1]] = obj[key]
    }
  }

  return result
}
