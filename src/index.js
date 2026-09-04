
import $ from "jquery";
import "jquery-ui";
import ko from "knockout";
//import "bootswatch/dist/flatly/bootstrap.min.css";
import 'bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './style.scss';
import '../libs/knockout-sortable.min';
import './ko-codemirror';
import './ko-autoresize';
import Chart from 'chart.js';
import {removeXY} from './utilities';
import './example-picker';
import {createDoublePress, isFillShortcut, FILL_SHORTCUT} from './shortcut';
import {createExampleSelection} from './example-selection';
import {fetchExample, fetchExampleIndex, preloadUrl} from './examples';
import {STARTER_SESSION} from './starter';


import {Session} from './models.js';

function setup() {
    $(document).on('copy', function(e) {
        $('.no-copy').hide();
        setTimeout(function() { $('.no-copy').show(); });
    } );
}

export const CODE_MIRROR_READONLY_OPTIONS = {
    mode: {
        name: 'python',
        version: 3,
        singleLineStringErrors: false
    },
    lineNumbers: true,
    readOnly: 'nocursor',
    viewPortMargin: Infinity
}


export const CODE_MIRROR_OPTIONS = {
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
};

/** How long a message stays under the Cases heading. */
export const HINT_TIMEOUT_MS = 9000;

export const CHART_OPTIONS = {
    scales: {
        xAxes: [{
            scaleLabel: {
                display: true,
                labelString: "Input Size (n)"
            },
            type: 'linear',
            position: 'bottom'
        }],
        yAxes: [{
            scaleLabel: {
                display: true,
                labelString: "Runtime (steps)"
            }
        }]
    },
    title: {
        display: true,
        text: "Input Size vs. Steps Taken"
    }
};


class CaseBuilderModel {
    constructor(chart, settings) {
        this.settings = settings;
        this.editingInputs = ko.observable(true);
        this.session = Session.EMPTY();
        this.codeMirrorOptions = CODE_MIRROR_OPTIONS;
        this.codeMirrorReadOnlyOptions = CODE_MIRROR_READONLY_OPTIONS;
        this.chartData = {datasets: []};
        this.chartDatasetsMap = {};

        // Curated example sessions (see <example-picker>); filled in by loadExampleIndex()
        this.examples = ko.observableArray([]);
        // The dropdown both picks an example and shows which one is open
        this.selectedExample = createExampleSelection({
            loadedFrom: this.session.loadedFrom,
            load: (file) => this.loadExample(file),
        }).selected;

        // A short message shown with the cases, for the fill-in shortcut
        this.hint = ko.observable("");
        this.hintTimer = null;
        // Ctrl+I fills the empty cases in, but only on the second press
        this.fillShortcut = createDoublePress({
            onArm: () => this.say(`Press ${FILL_SHORTCUT} again to fill the empty cases with example inputs.`, 0),
            onExpire: () => this.hint(""),
            onFire: () => this.fillEmptyCases(),
        });
        this.chart = new Chart(chart.getContext('2d'), {
            type: 'scatter',
            data: this.chartData,
            options: CHART_OPTIONS
        });

        // TODO: "You changed this generator, clear its instances?
        this.session.cases.subscribe((changes) => {
            changes.map((change) => {
                if (change.status === 'added') {
                    change.value.color.subscribe((newColor) => {
                        if (change.value.id in this.chartDatasetsMap) {
                            this.chartDatasetsMap[change.value.id].backgroundColor = newColor;
                            this.chart.update();
                        }
                    });
                    change.value.name.subscribe((newName) => {
                        if (change.value.id in this.chartDatasetsMap) {
                            this.chartDatasetsMap[change.value.id].label = newName;
                            this.chart.update();
                        }
                    });
                }
            });
        }, this.session.cases, "arrayChange");
        this.session.instances.subscribe((changes) => {
            // Find the case and generator
            let kills = [];
            changes.map((change) => {
                if (change.status === 'added') {
                    let aCase = change.value.fromCase;
                    if (!(aCase.id in this.chartDatasetsMap)) {
                        this.chartDatasetsMap[aCase.id] = {
                            label: aCase.name(),
                            data: [],
                            backgroundColor: aCase.color(),
                            _id: aCase.id
                        }
                        this.chartData.datasets.push(this.chartDatasetsMap[aCase.id]);
                    }
                    this.chartDatasetsMap[aCase.id].data.push({x: change.value.value(), y: change.value.steps()});
                } else if (change.status === 'deleted') {
                    let aCase = change.value.fromCase;
                    removeXY(this.chartDatasetsMap[aCase.id].data, change.value.value(), change.value.steps());
                    if (this.chartDatasetsMap[aCase.id].data.length === 0) {
                        if (!kills.includes(aCase.id)) {
                            kills.push(aCase.id);
                        }
                    }
                }
            });
            kills.map(cid => {
                delete this.chartDatasetsMap[cid];
                let removalIndex = null;
                for (let i=0; i<this.chartData.datasets.length; i++) {
                    if (this.chartData.datasets[i]._id === cid) {
                        removalIndex = i;
                    }
                }
                if (removalIndex !== null) {
                    this.chartData.datasets.splice(removalIndex, 1);
                }
            });
            this.chart.update();
            this.chart.resize();
        }, this.session.instances, "arrayChange");
    }

    /**
     * Replace the current session with the given JSON data. `file` names the file in
     * sessions/ it came from, so the dropdown can show it; omit it for the starter.
     */
    applySession(data, file) {
        this.session.fromJson(data, file);
    }

    /** Show a short message with the cases, clearing it after `clearAfter` ms (0 = leave it). */
    say(message, clearAfter = HINT_TIMEOUT_MS) {
        if (this.hintTimer !== null) {
            clearTimeout(this.hintTimer);
            this.hintTimer = null;
        }
        this.hint(message);
        if (clearAfter > 0) {
            this.hintTimer = setTimeout(() => {
                this.hintTimer = null;
                this.hint("");
            }, clearAfter);
        }
    }

    /**
     * The shortcut was pressed. The first press only offers; the second fills the
     * empty cases in. Says why nothing will happen rather than arming pointlessly.
     */
    requestFillEmptyCases() {
        if (this.session.inputs().length === 0) {
            this.say("Add an input parameter first, then this will suggest inputs for it.");
            return "unavailable";
        }
        if (this.session.cases().length > 0 && this.session.emptyCases().length === 0) {
            this.say("Every case already has inputs, so there is nothing to fill in.");
            return "unavailable";
        }
        return this.fillShortcut.press();
    }

    /** Fill every empty case with inputs to run. Nothing is run. */
    fillEmptyCases() {
        const {filled, note} = this.session.fillEmptyCases();
        if (filled.length === 0) {
            this.say("There were no empty cases to fill in.");
            return filled;
        }
        const cases = filled.join(" and ");
        this.say(note
            ? `Filled in ${cases}. ${note} Use the Run buttons to plot them.`
            : `Added example inputs to ${cases}.`
                + " Edit them so each case really is its best or worst, then use the Run buttons.");
        return filled;
    }

    /** Fetch sessions/index.json and populate the "Load example" dropdown. */
    loadExampleIndex() {
        return fetchExampleIndex().then((index) => {
            this.examples(index.groups || []);
        }, (error) => {
            console.error("Could not load the example index (sessions/index.json)", error);
        });
    }

    /** Load a curated example by file name (e.g. "RCB_binary_search.json"). */
    loadExample(file) {
        const result = $.Deferred();
        // Run outside the <select> change event: Chromium leaves the dropdown stuck if a
        // confirm() dialog opens while the event is still being dispatched.
        setTimeout(() => {
            if (this.session.hasUnsavedWork()) {
                if (document.activeElement) {
                    document.activeElement.blur();
                }
                if (!confirm(`Load the example "${file}"?\nThis will replace your current algorithm, cases, and plotted instances.`)) {
                    result.reject();
                    return;
                }
            }
            fetchExample(file).then((data) => {
                try {
                    this.applySession(data, file);
                } catch (error) {
                    // Never let one bad session file leave the page in a state where
                    // nothing else will load
                    alert(`Could not load the example: ${file}`);
                    console.error(error);
                    result.reject(error);
                    return;
                }
                // Make the page link shareable: ?preload=<file>
                window.history.replaceState(null, "", preloadUrl(file));
                result.resolve(data);
            }, (error) => {
                alert(`Could not load the example: ${file}`);
                console.error(error);
                result.reject(error);
            });
        }, 0);
        return result.promise();
    }

}

$(document).ready(function() {
    setup();

    const urlParams = new URLSearchParams(window.location.search);
    const preloadName = urlParams.get('preload');

    let chart = document.getElementById("runtime-chart");
    let model = new CaseBuilderModel(chart, {});

    const start = () => {
        ko.applyBindings(model);
        console.log(model.session.toJson());
    };

    if (preloadName != null) {
        fetchExample(preloadName).then((data) => {
            try {
                model.applySession(data, preloadName);
            } catch (error) {
                alert(`The given session could not be loaded: ${preloadName}`);
                console.error(error);
                model.applySession(STARTER_SESSION);
            }
            start();
        }, (error) => {
            alert(`The given session was not found: ${preloadName}\nCheck that the URL was correct?`);
            console.error(error);
            // Fall back to the starter so the page is still usable
            model.applySession(STARTER_SESSION);
            start();
        });
    } else {
        model.applySession(STARTER_SESSION);
        start();
    }

    // Ctrl+I twice fills the empty cases with example inputs
    $(document).on('keydown', function (event) {
        if (!isFillShortcut(event)) {
            return;
        }
        event.preventDefault();
        model.requestFillEmptyCases();
    });

    model.loadExampleIndex();
});

