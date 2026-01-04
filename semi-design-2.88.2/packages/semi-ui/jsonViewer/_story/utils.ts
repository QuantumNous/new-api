type JsonValue = string | number | boolean | JsonObject | JsonArray;
interface JsonObject {
    [key: string]: JsonValue
}
type JsonArray = Array<JsonValue>;

export function generateJsonString(count: number, nested: number): string {
    function generateRandomString(): string {
        const length = Math.floor(Math.random() * 20) + 5;
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        return Array.from({ length }, () => characters[Math.floor(Math.random() * characters.length)]).join('');
    }

    function generateRandomObject(depth: number): JsonObject {
        const obj: JsonObject = {};
        const prefixes = ['id', 'name', 'value', 'data', 'item'];

        // 始终生成5个键值对，每种类型各一个
        obj[`${prefixes[0]}`] = Math.floor(Math.random() * 1000); // number
        obj[`${prefixes[1]}`] = generateRandomString(); // string
        obj[`${prefixes[2]}`] = Math.random() > 0.5; // boolean
        if (depth < nested) {
            obj[`${prefixes[3]}`] = generateJsonArray(depth + 1); // array
            obj[`${prefixes[4]}`] = generateRandomObject(depth + 1); // object
        } else {
            // 在达到最大深度时，用基本类型替代
            obj[`${prefixes[3]}`] = Math.floor(Math.random() * 1000); // 用number替代array
            obj[`${prefixes[4]}`] = generateRandomString(); // 用string替代object
        }
        return obj;
    }

    function generateJsonArray(depth: number): JsonArray {
        const array: JsonArray = [];

        // 始终生成5个元素，每种类型各一个
        array.push(Math.floor(Math.random() * 1000)); // number
        array.push(generateRandomString()); // string
        array.push(Math.random() > 0.5); // boolean
        if (depth < nested) {
            array.push(generateJsonArray(depth + 1)); // array
            array.push(generateRandomObject(depth + 1)); // object
        } else {
            // 在达到最大深度时，用基本类型替代
            array.push(Math.floor(Math.random() * 1000)); // 用number替代array
            array.push(generateRandomString()); // 用string替代object
        }
        return array;
    }

    function generateJson(): JsonObject[] {
        const json: JsonObject[] = [];
        for (let i = 0; i < count; i++) {
            json.push(generateRandomObject(1));
        }
        return json;
    }

    const json = generateJson();
    return JSON.stringify(json, null, 4); // 格式化输出
}
