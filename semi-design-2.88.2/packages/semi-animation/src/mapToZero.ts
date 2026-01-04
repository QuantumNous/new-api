// currently used to initiate the velocity style object to 0
export default function mapToZero(obj: Record<string, any>) {
    const ret = {};
    const objKeys = (obj && Object.keys(obj)) || [];
    for (const key of objKeys) {
        ret[key] = 0;
    }
    return ret;
}
