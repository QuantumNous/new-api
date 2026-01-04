
export default function (str: any): str is string {
    return typeof str === 'string';
}