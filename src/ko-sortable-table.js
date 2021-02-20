import ko from "knockout";

ko.bindingHandlers.sortable = {
    init: function(element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {


        var asc = ko.observable(false);

        var value = valueAccessor();
        var prop = value.prop;
        var data = value.arr;

        if(!bindingContext.$data['currentClicked'])
        {
            bindingContext.$data['currentClicked'] = ko.observable();
        }


        var isActive = ko.computed(function()
        {
            return (bindingContext.$data['currentClicked']() === prop)
        });


        ko.applyBindingsToNode(element, {
                    css: {'sorting': isActive, 'asc': asc}
                }, bindingContext);


        element.onclick = function(){

            asc(!asc())

            bindingContext.$data['currentClicked'](prop);

            data.sort(function(left, right){
                var rec1 = left;
                var rec2 = right;

                if(!asc()) {
                    rec1 = right;
                    rec2 = left;
                }

                var props = prop.split('.');

                for(var i in props)
                {
                    var propName = props[i];
                    var parenIndex = propName.indexOf('()');

                    if(ko.isWriteableObservable(rec1[propName]))
                    {
                        rec1 = rec1[propName]();
                        rec2 = rec2[propName]();
                    } else {
                        rec1 = rec1[propName];
                        rec2 = rec2[propName];
                    }
                }

                return rec1 == rec2 ? 0 : rec1 < rec2 ? -1 : 1;
            });
        };
    }
};