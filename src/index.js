
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


import {Session, Input, Case, Generator, Instance} from './models.js';

function setup() {
    // Configure Skulpt
    Sk.configure({
        __future__: Sk.python3,
        //output: this.print.bind(this),
        retainGlobals: false
    });

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

}

$(document).ready(function() {
    setup();

    const urlParams = new URLSearchParams(window.location.search);
    const preloadName = urlParams.get('preload');

    let chart = document.getElementById("runtime-chart");
    let model = new CaseBuilderModel(chart, {});

    if (preloadName != null) {
        $.getJSON(`sessions/${preloadName}`, (data) => {
            model.session.fromJson(data);
            ko.applyBindings(model);
        }).fail((error) => {
            alert(`The given session was not found: ${preloadName}\nCheck that the URL was correct?`)
            console.error(error);
        });
    } else {
        model.session.code(`sum = 0
for i in range(n):
    for j in range(n):
        sum = sum + i + j
print(sum)
    
    `);
        ko.applyBindings(model);

        model.session.inputs.push(new Input("n", "int"));
        model.session.inputs.push(new Input("array", "list[int]"));

        model.session.cases.push(new Case(null, "Best", "#00FF00", [
            new Generator(null, [ko.observable("3"), ko.observable("[randint(0, 10) for i in range(n)]")]),
            new Generator(null, [ko.observable("4"), ko.observable("[1,2,3, 4]")])
        ]));
    }

    console.log(model.session.toJson());
});

