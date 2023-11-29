/* global angular, dhis2, art, iprm */

'use strict';

//Controller for settings page
iprm.controller('HomeController',
        function($scope,
        MetaDataFactory,
        SessionStorageService,) {

    $scope.model = {
        metaDataCached: false,
        validGroups: [],
        dataElementGroupSetsByCode: {},
        selectedPeriod: null,
        periods: [],
        periodType: 'Yearly',
        periodOffset: 0,
        openFuturePeriods: 1,
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

    // Initiate metadata caching process
    var start = new Date();
    dhis2.iprm.downloadMetaData().then(function(){
        var end = new Date();
        SessionStorageService.set('METADATA_CACHED', true);

        console.log('Finished loading metadata in about ', Math.floor((end - start) / 1000), ' - secs');

        $scope.model.horizontalMenus = [
            {id: 'dataentry', title: 'data_entry', order: 1, view: 'components/dataentry/dataentry.html', active: true, class: 'main-horizontal-menu'},
            {id: 'report', title: 'report', order: 2, view: 'components/report/report.html', class: 'main-horizontal-menu'}
        ];

        MetaDataFactory.getAll('optionSets').then(function(){
            $scope.model.metaDataCached = true;
        });
    });

    $scope.getMenuStyle = function( menu ){
        var style = menu.class + ' horizontal-menu font-16';
        if( menu.active ){
            style += ' active-horizontal-menu';
        }
        return style;
    };

});
