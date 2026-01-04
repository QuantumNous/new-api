export default function isDate(date: any) {
    return Object.prototype.toString.call(date) === '[object Date]';
}
