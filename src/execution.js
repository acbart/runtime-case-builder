

// Pyodide-based execution engine
// Lazily load Pyodide from CDN on first use
let _pyodidePromise = null;

function getPyodide() {
    if (!_pyodidePromise) {
        _pyodidePromise = loadPyodide().then((py) => {
            // Pre-import standard modules used by student code
            return py.runPythonAsync(`
import sys, io, json, traceback, random, math
from random import *
`).then(() => py);
        });
    }
    return _pyodidePromise;
}

// Python tracer script — runs once per countSteps call.
// Uses sys.settrace to count every line executed in the student's code,
// which gives accurate CPython-level step counts (not Skulpt approximations).
// The user code is compiled with filename '_rcb_student' so we can filter
// the tracer to only count lines from that file, ignoring the harness code.
const TRACER_SCRIPT = `
import sys, io, json, traceback, random, math
from random import *

_ns = {}
_steps = 0
_out_buf = io.StringIO()
_err = None
_data = {}

try:
    exec(_rcb_init, _ns)
except Exception as _e:
    _err = str(_e)

if _err is None:
    try:
        _user_code_obj = compile(_rcb_user, '_rcb_student', 'exec')
    except SyntaxError as _e:
        _err = str(_e)
        _user_code_obj = None

if _err is None and _user_code_obj is not None:
    def _tracer(frame, event, arg):
        global _steps
        if event == 'line' and frame.f_code.co_filename == '_rcb_student':
            _steps += 1
        return _tracer

    _old_stdout = sys.stdout
    sys.stdout = _out_buf
    sys.settrace(_tracer)
    try:
        exec(_user_code_obj, _ns)
    except Exception as _e:
        _err = traceback.format_exc()
    finally:
        sys.settrace(None)
        sys.stdout = _old_stdout

for _vn in list(_rcb_vars):
    try:
        _data[_vn] = repr(_ns.get(_vn))
    except Exception:
        _data[_vn] = '???'

json.dumps({
    'n': _ns.get('n', None),
    'steps': _steps,
    'output': _out_buf.getvalue(),
    'error': _err,
    'data': _data
})
`;

// Every run shares the one interpreter, passing its inputs through the same globals,
// so runs have to be taken one at a time. Overlapping them (running two cases at once)
// would let the second overwrite the first's inputs, and both would report the steps
// for whichever code won the race.
let _running = Promise.resolve();

export function countSteps(code, names, values, afterwards) {
    _running = _running.then(
        () => runOne(code, names, values, afterwards),
        () => runOne(code, names, values, afterwards)
    );
    return _running;
}

function runOne(code, names, values, afterwards) {
    let initLines = ["from random import *", "import math"];
    for (let i = 0; i < values.length; i++) {
        initLines.push(`${names[i]} = ${values[i]}`);
    }
    const initCode = initLines.join("\n");

    return getPyodide().then((py) => {
        // Pass code strings via globals to avoid any escaping issues
        py.globals.set('_rcb_init', initCode);
        py.globals.set('_rcb_user', code);
        py.globals.set('_rcb_vars', names);
        return py.runPythonAsync(TRACER_SCRIPT);
    }).then((resultJson) => {
        const result = JSON.parse(resultJson);
        const n = result.n;
        const steps = result.steps;
        const output = result.output;
        const error = result.error;
        const data = result.data;

        if (n === null || n === undefined) {
            afterwards(0, null, output, "The variable n was not defined!", data);
        } else {
            afterwards(n, steps, output, error, data);
        }
    }).catch((error) => {
        afterwards(0, null, "", String(error), {});
    });
}
