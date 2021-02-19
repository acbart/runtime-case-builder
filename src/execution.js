

function evalLine(expression) {
    Sk.globals = {'n': Sk.ffi.remapToPy(model.n())};
    let code = "import random; import math; array = " + expression;
    Sk.afterSingleExecution = null;
    return Sk.misceval.asyncToPromise(() => {
        return Sk.importMainWithBody("student", false, code, true).$d.array;
    });
}

export function countSteps(code, names, values, afterwards) {
    let initializations = ["from random import *"];
    for (let i=0; i<values.length; i+= 1) {
        initializations.push(`${names[i]} = ${values[i]}`)
    }
    code = initializations.join("\n")+"\n##### START\n"+code;
    var steps = 0;
    var stdout = [];
    Sk.output = (output) => {
        stdout.push(output);
    }
    Sk.retainGlobals = false;
    Sk.afterSingleExecution = function (globals, locals, line, column) {
        if (line > initializations.length+1) {
            steps += 1;
        }
    };
    return Sk.misceval.asyncToPromise(() => {
        return Sk.importMainWithBody("student", false, code, true);
    }).then((result) => {
        let values = {};
        try {
            names.map((name) => values[name] = Sk.ffi.remapToJs(result.$d[name].$r()));
        } catch (e) {
            values['ERROR'] = e;
        }
        if (!("n" in result.$d)) {
            afterwards(0, null, stdout, "The variable n was not defined!", values);
        } else {
            afterwards(Sk.ffi.remapToJs(result.$d.n), steps, stdout, null, values);
        }
    }, (error) => {
        afterwards(0, null, stdout, error, {});
    });
}
