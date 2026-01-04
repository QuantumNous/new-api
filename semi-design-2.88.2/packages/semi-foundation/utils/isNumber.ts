export default function isNumber(value: any) {
    return typeof value === 'number' || Object.prototype.toString.call(value) === '[object Number]';
}