/* global angular, moment, dhis2, parseFloat */

'use strict';

/* Services */

var iprmServices = angular.module('iprmServices', ['ngResource'])

.factory('D2StorageService', function(){
    var store = new dhis2.storage.Store({
        name: "dhis2iprm",
        adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
        objectStores: ['dataElements', 'dataElementGroups', 'dataElementGroupSets', 'programs', 'optionSets', 'optionGroups', 'categoryCombos', 'attributes', 'ouLevels']
    });
    return{
        currentStore: store
    };
})

.service('PeriodService', function(CalendarService, DateUtils){

    this.getPeriods = function(periodType, periodOffset, futurePeriods){
        if(!periodType){
            return [];
        }

        var calendarSetting = CalendarService.getSetting();

        dhis2.period.format = calendarSetting.keyDateFormat;

        dhis2.period.calendar = $.calendars.instance( calendarSetting.keyCalendar );

        dhis2.period.generator = new dhis2.period.PeriodGenerator( dhis2.period.calendar, dhis2.period.format );

        dhis2.period.picker = new dhis2.period.DatePicker( dhis2.period.calendar, dhis2.period.format );

        var d2Periods = dhis2.period.generator.generateReversedPeriods( periodType, periodOffset );

        d2Periods = dhis2.period.generator.filterOpenPeriods( periodType, d2Periods, futurePeriods, null, null );

        angular.forEach(d2Periods, function(p){
            p.endDate = DateUtils.getPeriodDate(p, '_endDate');
            p.startDate = DateUtils.getPeriodDate(p, '_startDate');
            p.displayName = p.name;
            p.id = p.iso;
        });

        return d2Periods;
    };
})

/* Factory to fetch optionSets */
.factory('OptionSetService', function($q, $rootScope, D2StorageService) {
    return {
        getAll: function(){

            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll('optionSets').done(function(optionSets){
                    $rootScope.$apply(function(){
                        def.resolve(optionSets);
                    });
                });
            });

            return def.promise;
        },
        get: function(uid){
            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.get('optionSets', uid).done(function(optionSet){
                    $rootScope.$apply(function(){
                        def.resolve(optionSet);
                    });
                });
            });
            return def.promise;
        },
        getCode: function(options, key){
            if(options){
                for(var i=0; i<options.length; i++){
                    if( key === options[i].displayName){
                        return options[i].code;
                    }
                }
            }
            return key;
        },
        getName: function(options, key){
            if(options){
                for(var i=0; i<options.length; i++){
                    if( key === options[i].code){
                        return options[i].displayName;
                    }
                }
            }
            return key;
        }
    };
})


/* Factory to fetch programs */
.factory('ProgramFactory', function($q, $rootScope, D2StorageService, CommonUtils, orderByFilter) {

    return {
        get: function(uid){

            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.get('programs', uid).done(function(ds){
                    $rootScope.$apply(function(){
                        def.resolve(ds);
                    });
                });
            });
            return def.promise;
        },
        getByOu: function(ou, selectedProgram){
            var def = $q.defer();

            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll('programs').done(function(prs){
                    var programs = [];
                    angular.forEach(prs, function(pr){
                        if(pr.organisationUnits.hasOwnProperty( ou.id ) && pr.id && CommonUtils.userHasWriteAccess( 'ACCESSIBLE_PROGRAMS', pr.id)){
                            programs.push(pr);
                        }
                    });

                    programs = orderByFilter(programs, '-displayName').reverse();

                    if(programs.length === 0){
                        selectedProgram = null;
                    }
                    else if(programs.length === 1){
                        selectedProgram = programs[0];
                    }
                    else{
                        if(selectedProgram){
                            var continueLoop = true;
                            for(var i=0; i<programs.length && continueLoop; i++){
                                if(programs[i].id === selectedProgram.id){
                                    selectedProgram = programs[i];
                                    continueLoop = false;
                                }
                            }
                            if(continueLoop){
                                selectedProgram = null;
                            }
                        }
                    }

                    if(!selectedProgram || angular.isUndefined(selectedProgram) && programs.legth > 0){
                        selectedProgram = programs[0];
                    }

                    $rootScope.$apply(function(){
                        def.resolve({programs: programs, selectedProgram: selectedProgram});
                    });
                });
            });
            return def.promise;
        }
    };
})


/* factory to fetch and process programValidations */
.factory('MetaDataFactory', function($q, $rootScope, D2StorageService, orderByFilter) {

    return {
        get: function(store, uid){
            var def = $q.defer();
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.get(store, uid).done(function(obj){
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });
            return def.promise;
        },
        set: function(store, obj){
            var def = $q.defer();
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.set(store, obj).done(function(obj){
                    $rootScope.$apply(function(){
                        def.resolve(obj);
                    });
                });
            });
            return def.promise;
        },
        getAll: function(store){
            var def = $q.defer();
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll(store).done(function(objs){
                    objs = orderByFilter(objs, '-displayName').reverse();
                    $rootScope.$apply(function(){
                        def.resolve(objs);
                    });
                });
            });
            return def.promise;
        },
        getByProperty: function(store, prop, val){
            var def = $q.defer();
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll(store).done(function(objs){
                    var selectedObjs = [];
                    for(var i=0; i<objs.length; i++){
                        if(objs[i][prop] ){
                            if( val ){
                                if( objs[i][prop] === val )
                                {
                                    selectedObjs.push( objs[i] );
                                }
                            }
                            else{
                                selectedObjs.push( objs[i] );
                            }
                        }
                    }

                    $rootScope.$apply(function(){
                        def.resolve( selectedObjs );
                    });
                });
            });
            return def.promise;
        },
        getDataElementGroupSets: function(){
            var def = $q.defer();
            var dataElementGroupsById = {};
            D2StorageService.currentStore.open().done(function(){
                D2StorageService.currentStore.getAll('dataElementGroups').done(function(dataElementGroups){
                    angular.forEach(dataElementGroups, function(deg){
                        dataElementGroupsById[deg.id] = deg;
                    });

                    D2StorageService.currentStore.getAll('dataElementGroupSets').done(function(dataElementGroupSets){
                        angular.forEach(dataElementGroupSets, function(degs){
                            var groups = [];
                            angular.forEach(degs.dataElementGroups, function(deg){
                                var _deg = dataElementGroupsById[deg.id];
                                if(_deg){
                                    groups.push(_deg);
                                }
                            });

                            degs.dataElementGroups = groups;
                        });
                        $rootScope.$apply(function(){
                           def.resolve(dataElementGroupSets);
                        });
                    });
                });

            });
            return def.promise;
        }
    };
})

.service('EventService', function($http, $q, $translate, DHIS2URL, CommonUtils, DateUtils, FileService, OptionSetService, NotificationService) {


    var getByFilter = function( filter, dataElementsById, optionSetsById ){
        var url = DHIS2URL + '/tracker/events.json?pageSize=5000&' + filter;

        /*if( startDate && endDate ){
            url += '&startDate=' + startDate + '&endDate=' + endDate;
        }

        if( attributeCategoryUrl && !attributeCategoryUrl.default ){
            url += '&attributeCc=' + attributeCategoryUrl.cc + '&attributeCos=' + attributeCategoryUrl.cp;
        }

        if( categoryOptionCombo ){
            url += '&coc=' + categoryOptionCombo;
        }*/

        var promise = $http.get( url ).then(function(response){
            var events = response.data && response.data.instances ? response.data.instances : [];
            var activities = [];
            if( response && response.data && response.data.instances ){
                angular.forEach(events, function(ev){
                    var activity = {
                        eventDate: DateUtils.formatFromApiToUser(ev.occurredAt),
                        dueDate: DateUtils.formatFromApiToUser(ev.scheduledAt),
                        attributeOptionCombo: ev.attributeOptionCombo,
                        attributeCategoryOptions: ev.attributeCategoryOptions,
                        uploadedBy: ev.storedBy,
                        event: ev.event,
                        orgUnitName: ev.orgUnitName,
                        orgUnit: ev.orgUnit,
                        status: ev.status,
                        program: ev.program,
                        programStage: ev.programStage
                    };

                    if( ev.dataValues ){
                        angular.forEach(ev.dataValues, function(dv){
                            var val = dv.value;
                            var de = dataElementsById[dv.dataElement];
                            if( de ){
                                val = CommonUtils.formatDataValue(de,val, optionSetsById, 'USER' );
                            }
                            activity[dv.dataElement] = val;
                        });
                    }
                    activities.push( activity );
                });
            }
            return activities;

        }, function(response){
            CommonUtils.errorNotifier(response);
        });

        return promise;
    };

    var get = function(eventUid){
        var promise = $http.get(DHIS2URL + '/events/' + eventUid + '.json').then(function(response){
            return response.data;
        });
        return promise;
    };

    var create = function(dhis2Event){
        var promise = $http.post(DHIS2URL + '/events.json', dhis2Event).then(function(response){
            return response.data;
        }, function(response){
            CommonUtils.errorPostNotifier(response.data);
        });
        return promise;
    };

    var remove = function(dhis2Event){
        var promise = $http.delete(DHIS2URL + '/events/' + dhis2Event.event).then(function(response){
            return response.data;
        });
        return promise;
    };

    var update = function(dhis2Event){
        var promise = $http.put(DHIS2URL + '/events/' + dhis2Event.event, dhis2Event).then(function(response){
            return response.data;
        });
        return promise;
    };

    var processData = function(data, categoryCombo){
        if ( !data || !categoryCombo || !categoryCombo.categories ){
            return;
        }

        var optionsById = [];
        angular.forEach(categoryCombo.categories, function(ca){
            angular.forEach(ca.categoryOptions, function(op){
                optionsById[op.id] = {op: op.displayName, ca: ca.id};
            });
        });

        angular.forEach(data, function(d){
            var optionIds = d.attributeCategoryOptions.split(';');
            if ( optionIds && optionIds.length > 0 ){
                angular.forEach(optionIds, function(optionId){
                    var op = optionsById[optionId];
                    if ( op ){
                        d[op.ca] = op.op;
                    }
                });
            }
        });
        return data;
    };
    return {
        get: get,
        create: create,
        remove: remove,
        update: update,
        getByFilter: getByFilter,
        processData: processData
    };
})

.service('DataValueService', function($http, CommonUtils) {

    return {
        saveDataValue: function( dv ){

            var url = '?de='+dv.de + '&ou='+dv.ou + '&pe='+dv.pe + '&co='+dv.co + '&value='+dv.value;

            if( dv.cc && dv.cp ) {
                url += '&cc='+dv.cc + '&cp='+dv.cp;
            }
            if( dv.comment ){
                url += '&comment=' + dv.comment;
            }
            if(dv.followUp || dv.followUp === false){
                url+='&followUp=' + dv.followUp;
            }
            var promise = $http.post('../api/dataValues.json' + url).then(function(response){
                return response.data;
            });
            return promise;
        },
        getDataValue: function( dv ){
            var promise = $http.get('../api/dataValues.json?de='+dv.de+'&ou='+dv.ou+'&pe='+dv.pe).then(function(response){
                return response.data;
            });
            return promise;
        },
        saveDataValueSet: function( dvs ){
            var promise = $http.post('../api/dataValueSets.json', dvs ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        },
        getDataValueSet: function( params ){
            var promise = $http.get('../api/dataValueSets.json?' + params ).then(function(response){
                return response.data;
            }, function(response){
                CommonUtils.errorNotifier(response);
            });
            return promise;
        }
    };
})

.service('OrgUnitService', function($http){
    var orgUnit, orgUnitPromise;
    return {
        get: function( uid, level ){
            if( orgUnit !== uid ){
                orgUnitPromise = $http.get( '../api/organisationUnits.json?filter=path:like:/' + uid + '&filter=level:le:' + level + '&fields=id,displayName,path,level,parent[id]&paging=false' ).then(function(response){
                    orgUnit = response.data.id;
                    return response.data;
                });
            }
            return orgUnitPromise;
        }
    };
})


/*Orgunit service for local db */
.service('IndexDBService', function($window, $q){

    var indexedDB = $window.indexedDB;
    var db = null;

    var open = function( dbName ){
        var deferred = $q.defer();

        var request = indexedDB.open( dbName );

        request.onsuccess = function(e) {
          db = e.target.result;
          deferred.resolve();
        };

        request.onerror = function(){
          deferred.reject();
        };

        return deferred.promise;
    };

    var get = function(storeName, uid){

        var deferred = $q.defer();

        if( db === null){
            deferred.reject("DB not opened");
        }
        else{
            var tx = db.transaction([storeName]);
            var store = tx.objectStore(storeName);
            var query = store.get(uid);

            query.onsuccess = function(e){
                deferred.resolve(e.target.result);
            };
        }
        return deferred.promise;
    };

    return {
        open: open,
        get: get
    };
});
