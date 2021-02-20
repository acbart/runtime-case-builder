export function removeXY(arr, x, y) {
    for (let i=0; i<arr.length; i++) {
        if (arr[i].x === x && arr[i].y === y) {
            arr.splice(i, 1);
            return arr;
        }
    }
    return arr;
}

export function promptJsonFile() {
    let input = document.createElement("input");
    input.type = "file";
    input.accept = "application/JSON";
    return new Promise(function(resolve) {
        document.activeElement.onfocus = function() {
            document.activeElement.onfocus = null;
            setTimeout(resolve, 500);
        };
        input.onchange = function(e) {
            let file = e.target.files[0];
            // setting up the reader
            let reader = new FileReader();
            reader.readAsText(file, 'UTF-8');

            // here we tell the reader what to do when it's done reading...
            reader.onload = readerEvent => {
                let content = readerEvent.target.result; // this is the content!
                resolve(content);
            }
        };
        input.click();
    });
}