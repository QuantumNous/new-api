export default function arrayMove(array: Array<any>, from: number, to: number) {
    const newArray = array.slice();
    newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
    return newArray;
}