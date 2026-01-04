export default function isValidTimeZone(timeZone?: string | number) {
    return ['string', 'number'].includes(typeof timeZone) && timeZone !== '';
}