/****************************************************************************************************************
 * Old Version
 */


const EXAMPLES = {
    "Quadratic Multiplication": [`sum = 0
for i in range(n):
for j in range(n):
sum = sum + i + j
print(sum)`, "[]"],
    "Linear Search": [`target = 1
index = None
for index, value in enumerate(array):
if value == target:
break
print(index)`, `[1]*n
[2]*n
list(range(n))
list(reversed(range(n)))
[random.randint(1, 100) for i in range(n)]
`]
}

let MAX_N = 1000;
let DELAY = 400;
let timeouter = null;

let cache = {};

function evalLine(expression) {
    Sk.globals = {'n': Sk.ffi.remapToPy(model.n())};
    let code = "import random; import math; array = " + expression;
    Sk.afterSingleExecution = null;
    return Sk.misceval.asyncToPromise(() => {
        return Sk.importMainWithBody("student", false, code, true).$d.array;
    });
}

function countSteps() {
    let code = pythonCM.getValue();
    model.n(Math.floor(Math.random() * MAX_N));
    let array = model.array(); //Sk.ffi.remapToPy(model.array().split(","));
    var steps = 0;
    evalLine(array).then((arrayInit) => {
        Sk.misceval.asyncToPromise(() => {
            Sk.globals = {'n': Sk.ffi.remapToPy(model.n()), 'array': arrayInit};
            Sk.retainGlobals = true;
            Sk.afterSingleExecution = function () {
                steps += 1;
            };
            return Sk.importMainWithBody("student", false, code, true);
        }).then((result) => {
            model.error(null);
            model.steps(steps);
            addToChart(model.n(), model.steps());
            timeouter = setTimeout(countSteps, DELAY);
            advanceArrays();
        }, handleError);
    }, handleError);
}

function handleError(result) {
    console.error(result);
    model.error("" + result);
}

var model = {
    n: ko.observable(10),
    steps: ko.observable(0),
    array: ko.observable(""),
    i: ko.observable(0),
    error: ko.observable(null)
};

function advanceArrays() {
    model.i(model.i() + 1);
    let arrays = $("#arrays").val().trim().split("\n");
    if (model.i() >= arrays.length) {
        model.i(0);
    }
    let array = arrays[model.i()];
    model.array(array);
}


var scatterChart;

function addToChart(n, steps) {
    scatterChart.data.datasets.forEach((dataset) => {
        dataset.data.push({x: n, y: steps});
        console.log(dataset.pointBackgroundColor);
        dataset.pointBackgroundColor.push(getColor());
        //dataset.points[dataset.points.length-1].fillColor = 'red';
    });
    scatterChart.update();
}

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'black', 'orange'];

function getColor() {
    let i = model.i() % COLORS.length;
    return COLORS[i];
}

function reloadColors() {
    let arrays = $("#arrays").val().split("\n");
    let colorHints = arrays.map((color, i) => `<mark style="background: ${COLORS[i % COLORS.length]}">&nbsp;</mark>`).join("");
    console.log(arrays);
    $("#color-hints").html(colorHints);
}

function clearChart() {
    scatterChart.data.datasets.forEach((dataset) => {
        while (dataset.data.length > 0) {
            dataset.data.pop();
        }
    });
    scatterChart.update();
}


function reset() {
    timeouter = clearTimeout(timeouter);
    clearChart();
    model.i(-1);
    countSteps();
}

function stop() {
    timeouter = clearTimeout(timeouter);
}

function start() {
    timeouter = clearTimeout(timeouter);
    countSteps();
}

function loadExample(name) {
    let example = EXAMPLES[name];
    pythonCM.setValue(example[0]);
    $("#arrays").val(example[1]);
    reloadColors();
}

function buildExampleButtons() {
    let buttons = "";
    for (let name in EXAMPLES) {
        buttons += `<button onclick="loadExample('${name}')">${name}</button>`;
    }
    $("#examples").html(buttons);
}

var pythonCM;
$(document).ready(function () {
    buildExampleButtons();
    reloadColors();
    pythonCM = CodeMirror.fromTextArea(document.getElementById("editor"), {
        mode: {
            name: 'python',
            version: 3,
            singleLineStringErrors: false
        },
        showCursorWhenSelecting: true,
        indentUnit: 4,
        tabSize: 4,
        indentWithTabs: false,
        matchBrackets: true,
        extraKeys: {
            'Tab': 'indentMore',
            'Shift-Tab': 'indentLess',
            'Ctrl-Enter': start,
            'Esc': function (cm) {
                if (cm.getOption("fullScreen")) {
                    cm.setOption("fullScreen", false);
                } else {
                    cm.display.input.blur();
                }
            },
            "F11": function (cm) {
                cm.setOption("fullScreen", !cm.getOption("fullScreen"));
            },
        },
        lineNumbers: true,
    });
    pythonCM.setSize(400, 150);


    $("#editor").bind('input propertychange', function () {
        clearChart();
    });
    var ctx = document.getElementById('chart').getContext('2d');
    scatterChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'N vs. Steps',
                data: [],
                pointBackgroundColor: []
            }]
        },
        options: {
            scales: {
                xAxes: [{
                    type: 'linear',
                    position: 'bottom'
                }]
            }
        }
    });
    ko.applyBindings(model);
    advanceArrays();
    //countSteps();
    $("#arrays").bind("input change", reloadColors);
});