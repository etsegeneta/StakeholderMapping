/* global angular, dhis2, art, iprm */

'use strict';

//Controller for settings page
iprm.controller('DataEntryController',
        function($scope,
        $translate,
        $filter,
        $modal,
        PeriodService,
        MetaDataFactory,
        OrgUnitFactory,
        EventService,
        DateUtils,
        CommonUtils,
        ModalService,
        DialogService,
        NotificationService) {

    $scope.model = {
        metaDataCached: false,
        validGroups: [],
        dataElementGroupSetsByCode: {},
        dataElementGroupSet: null,
        selectedPeriod: null,
        periods: [],
        periodType: 'Yearly',
        periodOffset: 0,
        openFuturePeriods: 3,
        categoryCombosById: {},
        selectedAttributeCategoryCombo: null,
        selectedCategoryCombo: null,
        listSize: 20,
        dataElementsWithGroup: {},
        formState: null,
        fillingOrganization: null,
        showFillingOrganization: true,
        costCategoryItems: [],
        dataElementsByCode: [],
        dataElementsById: [],
        optionGroups: []
    };


    $scope.model.booleanValues = [{displayName: $translate.instant('yes'), value: true},{displayName: $translate.instant('no'), value: false}];

    //Fetch metadata necessary to render dataentry form
    MetaDataFactory.getAll('optionSets').then(function(optionSets){
        $scope.model.optionSets = optionSets;
        $scope.model.optionSetsById = optionSets.reduce( function(map, obj){
            map[obj.id] = obj;
            return map;
        }, {});

        MetaDataFactory.getAll('optionGroups').then(function(ogs){
            $scope.model.optionGroups = ogs;

            MetaDataFactory.getAll('categoryCombos').then(function(ccs){
                angular.forEach(ccs, function(cc){
                    angular.forEach(cc.categories, function(c){
                        let validOptions = c.categoryOptions.filter(function(co){
                            return CommonUtils.userHasWriteAccess( 'ACCESSIBLE_CATEGORY_OPTIONS', co.id);
                        });
                        c.categoryOptions = validOptions;
                    });
                    $scope.model.categoryCombosById[cc.id] = cc;
                });

                MetaDataFactory.getAll('dataElements').then(function(dataElements){
                    angular.forEach(dataElements, function(de){
                        $scope.model.dataElementsById[de.id] = de;
                        if( de.code ){
                            $scope.model.dataElementsByCode[de.code] = de;
                        }
                    });

                    MetaDataFactory.getAll('dataElementGroups').then(function( dataElementGroups ){
                        $scope.model.dataElementGroups = dataElementGroups;

                        var deg = $filter('filter')(dataElementGroups, {isCostCategory: true});

                        if ( deg && deg[0] ){
                            angular.forEach(deg[0].dataElements, function(de){
                                $scope.model.costCategoryItems.push( de.id );
                            });
                        }

                        MetaDataFactory.getDataElementGroupSets('dataElementGroupSets').then(function( dataElementGroupSets ){
                            var degs = $filter('filter')(dataElementGroupSets, {mappingTemplate: 'stakeholderMapping'});

                            if(!degs || degs.length === 0 ){
                                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_metadata_degs"));
                                return;
                            }

                            $scope.model.dataElementGroupSetsByCode = degs.reduce( function(map, obj){
                                map[obj.code] = obj;
                                return map;
                            }, {});

                            MetaDataFactory.getByProperty('programs', 'mappingTemplate', 'stakeholderMapping' ).then(function( programs ){
                                $scope.model.programs = programs.filter(function(pr){
                                    return CommonUtils.userHasWriteAccess( 'ACCESSIBLE_PROGRAMS', pr.id);
                                });
                                $scope.model.periodType = 'Yearly';
                                $scope.model.periods = PeriodService.getPeriods( $scope.model.periodType, $scope.model.periodOffset,  $scope.model.openFuturePeriods );

                                //Get orgunits for the logged in user
                                $scope.model.rootOrgUnits = [];
                                OrgUnitFactory.getCaptureTreeRoot().then(function(response) {
                                    $scope.orgUnits = response.organisationUnits;
                                    angular.forEach($scope.orgUnits, function(ou){
                                        $scope.model.rootOrgUnits.push( ou );
                                        ou.show = true;
                                        angular.forEach(ou.children, function(o){
                                            o.hasChildren = o.children && o.children.length > 0 ? true : false;
                                        });
                                    });
                                });

                            });
                        });
                    });
                });
            });
        });
    });

    //watch for selection of program
    $scope.$watch('model.selectedProgram', function() {
        $scope.model.categoryOptionsReady = false;
        $scope.model.selectedProgramStage = null;
        $scope.model.headers = [];
        $scope.model.fillingOrganization = null;
        resetCategoryOptions();
        $scope.model.selectedAttributeCategoryCombo = null;
        if( angular.isObject($scope.model.selectedProgram) && $scope.model.selectedProgram.id){
            $scope.loadProgramDetails();
        }
    });

    $scope.loadProgramDetails = function(){
        if( $scope.model.selectedProgram && $scope.model.selectedProgram.id ){

            $scope.model.selectedAttributeCategoryCombo = $scope.model.categoryCombosById[$scope.model.selectedProgram.categoryCombo.id];
            var hasFillingOrganization = false;
            angular.forEach($scope.model.selectedAttributeCategoryCombo.categories, function(ca){
                if(ca.isFillingOrganization){
                    hasFillingOrganization = true;
                }
                else{
                    ca.isFillingOrganization = false;
                }
            });

            if( !hasFillingOrganization ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_metadata_stakeholder_matrix"));
                return;
            }

            if ( !$scope.model.selectedProgram.code ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_metadata_program_no_code"));
                return;
            }

            $scope.model.dataElementGroupSet = $scope.model.dataElementGroupSetsByCode[$scope.model.selectedProgram.code];

            if ( !$scope.model.dataElementGroupSet ){
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_metadata_missing_degs"));
                return;
            }

            $scope.model.selectedProgramStage = $scope.model.selectedProgram.programStages[0];

            var prDes = $scope.model.selectedProgramStage.programStageDataElements;

            $scope.model.headers = [{id: 'orgUnitName', displayName: $translate.instant("woreda"), valueType: 'ORG_UNIT', optionSetValue: false, compulsory: true}];
            angular.forEach(prDes, function(prstde){
                var de = $scope.model.dataElementsById[prstde.dataElement.id];
                if ( de ){
                    de.compulsory = prstde.compulsory;
                    $scope.model.headers.push( de );
                }
            });
        }
    };
    
    $scope.userHasWriteAccess = function( objId ) {
        var res = CommonUtils.userHasWriteAccess( 'ACCESSIBLE_CATEGORY_OPTIONS', objId );
        console.log('res:  ', res);
        return res;
    };

    $scope.showOrgUnitTree = function( activity ){
        var ou = {displayName: activity.orgUnitName, id: activity.orgUnit};
        var modalInstance = $modal.open({
            templateUrl: 'components/outree/orgunit-tree.html',
            controller: 'OuTreeController',
            resolve: {
                orgUnits: function(){
                    return $scope.orgUnits;
                },
                selectedOrgUnit: function(){
                    return ou;
                },
                validOrgUnits: function(){
                    return null;
                }
            }
        });

        modalInstance.result.then(function ( selectedOu ) {
            if( selectedOu && selectedOu.id ){
                activity.orgUnitName = selectedOu.displayName;
                activity.orgUnit = selectedOu.id;
            }
        });
    };

    $scope.$watch('model.selectedPeriod', function(){
        resetCategoryOptions();
        $scope.dataValues = {};
        $scope.dataValuesCopy = {};
        $scope.model.valueExists = false;
        $scope.loadDataEntryForm();
    });

    $scope.getPeriods = function(mode){
        $scope.model.selectedPeriod = null;
        $scope.model.periodOffset = mode === 'NXT' ? ++$scope.model.periodOffset : --$scope.model.periodOffset;
        $scope.model.periods = PeriodService.getPeriods( $scope.model.periodType, $scope.model.periodOffset,  $scope.model.openFuturePeriods );
    };

    var resetCategoryOptions = function(){
        if ( $scope.model.selectedAttributeCategoryCombo && $scope.model.selectedAttributeCategoryCombo.id )
        {
            angular.forEach($scope.model.selectedAttributeCategoryCombo.categories, function(ca){
                delete ca.selectedOption;
            });
        }
        $scope.model.categoryOptionsReady = false;
    };

    function checkOptions(){
        $scope.model.fillingOrganization = null;
        $scope.resetParams();
        for(var i=0; i<$scope.model.selectedAttributeCategoryCombo.categories.length; i++){
            if($scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption && $scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption.id){
                $scope.model.categoryOptionsReady = true;
                $scope.model.selectedOptions.push($scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption);
                if( $scope.model.selectedAttributeCategoryCombo.categories[i].isFillingOrganization){
                    $scope.model.fillingOrganization = $scope.model.selectedAttributeCategoryCombo.categories[i].selectedOption;
                }
            }
            else{
                $scope.model.categoryOptionsReady = false;
                break;
            }
        }
        if($scope.model.categoryOptionsReady){
            $scope.loadDataEntryForm();
        }
    };

    $scope.getCategoryOptions = function(){
        $scope.model.categoryOptionsReady = false;
        $scope.model.selectedOptions = [];
        checkOptions();
    };

    $scope.loadDataEntryForm = function(){
        $scope.model.formStarted = false;
        $scope.model.formReady = false;
        $scope.resetParams();
        if( angular.isObject( $scope.model.selectedPeriod) && $scope.model.selectedPeriod.id &&
                $scope.model.selectedProgram && $scope.model.selectedProgram.id &&
                $scope.model.categoryOptionsReady ){

            var eventUrl = 'program=' + $scope.model.selectedProgram.id;
            eventUrl += '&attributeCc=' + $scope.model.selectedAttributeCategoryCombo.id;
            eventUrl += '&attributeCos=' + $.map($scope.model.selectedOptions, function(op){return op.id;}).join(';');
            eventUrl += '&startDate=' + $scope.model.selectedPeriod.startDate + '&endDate=' + $scope.model.selectedPeriod.endDate;
            eventUrl += '&ouMode=DESCENDANTS&paging=false';

            angular.forEach($scope.model.rootOrgUnits, function(ou){
                eventUrl += '&orgUnit=' + ou.id;
            });

            //fetch data activities
            $scope.model.activities = [];
            $scope.model.formStarted = true;
            $scope.model.selectedActivity = null;
            $scope.newActivity = {};
            EventService.getByFilter( eventUrl, $scope.model.dataElementsById, $scope.model.optionSetsById ).then(function(activities){
                $scope.model.activities = activities;
                $scope.model.formStarted = false;
                $scope.model.formReady = true;
            });
        }
    };

    $scope.interacted = function(field) {
        var status = false;
        if(field){
            status = $scope.outerForm.submitted || field.$dirty;
        }
        return status;
    };

    $scope.showEdit = function( activity ){
        $scope.model.formState = 'EDIT';
        $scope.model.selectedActivity = angular.copy(activity);
    };

    $scope.cancelEdit = function( activity ){
        $scope.model.formState = null;
        activity = angular.copy( $scope.model.selectedActivity );
        $scope.model.selectedActivity = null;
    };

    $scope.addActivity = function(){
        //check for form validity
        $scope.outerForm.submitted = true;
        if( $scope.outerForm.$invalid ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("form_is_not_valid") );
            return false;
        }

        if ( $scope.model.invalidCostValues ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("cost_category_more_than_100") );
            return false;
        }

        var dataValues = [];
        angular.forEach($scope.model.selectedProgramStage.programStageDataElements, function(prstde){
            var val = $scope.newActivity[prstde.dataElement.id];
            var de = $scope.model.dataElementsById[prstde.dataElement.id];
            if( de ){
                val = CommonUtils.formatDataValue( de, val, $scope.model.optionSetsById, 'API' );
            }
            var dv = {
                dataElement: prstde.dataElement.id,
                value: val
            };
            dataValues.push( dv );
        });

        var ev = {
            orgUnit: $scope.newActivity.orgUnit,
            program: $scope.model.selectedProgram.id,
            programStage: $scope.model.selectedProgramStage.id,
            attributeCategoryOptions: $.map($scope.model.selectedOptions, function(op){return op.id;}).join(';'),
            status: 'ACTIVE',
            eventDate: $scope.model.selectedPeriod.startDate,
            dueDate: $scope.model.selectedPeriod.startDate,
            dataValues: dataValues
        };

        $scope.newActivity.eventDate = DateUtils.formatFromApiToUser($scope.model.selectedPeriod.startDate);
        $scope.newActivity.dueDate = DateUtils.formatFromApiToUser($scope.model.selectedPeriod.startDate);
        $scope.newActivity.program = $scope.model.selectedProgram.id;
        $scope.newActivity.programStage = $scope.model.selectedProgramStage.id;
        $scope.newActivity.attributeCategoryOptions = $.map($scope.model.selectedOptions, function(op){return op.id;}).join(';');


        EventService.create( ev ).then(function( data ){
            if( data && data.response && data.response.status && data.response.status === 'SUCCESS' ){
                var _ev = angular.copy( $scope.newActivity );
                _ev.event = data.response.importSummaries[0].reference;
                $scope.model.activities.splice(0,0,angular.copy( _ev ));
            }
            $scope.resetParams();
        });
    };

    $scope.updateActivity = function( activity ){
        //check for form validity
        $scope.outerForm.submitted = true;
        if( $scope.outerForm.$invalid ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("form_is_not_valid") );
            return false;
        }

        if ( $scope.model.invalidCostValues ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("cost_category_more_than_100") );
            return false;
        }

        var dataValues = [];
        angular.forEach($scope.model.selectedProgramStage.programStageDataElements, function(prstde){
            var val = activity[prstde.dataElement.id];
            var de = $scope.model.dataElementsById[prstde.dataElement.id];
            if( de ){
                val = CommonUtils.formatDataValue( de, val, $scope.model.optionSetsById, 'API' );
            }
            var dv = {
                dataElement: prstde.dataElement.id,
                value: val
            };
            dataValues.push( dv );
        });

        var ev = {
            event: activity.event,
            orgUnit: activity.orgUnit,
            program: $scope.model.selectedProgram.id,
            programStage: $scope.model.selectedProgramStage.id,
            attributeCategoryOptions: $.map($scope.model.selectedOptions, function(op){return op.id;}).join(';'),
            status: 'ACTIVE',
            eventDate: DateUtils.formatFromUserToApi(activity.eventDate),
            dueDate: DateUtils.formatFromUserToApi(activity.dueDate),
            dataValues: dataValues
        };

        EventService.update( ev ).then(function( data ){
            if( data && data.response && data.response.status && data.response.status === 'SUCCESS' ){
            }
            $scope.resetParams();
        });
    };

    $scope.copyActivity = function( activity ){
        $scope.model.selectedActivity = angular.copy(activity);

        var ou = {displayName: activity.orgUnitName, id: activity.orgUnit};
        var modalInstance = $modal.open({
            templateUrl: 'components/duplicate/duplicate.html',
            controller: 'DuplicateController',
            resolve: {
                orgUnits: function(){
                    return $scope.orgUnits;
                },
                selectedOrgUnit: function(){
                    return ou;
                },
                optionSetsById: function(){
                    return $scope.model.optionSetsById;
                },
                dataElementsById: function(){
                    return $scope.model.dataElementsById;
                },
                validOrgUnits: function(){
                    return null;
                },
                attributeCc: function(){
                    return $scope.model.selectedAttributeCategoryCombo.id;
                },
                attributeCos: function(){
                    return $.map($scope.model.selectedOptions, function(op){return op.id;}).join(';');
                },
                programStage: function(){
                    return $scope.model.selectedProgramStage;
                },
                activity: function(){
                    return activity;
                }
            }
        });

        modalInstance.result.then(function ( res ) {
            $scope.model.selectedActivity = null;

            //refresh list
            $scope.loadDataEntryForm();
        });
    };

    $scope.deleteActivity = function( activity ){
        $scope.model.selectedActivity = angular.copy(activity);

        var modalOptions = {
            closeButtonText: 'no',
            actionButtonText: 'yes',
            headerText: 'delete_activity',
            bodyText: 'are_you_sure_to_delete_activity'
        };

        ModalService.showModal({}, modalOptions).then(function(result){

            EventService.remove( activity ).then(function(activities){
                $scope.model.selectedActivity = null;
                var dialogOptions = {
                    headerText: 'success',
                    bodyText: 'activity_deleted'
                };
                DialogService.showDialog({}, dialogOptions);

                var index = -1;
                for( var i=0; i<$scope.model.activities.length; i++){
                    if( $scope.model.activities[i].event === activity.event  ){
                        index = i;
                        break;
                    }
                }
                if ( index !== -1 ){
                    $scope.model.activities.splice(index,1);
                }

            }, function(response){
                $scope.model.selectedActivity = null;
                CommonUtils.errorNotifier( response );
            });
        }, function(){
            $scope.model.selectedActivity = null;
        });
    };

    $scope.getCostCategoryTotal = function( activity ){
        var total = 0;
        angular.forEach($scope.model.costCategoryItems, function(item){
            total = CommonUtils.getSum(total, activity[item]);
        });

        return total;
    };

    $scope.processCostCategory = function(de, ac){
        $scope.model.invalidCostValues = false;
        if ( $scope.model.costCategoryItems.length > 0 && $scope.model.costCategoryItems.indexOf( de ) !== -1 ){
            var activity = null;
            if ( ac ){
                activity = ac;
            }
            else{
                activity = $scope.newActivity;
            }

            var total = $scope.getCostCategoryTotal( activity );

            if ( total > 100 ){
                $scope.model.invalidCostValues = true;
                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("cost_category_more_than_100"));
                return;
            }
        }
    };

    $scope.resetParams = function(){
        $scope.newActivity = {};
        $scope.model.formState = null;
        $scope.model.selectedActivity = null;
        $scope.outerForm.submitted = false;
        $scope.outerForm.$error = {};
        $scope.outerForm.$setPristine();
    };

    //expand/collapse orgunit tree
    $scope.expandCollapse = function(orgUnit) {
        if( orgUnit.hasChildren ){
            //Get children for the selected orgUnit
            $scope.treeLoadingStarted = true;
            $scope.treeLoaded = false;
            OrgUnitFactory.getChildren(orgUnit.id).then(function(ou) {
                orgUnit.show = !orgUnit.show;
                orgUnit.hasChildren = false;
                orgUnit.children = ou.children;
                angular.forEach(orgUnit.children, function(ou){
                    ou.hasChildren = ou.children && ou.children.length > 0 ? true : false;
                });
                $scope.treeLoadingStarted = false;
                $scope.treeLoaded = true;
            });
        }
        else{
            orgUnit.show = !orgUnit.show;
        }
    };

    $scope.setSelectedOrgUnit = function( orgUnit ){
        var index = $scope.model.selectedOrgUnits.indexOf( orgUnit.id );
        if ( index !== -1 ){
            $scope.model.selectedOrgUnits.splice(index, 1);
        }
        else{
            $scope.model.selectedOrgUnits.push( orgUnit.id );
        }
    };

});
