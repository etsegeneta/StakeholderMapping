/* global angular, dhis2, art, iprm */

'use strict';

//Controller for settings page
iprm.controller('ReportController',
        function($scope,
        $translate,
        $filter,
        $modal,
        PeriodService,
        MetaDataFactory,
        OrgUnitFactory,
        EventService,
        CommonUtils,
        NotificationService) {

    $scope.model = {
        validGroups: [],
        dataElementGroupSetsByCode: {},
        selectedPeriod: null,
        periods: [],
        periodType: 'Yearly',
        periodOffset: 0,
        openFuturePeriods: 10,
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
        optionGroups: [],
        headers: [],
        dataFilter: null,
        filterText: {},
        reverse: false
    };

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
                            return CommonUtils.userHasReadAccess( 'ACCESSIBLE_CATEGORY_OPTIONS', co.id);
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

                            /*if(!degs || degs.length === 0 ){
                                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("invalid_metadata_degs"));
                                return;
                            }*/

                            $scope.model.dataElementGroupSetsByCode = degs.reduce( function(map, obj){
                                map[obj.code] = obj;
                                return map;
                            }, {});

                            MetaDataFactory.getByProperty('programs', 'mappingTemplate', 'stakeholderMapping' ).then(function( programs ){
                                $scope.model.programs = programs.filter(function(pr){
                                    return CommonUtils.userHasReadAccess( 'ACCESSIBLE_PROGRAMS', pr.id);
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
        $scope.model.selectedAttributeCategoryCombo = null;
        $scope.model.selectedProgramStage = null;
        $scope.model.headers = [];
        if( angular.isObject($scope.model.selectedProgram) && $scope.model.selectedProgram.id){
            $scope.loadProgramDetails();
        }
    });

    $scope.loadProgramDetails = function(){
        if( $scope.model.selectedProgram && $scope.model.selectedProgram.id ){
            $scope.model.selectedProgramStage = $scope.model.selectedProgram.programStages[0];
            $scope.model.selectedAttributeCategoryCombo = $scope.model.categoryCombosById[$scope.model.selectedProgram.categoryCombo.id];

            var ouHeader = {id: 'orgUnitName', displayName: $translate.instant("woreda"), valueType: 'ORG_UNIT', optionSetValue: false, compulsory: true, showFilter: false};
            $scope.model.headers.push( ouHeader);
            $scope.model.sortHeader = ouHeader.id;
            var hasFillingOrganization = false;
            angular.forEach($scope.model.selectedAttributeCategoryCombo.categories, function(ca){
                $scope.model.headers.push({
                    id: ca.id,
                    displayName: ca.displayName,
                    valueType: 'TEXT',
                    optionSetValue: false,
                    compulsory: true,
                    showFilter: false
                });
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

            var prDes = $scope.model.selectedProgramStage.programStageDataElements;
            angular.forEach(prDes, function(prstde){
                var de = $scope.model.dataElementsById[prstde.dataElement.id];
                if ( prstde.displayInReports && de ){
                    de.compulsory = prstde.compulsory;
                    de.shoFilter = false;
                    de.filterWithRange = de.valueType === 'DATE' ||
                        de.valueType === 'NUMBER' ||
                        de.valueType === 'INTEGER' ||
                        de.valueType === 'INTEGER_POSITIVE' ||
                        de.valueType === 'INTEGER_NEGATIVE' ||
                        de.valueType === 'INTEGER_ZERO_OR_POSITIVE' ? true : false,
                    $scope.model.headers.push( de );
                }
            });
        }
    };

    $scope.showOrgUnitTree = function(){
        var modalInstance = $modal.open({
            templateUrl: 'components/outree/orgunit-tree.html',
            controller: 'OuTreeController',
            resolve: {
                orgUnits: function(){
                    return $scope.orgUnits;
                },
                selectedOrgUnit: function(){
                    return $scope.selectedOrgUnit;
                },
                validOrgUnits: function(){
                    return null;
                }
            }
        });

        modalInstance.result.then(function ( selectedOu ) {
            if( selectedOu && selectedOu.id ){
                $scope.selectedOrgUnit = selectedOu;
                $scope.fetchData();
            }
        });
    };

    $scope.$watch('model.selectedPeriod', function(){
        $scope.fetchData();
    });

    $scope.getPeriods = function(mode){
        $scope.model.selectedPeriod = null;
        $scope.model.periodOffset = mode === 'NXT' ? ++$scope.model.periodOffset : --$scope.model.periodOffset;
        $scope.model.periods = PeriodService.getPeriods( $scope.model.periodType, $scope.model.periodOffset,  $scope.model.openFuturePeriods );
    };

    $scope.resetParams = function(){
        $scope.model.dataFilter = null;
        $scope.model.activities = [];
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

    $scope.fetchData = function(){
        $scope.resetParams();
        if ( $scope.model.selectedPeriod && $scope.selectedOrgUnit ){

            var eventUrl = 'program=' + $scope.model.selectedProgram.id;
            eventUrl += '&occurredAfter=' + $scope.model.selectedPeriod.startDate + '&occurredBefore=' + $scope.model.selectedPeriod.endDate;
            eventUrl += '&ouMode=DESCENDANTS&paging=false&orgUnit=' + $scope.selectedOrgUnit.id;

            //fetch data activities
            $scope.model.activities = [];
            $scope.model.reportStarted = true;
            $scope.model.reportReady = false;
            $scope.newActivity = {};
            EventService.getByFilter( eventUrl, $scope.model.dataElementsById, $scope.model.optionSetsById ).then(function(activities){
                $scope.model.activities = EventService.processData(activities, $scope.model.selectedAttributeCategoryCombo);
                $scope.model.reportStarted = false;
                $scope.model.reportReady = true;
            });
        }
    };

    /*$scope.sortItems = function(gridHeader){        
        if ($scope.model.sortHeader && $scope.model.sortHeader.id === gridHeader.id){
            $scope.reverse = !$scope.reverse;            
        }        
        $scope.model.sortHeader = {id: gridHeader.id, direction: $scope.reverse ? 'desc' : 'asc'};        
        $scope.fetchEvents();
    };*/
    
    $scope.exportData = function ( name ) {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });
        var reportName = $translate.instant('ip_rm_report') + '_' + $scope.model.selectedPeriod._startDate._year + '_' + $scope.model.selectedPeriod._endDate._year + '_' + $scope.selectedOrgUnit.displayName + '.xls';
        saveAs(blob, reportName);
    };
});
