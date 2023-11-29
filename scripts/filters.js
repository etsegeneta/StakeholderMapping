'use strict';

/* Filters */

var iprmFilters = angular.module('iprmFilters', [])

.filter('getFirst', function(){
    return function(data, obj){
        if(!data ){
            return;
        }
        if(!obj){
            return data;
        }
        else{
            var res = data.filter(function(item){
                var match = true;
                for( var k in obj ){
                    match = match && item[k] === obj[k];
                    if( !match ){
                        return match;
                    }
                }
                return match;
            });
            if(res && res.length > 0){
                return res[0];
            }
            return null;
        }
    };
})

.filter('cascadeFilter', function($filter, OptionSetService){

    return function( options, dataElement, currentData, optionSetsById, optionGroups, dataElementsByCode ){

        if ( dataElement && dataElement.cascadeControllerParent && dataElement.optionSetValue &&
                dataElement.optionSet.id  && optionGroups && optionGroups.length > 0){

            var controllerDataElement = dataElementsByCode[dataElement.cascadeControllerParent];
            var optionSet = optionSetsById[dataElement.optionSet.id];
            if ( controllerDataElement && controllerDataElement.id &&
                    currentData[controllerDataElement.id] && currentData[controllerDataElement.id] !== 'undefined' &&
                    controllerDataElement.optionSetValue && controllerDataElement.optionSet.id ){

                var val = currentData[controllerDataElement.id];
                var op = OptionSetService.getByName( optionSetsById[controllerDataElement.optionSet.id], val );

                if ( op && op.cascadeControlledGroup ){
                    var og = $filter('getFirst')(optionGroups, {code: op.cascadeControlledGroup});
                    if ( og && og.options.length > 0 ){
                        var filteredOptions = [];

                        angular.forEach(optionSet.options, function(o){
                            if ( og.options.indexOf(o.id) !== -1 ){
                                filteredOptions.push( o );
                            }
                        });
                        return filteredOptions;
                    }
                }
            }
        }

        return options;
    };
})

.filter('dataFilter', function(){
    return function(data, obj){
        if(!data ){
            return;
        }
        if(!obj ){
            return data;
        }
        else{
            return data.filter(function(item){
                var match = true;
                for( var k in obj ){
                    if ( obj[k] && obj[k].displayName ){
                        match = match && item[k] === obj[k].displayName;
                        if( !match ){
                            return match;
                        }
                    }
                }
                return match;
            });
        }
    };
});