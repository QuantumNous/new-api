export type PartialArg = {
  jsonPath: string;
  stringValue?: string | null;
  numberValue?: number | null;
  boolValue?: boolean | null;
  nullValue?: unknown;
  willContinue?: boolean | null;
};

type PathSegment = string | number;

type StackEntry = {
  segment: PathSegment;
  isArray: boolean;
  childCount: number;
};

/**
 * Incrementally builds a JSON object from Google's streaming `partialArgs`
 * chunks emitted during tool-call function calling. Tracks both the structured
 * object and a running JSON text representation so callers can emit text deltas
 * that, when concatenated, form valid nested JSON matching JSON.stringify output.
 *
 * Input: [{jsonPath:"$.location",stringValue:"Boston"}]
 * Output: '{"location":"Boston"', then finalize() → closingDelta='}'
 */
export class GoogleJSONAccumulator {
  private accumulatedArgs: Record<string, unknown> = {};
  private jsonText = '';

  /**
   * Stack representing the currently "open" containers in the JSON output.
   * Entry 0 is always the root `{` object once the first value is written.
   */
  private pathStack: StackEntry[] = [];

  /**
   * Whether a string value is currently "open" (willContinue was true),
   * meaning the closing quote has not yet been emitted.
   */
  private stringOpen = false;

  /**
   * Input: [{jsonPath:"$.brightness",numberValue:50}]
   * Output: { currentJSON:{brightness:50}, textDelta:'{"brightness":50' }
   */
  processPartialArgs(partialArgs: PartialArg[]): {
    currentJSON: Record<string, unknown>;
    textDelta: string;
  } {
    let delta = '';

    for (const arg of partialArgs) {
      const rawPath = arg.jsonPath.replace(/^\$\./, '');
      if (!rawPath) continue;

      const segments = parsePath(rawPath);

      const existingValue = getNestedValue(this.accumulatedArgs, segments);
      const isStringContinuation =
        arg.stringValue != null && existingValue !== undefined;

      if (isStringContinuation) {
        const escaped = JSON.stringify(arg.stringValue).slice(1, -1);
        setNestedValue(
          this.accumulatedArgs,
          segments,
          (existingValue as string) + arg.stringValue,
        );
        delta += escaped;
        continue;
      }

      const resolved = resolvePartialArgValue(arg);
      if (resolved == null) continue;

      setNestedValue(this.accumulatedArgs, segments, resolved.value);
      delta += this.emitNavigationTo(segments, arg, resolved.json);
    }

    this.jsonText += delta;

    return {
      currentJSON: this.accumulatedArgs,
      textDelta: delta,
    };
  }

  /**
   * Input: jsonText='{"brightness":50', accumulatedArgs={brightness:50}
   * Output: { finalJSON:'{"brightness":50}', closingDelta:'}' }
   */
  finalize(): { finalJSON: string; closingDelta: string } {
    const finalArgs = JSON.stringify(this.accumulatedArgs);
    const closingDelta = finalArgs.slice(this.jsonText.length);
    return { finalJSON: finalArgs, closingDelta };
  }

  /**
   * Input: pathStack=[] (first call) or pathStack=[root,...] (subsequent calls)
   * Output: '{' (first call) or '' (subsequent calls)
   */
  private ensureRoot(): string {
    if (this.pathStack.length === 0) {
      this.pathStack.push({ segment: '', isArray: false, childCount: 0 });
      return '{';
    }
    return '';
  }

  /**
   * Emits the JSON text fragment needed to navigate from the current open
   * path to the new leaf at `targetSegments`, then writes the value.
   *
   * Input: targetSegments=["recipe","name"], arg={jsonPath:"$.recipe.name",stringValue:"Lasagna"}, valueJson='"Lasagna"'
   * Output: '{"recipe":{"name":"Lasagna"'
   */
  private emitNavigationTo(
    targetSegments: PathSegment[],
    arg: PartialArg,
    valueJson: string,
  ): string {
    let fragment = '';

    if (this.stringOpen) {
      fragment += '"';
      this.stringOpen = false;
    }

    fragment += this.ensureRoot();

    const targetContainerSegments = targetSegments.slice(0, -1);
    const leafSegment = targetSegments[targetSegments.length - 1];

    const commonDepth = this.findCommonStackDepth(targetContainerSegments);

    fragment += this.closeDownTo(commonDepth);
    fragment += this.openDownTo(targetContainerSegments, leafSegment);
    fragment += this.emitLeaf(leafSegment, arg, valueJson);

    return fragment;
  }

  /**
   * Returns the stack depth to preserve when navigating to a new target
   * container path. Always >= 1 (the root is never popped).
   *
   * Input: stack=[root,"recipe","ingredients",0], target=["recipe","ingredients",1]
   * Output: 3 (keep root+"recipe"+"ingredients")
   */
  private findCommonStackDepth(targetContainer: PathSegment[]): number {
    const maxDepth = Math.min(
      this.pathStack.length - 1,
      targetContainer.length,
    );
    let common = 0;
    for (let i = 0; i < maxDepth; i++) {
      if (this.pathStack[i + 1].segment === targetContainer[i]) {
        common++;
      } else {
        break;
      }
    }
    return common + 1;
  }

  /**
   * Closes containers from the current stack depth back down to `targetDepth`.
   *
   * Input: this.pathStack=[root,"recipe","ingredients",0], targetDepth=3
   * Output: '}'
   */
  private closeDownTo(targetDepth: number): string {
    let fragment = '';
    while (this.pathStack.length > targetDepth) {
      const entry = this.pathStack.pop()!;
      fragment += entry.isArray ? ']' : '}';
    }
    return fragment;
  }

  /**
   * Opens containers from the current stack depth down to the full target
   * container path, emitting opening `{`, `[`, keys, and commas as needed.
   * `leafSegment` is used to determine if the innermost container is an array.
   *
   * Input: this.pathStack=[root], targetContainer=["recipe","ingredients"], leafSegment=0
   * Output: '"recipe":{"ingredients":['
   */
  private openDownTo(
    targetContainer: PathSegment[],
    leafSegment: PathSegment,
  ): string {
    let fragment = '';

    const startIdx = this.pathStack.length - 1;

    for (let i = startIdx; i < targetContainer.length; i++) {
      const pathSegment = targetContainer[i];
      const parentEntry = this.pathStack[this.pathStack.length - 1];

      if (parentEntry.childCount > 0) {
        fragment += ',';
      }
      parentEntry.childCount++;

      if (typeof pathSegment === 'string') {
        fragment += `${JSON.stringify(pathSegment)}:`;
      }

      const childSeg =
        i + 1 < targetContainer.length ? targetContainer[i + 1] : leafSegment;
      const isArray = typeof childSeg === 'number';

      fragment += isArray ? '[' : '{';

      this.pathStack.push({ segment: pathSegment, isArray, childCount: 0 });
    }

    return fragment;
  }

  /**
   * Emits the comma, key, and value for a leaf entry in the current container.
   *
   * Input: leafSegment="name", arg={stringValue:"Lasagna"}, valueJson='"Lasagna"'
   * Output: '"name":"Lasagna"' (or ',"name":"Lasagna"' if container.childCount > 0)
   */
  private emitLeaf(
    leafSegment: PathSegment,
    arg: PartialArg,
    valueJson: string,
  ): string {
    let fragment = '';
    const container = this.pathStack[this.pathStack.length - 1];

    if (container.childCount > 0) {
      fragment += ',';
    }
    container.childCount++;

    if (typeof leafSegment === 'string') {
      fragment += `${JSON.stringify(leafSegment)}:`;
    }

    if (arg.stringValue != null && arg.willContinue) {
      fragment += valueJson.slice(0, -1);
      this.stringOpen = true;
    } else {
      fragment += valueJson;
    }

    return fragment;
  }
}

/**
 * Splits a dotted/bracketed JSON path like `recipe.ingredients[0].name` into segments.
 *
 * Input: "recipe.ingredients[0].name"
 * Output: ["recipe", "ingredients", 0, "name"]
 */
function parsePath(rawPath: string): Array<string | number> {
  const segments: Array<string | number> = [];
  for (const part of rawPath.split('.')) {
    const bracketIdx = part.indexOf('[');
    if (bracketIdx === -1) {
      segments.push(part);
    } else {
      if (bracketIdx > 0) segments.push(part.slice(0, bracketIdx));
      for (const m of part.matchAll(/\[(\d+)\]/g)) {
        segments.push(parseInt(m[1], 10));
      }
    }
  }
  return segments;
}

const hasOwn = Object.prototype.hasOwnProperty;

/**
 * Checks only direct properties so path traversal never follows the prototype chain.
 */
function hasOwnProperty(
  obj: Record<string | number, unknown>,
  key: string | number,
): boolean {
  return hasOwn.call(obj, key);
}

/**
 * Defines path values as own data properties so special keys like `__proto__`
 * cannot invoke prototype setters while accumulating streamed arguments.
 */
function defineOwnProperty(
  obj: Record<string | number, unknown>,
  key: string | number,
  value: unknown,
): void {
  Object.defineProperty(obj, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

/**
 * Traverses a nested object along the given path segments and returns the leaf value.
 *
 * Input: ({recipe:{name:"Lasagna"}}, ["recipe","name"])
 * Output: "Lasagna"
 */
function getNestedValue(
  obj: Record<string, unknown>,
  segments: Array<string | number>,
): unknown {
  let current: unknown = obj;
  for (const pathSegment of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    const currentRecord = current as Record<string | number, unknown>;
    if (!hasOwnProperty(currentRecord, pathSegment)) return undefined;
    current = currentRecord[pathSegment];
  }
  return current;
}

/**
 * Sets a value at a nested path, creating intermediate objects or arrays as needed.
 *
 * Input: obj={}, segments=["recipe","ingredients",0,"name"], value="Noodles"
 * Output: {recipe:{ingredients:[{name:"Noodles"}]}}
 */
function setNestedValue(
  obj: Record<string, unknown>,
  segments: Array<string | number>,
  value: unknown,
): void {
  let current: Record<string | number, unknown> = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const pathSegment = segments[i];
    const nextSeg = segments[i + 1];
    if (!hasOwnProperty(current, pathSegment) || current[pathSegment] == null) {
      defineOwnProperty(
        current,
        pathSegment,
        typeof nextSeg === 'number' ? [] : {},
      );
    }
    current = current[pathSegment] as Record<string | number, unknown>;
  }
  defineOwnProperty(current, segments[segments.length - 1], value);
}

/**
 * Extracts the first non-null typed value from a partial arg and returns it with its JSON representation.
 *
 * Input: arg={stringValue:"Boston"} or arg={numberValue:50}
 * Output: {value:"Boston", json:'"Boston"'} or {value:50, json:'50'}
 */
function resolvePartialArgValue(arg: {
  stringValue?: string | null;
  numberValue?: number | null;
  boolValue?: boolean | null;
  nullValue?: unknown;
}): { value: unknown; json: string } | undefined {
  const value = arg.stringValue ?? arg.numberValue ?? arg.boolValue;
  if (value != null) return { value, json: JSON.stringify(value) };
  if ('nullValue' in arg) return { value: null, json: 'null' };
  return undefined;
}
