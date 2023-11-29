/* global angular, iprm */

'use strict';


iprm.controller('DuplicateController',
        function($scope,
                $modalInstance,
                orgUnits,
                optionSetsById,
                dataElementsById,
                selectedOrgUnit,
                validOrgUnits,
                programStage,
                attributeCos,
                activity,
                OrgUnitFactory,
                DateUtils,
                CommonUtils,
                EventService){

    $scope.orgUnits = orgUnits;
    $scope.selectedOrgUnit = selectedOrgUnit;
    $scope.validOrgUnits = validOrgUnits;
    $scope.treeLoadingStarted = false;
    $scope.treeLoaded = true;
    $scope.model = {
        selectedOrgUnits: []
    };

    if ( $scope.selectedOrgUnit && $scope.selectedOrgUnit.id ){
        $scope.model.selectedOrgUnits.push( $scope.selectedOrgUnit.id );
    }

    //expand/collapse of search orgunit tree
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
        if ( $scope.selectedOrgUnit && $scope.selectedOrgUnit.id !== orgUnit.id ){
            var index = $scope.model.selectedOrgUnits.indexOf( orgUnit.id );
            if ( index !== -1 ){
                $scope.model.selectedOrgUnits.splice(index, 1);
            }
            else{
                $scope.model.selectedOrgUnits.push( orgUnit.id );
            }
        }
    };

    $scope.select = function () {
        var dataValues = [];
        angular.forEach(programStage.programStageDataElements, function(prstde){
            var val = activity[prstde.dataElement.id];
            var de = dataElementsById[prstde.dataElement.id];
            if( de ){
                val = CommonUtils.formatDataValue( de, val, optionSetsById, 'API' );
            }
            var dv = {
                dataElement: prstde.dataElement.id,
                value: val
            };
            dataValues.push( dv );
        });

        var activities = {
            events: []
        };

        var orgUnitsToCopy = [];
        angular.forEach($scope.model.selectedOrgUnits, function(ou){
            if ( ou !== $scope.selectedOrgUnit.id ){
                orgUnitsToCopy.push( ou );
                var ev = {
                    orgUnit: ou,
                    program: activity.program,
                    programStage: activity.programStage,
                    attributeCategoryOptions: attributeCos,
                    status: activity.status,
                    eventDate: DateUtils.formatFromUserToApi(activity.eventDate),
                    dueDate: DateUtils.formatFromUserToApi(activity.dueDate),
                    dataValues: dataValues
                };
                activities.events.push( ev );
            }
        });

        EventService.create( activities ).then(function( response ){
            $modalInstance.close();
        });
    };

    $scope.cancel = function(){
        $modalInstance.close();
    };
});