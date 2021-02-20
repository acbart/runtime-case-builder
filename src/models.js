import ko from "knockout";
import {countSteps} from './execution';
import {promptJsonFile} from "./utilities";

// TODO: Duplicate button
// TODO: Auto load from parameters
// TODO: Hover over chart to see table element, and vice versa

export class Input {
    constructor(name, type) {
        this.name = ko.observable(name);
        this.type = ko.observable(type);
    }

    toJson() {
        return {
            name: this.name(),
            type: this.type()
        }
    }

    static fromJson(instance) {
        return new Input(instance.name, instance.type);
    }
}

export class Generator {
    static MAX_ID = 0;

    constructor(id, code) {
        if (id === null) {
            this.id = Generator.MAX_ID++;
        } else {
            this.id = id;
            Generator.MAX_ID = Math.max(Generator.MAX_ID, id+1);
        }
        this.code = ko.observableArray(code);
    }

    toJson() {
        return {
            id: this.id,
            code: this.code().map(g => g())
        }
    }

    static fromJson(g) {
        return new Generator(g.id, g.code.map(l => ko.observable(l)));
    }
}

export const DEFAULT_GENERATORS = {
    "int": "randint(1, 100)",
    "list[int]": "[randint(1, 10) for i in range(n)]"
}

export class Case {
    static MAX_ID = 0;

    constructor(id, name, color, generators) {
        if (id === null) {
            this.id = Case.MAX_ID++;
        } else {
            this.id = id;
            Case.MAX_ID = Math.max(Case.MAX_ID, id+1);
        }
        this.name = ko.observable(name);
        this.color = ko.observable(color);
        this.generators = ko.observableArray(generators);
    }

    toJson() {
        return {
            id: this.id,
            name: this.name(),
            color: this.color(),
            generators: this.generators().map(g => g.toJson())
        }
    }

    static fromJson(c) {
        return new Case(c.id, c.name, c.color, c.generators.map(g => Generator.fromJson(g)));
    }
}

export class Instance {
    constructor(c, generator, value, steps, error, output, data) {
        this.fromCase = c;
        this.fromGenerator = generator;
        this.value = ko.observable(value);
        this.steps = ko.observable(steps);
        this.error = ko.observable(error);
        this.output = ko.observable(output);
        this.data = ko.observable(data);
    }

    toJson() {
        return {
            fromCase: this.fromCase.id,
            fromGenerator: this.fromGenerator.id,
            value: this.value(),
            steps: this.steps(),
            error: this.error(),
            output: this.output(),
            data: this.data()
        }
    }

    static fromJson(i, cases, generators) {
        return new Instance(cases[i.fromCase], generators[i.fromGenerator], i.value, i.steps, i.error, i.output, i.data);
    }

    dumpAll() {
        let generator = this.fromGenerator.code().map((line) => line()).join("\n");
        let values = JSON.stringify(this.data(), null, 2);
        return `${generator}\n\n${values}\n`;
    }
}

export class Session {
    constructor(code, inputs, cases, instances, title) {
        this.inputs = ko.observableArray(inputs);
        this.cases = ko.observableArray(cases);
        this.instances = ko.observableArray(instances);
        this.code = ko.observable(code);
        this.title = ko.observable(title);

        // Keep a simple undo queue
        this.undoRemoveInstances = ko.observableArray([]);
        // Keep track of currently executing chunks
        this.queuedExecutions = ko.observableArray([]);
        // Observe the snippet of code we insert beforehand
        this.precode = ko.pureComputed({
            read:() => {
                return this.inputs().map((i) => {
                    return `${i.name()} = ???`;
                }).join("\n");
            },
            write: (value) => {}, // CodeMirror tries to edit the precode, but we don't want that.
            owner: this
        });
        this.precodeLength = ko.pureComputed(() => {
            return this.inputs().length
        })
        this.sortedInstances = ko.pureComputed(() => {
            return this.instances().sort((l, r) =>
                l.fromCase.name().localeCompare(r.fromCase.name())
            );
        });
    }

    toJson() {
        return {
            inputs: this.inputs().map(i => i.toJson()),
            cases: this.cases().map(c => c.toJson()),
            instances: this.instances().map(i => i.toJson()),
            code: this.code(),
            title: this.title()
        }
    }

    saveJson(s, event) {
        //event.preventDefault();
        let exportObj = this.toJson();
        let safeFilename = this.title().replace(/[^a-z0-9]/gi, '_').toLowerCase();
        safeFilename = `RCB_${safeFilename}.json`;
        let contents = JSON.stringify(exportObj, null, 2);
        // Make the data download as a file
        let blob = new Blob([contents], {type: "text/json"});
        if (window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveBlob(blob, safeFilename);
        } else{
            let temporaryDownloadLink = window.document.createElement("a");
            temporaryDownloadLink.href = window.URL.createObjectURL(blob);
            temporaryDownloadLink.download = safeFilename;
            document.body.appendChild(temporaryDownloadLink);
            temporaryDownloadLink.click();
            document.body.removeChild(temporaryDownloadLink);
        }
        /*
        let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(contents);
        let downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `RCB_${safeFilename}.json`);
        downloadAnchorNode.setAttribute("onclick", "console.log('hello')");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        return false;*/
    }

    loadJson() {
        promptJsonFile().then((data) => {
            console.log(JSON.parse(data));
            this.fromJson(JSON.parse(data));
        });
    }

    fromJson(data) {
        this.instances.removeAll();
        this.cases.removeAll();
        this.inputs.removeAll();

        ko.utils.arrayPushAll(this.inputs, data.inputs.map(i => Input.fromJson(i)));
        ko.utils.arrayPushAll(this.cases, data.cases.map(c => Case.fromJson(c)));
        let cs = {}, gs = {};
        this.cases().map((c) => {
            cs[c.id] = c;
            c.generators().map(g => {
                gs[g.id] = g;
            });
        });
        ko.utils.arrayPushAll(this.instances, data.instances.map(i => Instance.fromJson(i, cs, gs)));

        this.title(data.title);
        this.code(data.code);
    }

    createReport() {
        let image = document.getElementById("runtime-chart").toDataURL();
        let title = this.title();
        let code = this.precode() + "\n" + this.code();
        let cases = this.cases().map(c => {
            let generators = c.generators().map(g => {
                let codelines = g.code().map( (c, i) => `${this.inputs()[i].name()} = ${c()}`).join("\n");
                return `<tr><td><pre><code style="font-family: 'Courier New'">${codelines}</code></pre></td></tr>`;
            }).join("\n");
            return `<tr><td><strong>${c.name()}:</strong><ol>${generators}</td></tr>`;
        }).join("\n");
        let plottedInputs = $("#plotted-inputs").clone();
        plottedInputs.find(".no-copy").remove('.no-copy');
        plottedInputs = plottedInputs.prop('outerHTML');
        const winHtml = `<!DOCTYPE html>
            <html>
                <head>
                    <title>Runtime Case Builder - ${title}</title>
                    <style>
                        table, th, td {
                            border: 1px solid black;
                            border-collapse: collapse;
                        }
                        th {
                            text-align: left;
                        }
                        table {
                            width: 100%;
                        }
                    </style>
                </head>
                <body>
                    <h3>${title}</h3>
                    <h4>Algorithm</h4>
                    <pre><code style="font-family: 'Courier New'">${code}</code></pre>
                    <h4>Cases</h4>
                    <table>${cases}</table>
                    <h4>Time Analysis Plot</h4>
                    <img src="${image}"/>
                    <br>
                    <h4>Plotted Inputs</h4>
                    ${plottedInputs}
                </body>
            </html>`;

        const winUrl = URL.createObjectURL(
            new Blob([winHtml], { type: "text/html" })
        );

        const win = window.open(
            winUrl,
            "_blank",
            ``
        );
    }

    removeInstance(data) {
        this.instances.remove(data);
        this.undoRemoveInstances.push(data);
        // Also need to remove it from chart;
    }

    restoreInstance() {
        let instance = this.undoRemoveInstances.pop();
        let confirmed = false;
        for (let i=0; i < this.cases().length; i++) {
            if (this.cases()[i] === instance.fromCase) {
                for (let j=0; j<instance.fromCase.generators().length; j++) {
                    if (instance.fromCase.generators()[j] === instance.fromGenerator) {
                        confirmed = true;
                    }
                }
            }
        }
        if (confirmed) {
            this.instances.push(instance);
        } else {
            console.log(instance.toJson());
            alert("Could not restore instance; generator or case was deleted.");
        }
    }

    clearInstances() {
        this.instances.removeAll();
    }

    clearInstancesSafely() {
        console.log("INSTANCES BEFORE:", this.instances().length);
        let removed = this.instances.removeAll();
        console.log("INSTANCES BEFORE:", this.instances().length);
        ko.utils.arrayPushAll(this.undoRemoveInstances, removed);
        console.log("INSTANCES BEFORE:", this.instances().length);
    }

    runGenerator(aCase, generator) {
        let code = this.code();
        let names = this.inputs().map(i => i.name());
        let generators = generator.code().map(c => c());
        this.queuedExecutions.push(generators);
        return countSteps(code, names, generators, (n, steps, output, error, data) => {
            this.instances.push(new Instance(aCase, generator, n, steps, error, output, data));
            this.queuedExecutions.pop();
        });
    }

    runCase(aCase, event, i) {
        if (i === undefined) {
            i = 0;
        }
        let generators = aCase.generators();
        if (i < generators.length) {
            this.runGenerator(aCase, generators[i]).then(() => {
                this.runCase(aCase, event, i+1);
            });
        }
    }

    addInput() {
        let confirmed = true;
        if (this.instances().length > 0) {
            confirmed = confirm("Add a new input? This will clear all existing instances.");
        }
        if (confirmed) {
            let length = this.inputs().length;
            let defaultName = "array" + (length > 1 ? length : "");
            this.inputs.push(new Input(defaultName, "list[int]"));
            this.cases().map(c => {
                c.generators().map(g => {
                    g.code.push("");
                });
            });
        }
    }

    removeInput(data) {
        // Confirm if there are generators that would be removed
        let confirmed = true;
        if (this.cases().some(c => c.generators().length > 0) || this.instances().length > 0) {
            confirmed = confirm("Remove this input? This will alter the associated generators and clear all instances.");
        }
        if (confirmed) {
            let position = this.inputs.indexOf(data);
            this.cases().map(c => {
                c.generators().map(g => {
                    g.code.splice(position, 1);
                });
            });
            this.clearInstances();
            this.inputs.remove(data);
        }
    }

    getInput(data, index) {
        return this.inputs()[index].name();
    }

    addCase() {
        this.cases.push(new Case(null, "Worst", "#FF0000", []));
    }

    removeCase(data) {
        let confirmed = true;
        if (this.instances().some((instance) => instance.fromCase === data) || data.generators().length > 0) {
            confirmed = confirm("Are you sure you want to remove this case? Its instances and generators will be cleared.");
        }
        if (confirmed) {
            this.cases.remove(data);
            this.instances.remove((instance) => instance.fromCase === data);
        }
    }

    addGenerator(aCase) {
        aCase.generators.push(new Generator(null, this.inputs().map(i => ko.observable(DEFAULT_GENERATORS[i.type() || ""]))));
    }

    removeGenerator(aCase, generator) {
        let confirmed = true;
        if (this.instances().some((instance) => instance.fromGenerator === generator) || generator.code().some(c => c.length > 0)) {
            confirmed = confirm("Are you sure you want to delete this generator? Its instances and code will be cleared.");
        }
        if (confirmed) {
            aCase.generators.remove(generator);
            this.instances.remove((instance) => instance.fromGenerator === generator);
        }
    }

    static EMPTY() {
        return new Session([], [], [], [], "Untitled");
    }
}

const SessionEditorHTML = `
<div class="row">

<div class="col-md border p-2 bg-background pl-4 pr-4">
    <h4>Title</h4>
    <div style="width: 50%">
    <input type="text"
        size="15"
        class="form-control ml-2"
        id="title"
        data-bind="value: session.title">
    </div>
    <h4>Instructions</h4>
    <p>This tool let's you analyze the runtime of an algorithm by creating input cases.</p>
    <ol>
        <li>First, check over the <strong>Algorithm</strong> directly below. Note the first few lines are not editable; these will be prepended to the algorithm with appropriate inputs.</li>
        <li>Then, add new <strong>Cases</strong> of input; each case can have one or more input generators. These generators are Python snippets that will be input to the algorithm.</li>
        <li>Next, use the <strong>Run</strong> buttons to send an input through the algorithm, and the tool will track how many steps it took.</li>
        <li>After execution finishes, observe that the number of steps has been plotted as a function of the input named <code>n</code> to produce a <strong>Time Analysis Plot</strong> in the bottom left.</li>
        <li>Additionally, you can observe the <strong>Plotted Instances</strong> log in the bottom right that has all the executions along with their <code>n</code> (input size), number of steps taken, and their output (including any errors produced).</li>
        <li>Finally, you can use the <strong>Create Report</strong> in the Control box, which generates a new page that can be easily copy/pasted into Google Docs.</li>
        <li>Alternatively, you can <strong>save a JSON</strong> representation of your current session to load back later.</li>
    </ol>

</div>

</div>
<div class="row">
<!------- Algorithm + Inputs ----->
<div class="col-md-8 border p-2 bg-background pl-4 pr-4">
    <h4>Algorithm</h4>
    <p>The Python code below will be run, with the <code>???</code> being replaced with actual values.</p>
    <!-- ko if: editingInputs -->
    <!--<pre data-bind="foreach: session.inputs"
         class="mb-0 pl-1 bg-white border"
        style="font-size: 14px"
        ><code data-bind="text: name"
        ></code>: <code data-bind="text: type"
        ></code><code
        > = ___</code><br></pre>-->
    <div data-bind="codemirror: {value: session.precode, options: codeMirrorReadOnlyOptions}"
        class="precode"></div>
    <!-- /ko -->
    <!-- ko ifnot: editingInputs -->
    <ol data-bind="sortable: {data: session.inputs, connectClass: 'inputs-area'}">
        <li class="border p-2 mb-2 bg-light inputs-area">
        <form class="form-inline">
            <!-- Name -->
            <label data-bind="attr: { for: 'inputName' + $index() }"
                class="mr-1 align-middle">
                Name:
                <input type="text"
                    size="15"
                    class="form-control ml-2 code-input"
                    data-bind="value: name, attr: { id: 'inputName' + $index() }"> 
            </label>
            <!-- Type -->
            <label data-bind="attr: { for: 'inputType' + $index() }"
                class="mr-1 ml-2">
                Type:
                <input type="text"
                    size="15"
                    list="python-types"
                    class="form-control ml-2 code-input"
                    data-bind="value: type, attr: { id: 'inputType' + $index() }"> 
            </label>
            <!-- Remove -->
            <button class="btn btn-danger btn-sm ml-4"
                data-bind="click: $root.session.removeInput.bind($root.session)">Remove</button>
        </form>
        </li>
    </ol>
    <button class="btn btn-success mb-4"
        data-bind="click: session.addInput.bind(session)">Add new input</button>
    <!-- /ko -->
    
    <div data-bind="codemirror: {value: session.code,
                                 options: codeMirrorOptions,
                                 firstLineNumber: session.precodeLength}"
        class="realcode"></div>
</div>

<!------ Controls ------->
<div class="col-md-4 border p-2 bg-background">
    <h4>Controls</h4>
    <p>Use these to save and load your current work session, to load a teacher provided session, or create a report for submission.</p>
    <button class="btn btn-primary m-2 mr-1" data-bind="click: session.createReport.bind(session)">Create Report</button><span>to copy/paste into Docs</span><br>
    <button class="btn btn-primary m-2 mr-1" data-bind="click: session.saveJson.bind(session)">Save JSON</button><span>to be able to load later</span><br>
    <button class="btn btn-primary m-2 mr-1" data-bind="click: session.loadJson.bind(session)">Load JSON</button><span>from previous work session</span><br>
    <button class="btn btn-sm btn-secondary m-2 mr-1"
        data-bind="click: () => editingInputs(!editingInputs())">Edit Input Parameters</button> to edit the prepended variables
</div>

</div>

<!------ Cases ------->    
<div class="row bg-background border pl-2 pb-2">
<div class="col-md">
<h4 class="mt-4">Cases</h4>
<p>Create cases and generators below, then run them through the algorithm to plot instances.</p>
<div data-bind="foreach: {data: session.cases, as: 'aCase'}">
    <div class="border p-2 mb-2 cases-area bg-white">
    <form class="form-inline mb-2">
        <!-- Name -->
        <label data-bind="attr: { for: 'caseName' + $index() }"
            class="mr-1 align-middle">
            Case Name:
            <input type="text"
                size="15"
                class="form-control ml-2 code-input"
                data-bind="value: name, attr: { id: 'caseName' + $index() }"> 
        </label>
        <!-- Color -->
        <label data-bind="attr: { for: 'caseColor' + $index() }"
            class="mr-1 ml-2">
            Color:
            <input type="color"
                class="form-control ml-2 custom"
                data-bind="value: color, attr: { id: 'caseColor' + $index() }"> 
        </label>
        <!-- Remove -->
        <button class="btn btn-info btn-sm ml-4"
            title="Run all generators for this case"
            data-bind="click: $root.session.runCase.bind($root.session)">
            <i class="fa fa-forward" aria-hidden="true" title="Run Case"></i>
            <span>Run entire case</span>
        </button>
        <button class="btn btn-danger btn-sm ml-auto"
            data-bind="click: $root.session.removeCase.bind($root.session)">
            <i class="fa fa-trash-alt" aria-hidden="true" title="Remove Case"></i>
            <span class="sr-only">Remove this case</span>
        </button>
    </form>
    <ol data-bind="sortable: {data: generators, connectClass: 'generators-area'}">
        <li class="border p-2 mb-2 bg-light">
            <form class="form-inline">
            <!-- ko foreach: code -->
                <label data-bind="attr: { for: 'case'+aCase.id+'Gen' + $parentContext.$index()+'Code'+$index() }"
                    class="mr-1 align-middle">
                    <!-- ko if: $index() > 0 --><span class="mr-2">,</span><!-- /ko -->
                    <span data-bind="text: $root.session.getInput($data, $index())"></span>=
                    <input type="text"
                        size="15"
                        class="form-control ml-2 code-input"
                        data-bind="value: $rawData, attr: { id: 'case'+aCase.id+'Gen' + $parentContext.$index()+'Code'+$index(),
                                                         size: ($root.session.inputs()[$index()].type().startsWith('list')) ? '50' : '20'}">
                </label>
            <!-- /ko -->
                
            <button class="btn btn-info btn-sm ml-4"
                data-bind="click: $root.session.runGenerator.bind($root.session, aCase)">
                <i class="fa fa-play" aria-hidden="true" title="Run Generator"></i>
                <span>Run this input</span>
            </button>
            
            <!-- Remove -->
            <button class="btn btn-danger btn-sm ml-auto"
                data-bind="click: $root.session.removeGenerator.bind($root.session, aCase)">
                <i class="fa fa-trash-alt" aria-hidden="true" title="Remove Generator"></i>
                <span class="sr-only">Remove this generator</span>
            </button>
            </form>
        </li>
    </ol>
    <button class="btn btn-success"
        data-bind="click: $root.session.addGenerator.bind($root.session, aCase)">
        <i class="fa fa-plus" aria-hidden="true" title="Add input"></i>
        Add new input</button>
    </div>
</div>
<button class="btn btn-success"
    data-bind="click: session.addCase.bind(session)">
        <i class="fa fa-plus" aria-hidden="true" title="Add case"></i>
        Add new case</button>

</div></div>
`;

ko.components.register('session-editor', {
    template: SessionEditorHTML
});