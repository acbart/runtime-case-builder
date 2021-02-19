import ko from "knockout";
import {countSteps} from './execution';

// TODO: Duplicate button
// TODO: Save/load buttons
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

    dumpAll() {
        let generator = this.fromGenerator.code().map((line) => line()).join("\n");
        let values = JSON.stringify(this.data(), null, 2);
        return `${generator}\n\n${values}\n`;
    }
}

export class Session {
    constructor(code, inputs, cases, instances) {
        this.inputs = ko.observableArray(inputs);
        this.cases = ko.observableArray(cases);
        this.instances = ko.observableArray(instances);
        this.code = ko.observable(code);
        this.caseAutoGenId = Math.max(...cases.map(c => c.id));

        this.undoRemoveInstances = ko.observableArray([]);

        this.queuedExecutions = ko.observableArray([]);

        this.precode = ko.pureComputed(() => {
            return this.inputs().map((i) => {
                return `${i.name()} = ???`;
            }).join("\n");
        }, this);
    }

    toJson() {
        return {
            inputs: this.inputs().map(i => i.toJson()),
            cases: this.cases().map(c => c.toJson()),
            instances: this.instances().map(i => i.toJson()),
            code: this.code(),
        }
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
            this.inputs.push(new Input(length, defaultName, "list[int]"));
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
        console.log(data, index, this.inputs());
        return this.inputs()[index].name();
    }

    addCase() {
        this.caseAutoGenId += 1;
        this.cases.push(new Case(this.caseAutoGenId, "Worst", "#FF0000", []));
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
        aCase.generators.push(new Generator(null, this.inputs().map(i => ko.observable(""))));
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
        return new Session([], [], [], []);
    }
}

const SessionEditorHTML = `
<!------ Inputs ------->
<button class="float-right"
    data-bind="click: () => editingInputs(!editingInputs())">Edit Inputs</button>
<h3>Algorithm</h3>
<!-- ko if: editingInputs -->
<pre data-bind="foreach: session.inputs"
     class="mb-0 ml-1"
    style="font-size: 14px"
    ><code data-bind="text: name"
    ></code>: <code data-bind="text: type"
    ></code><code
    > = ___</code><br></pre>
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

<div data-bind="codemirror: {value: session.code, options: codeMirrorOptions}"></div>

<!------ Cases ------->    
<h3 class="mt-4">Cases</h3>
<div data-bind="foreach: {data: session.cases, as: 'aCase'}">
    <div class="border p-2 mb-2 cases-area">
    <form class="form-inline">
        <!-- Name -->
        <label data-bind="attr: { for: 'caseName' + $index() }"
            class="mr-1 align-middle">
            Name:
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
            data-bind="click: $root.session.runCase.bind($root.session)">
            <i class="fa fa-forward" aria-hidden="true" title="Run Case"></i>
            <span class="sr-only">Run all generators for this case</span>
        </button>
        <button class="btn btn-danger btn-sm ml-auto"
            data-bind="click: $root.session.removeCase.bind($root.session)">
            <i class="fa fa-trash-alt" aria-hidden="true" title="Remove Case"></i>
            <span class="sr-only">Remove this case</span>
        </button>
        </form>
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
                <span class="sr-only">Run this generator</span>
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
        data-bind="click: $root.session.addGenerator.bind($root.session, aCase)">Add new generator</button>
    </div>
</div>
<button class="btn btn-success"
    data-bind="click: session.addCase.bind(session)">Add new case</button>
<!------ Code ------->

<!------ Types ------->
<datalist id="python-types">
  <option value="int" />
  <option value="list[int]" />
  <option value="set[int]" />
  <option value="list[list[int]]" />
  <option value="str" />
  <option value="list[str]" />
  <option value="set[str]" />
  <option value="bool" />
  <option value="list[bool]" />
  <option value="set[bool]" />
  <option value="float" />
  <option value="list[float]" />
  <option value="set[float]" />
  <option value="list" />
  <option value="set" />
</datalist>
`;

ko.components.register('session-editor', {
    template: SessionEditorHTML
});