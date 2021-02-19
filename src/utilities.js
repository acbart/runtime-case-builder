export function removeXY(arr, x, y) {
    for (let i=0; i<arr.length; i++) {
        if (arr[i].x === x && arr[i].y === y) {
            arr.splice(i, 1);
            return arr;
        }
    }
    return arr;
}