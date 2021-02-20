import ko from "knockout";
import CodeMirror from 'codemirror';
import 'codemirror/mode/python/python.js';


//pythonCM.setSize(400, 150);

// Knockout codemirror binding handler
ko.bindingHandlers.codemirror = {
    init: function(element, valueAccessor) {
        let options = ko.unwrap(valueAccessor());
        let codeMirrorOptions = ko.toJS(options).options;
        if ('firstLineNumber' in options) {
            codeMirrorOptions.firstLineNumber = 1+options.firstLineNumber();
            options.firstLineNumber.subscribe((newValue) => {
                element.editor.setOption('firstLineNumber', 1+newValue);
            });
        }
        element.editor = CodeMirror(element, codeMirrorOptions);
        element.editor.on('change', function(cm) {
            options.value(cm.getValue());
        });
        //element.editor.setSize(400, (29)*6);

        ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
            let wrapper = element.editor.getWrapperElement();
            wrapper.parentNode.removeChild(wrapper);
        });
    },
    update: function(element, valueAccessor) {
        let value = ko.toJS(valueAccessor()).value;
        if (element.editor) {
            let cur = element.editor.getCursor();
            element.editor.setValue(value);
            element.editor.setCursor(cur);
            element.editor.refresh();
        }
    }
};
