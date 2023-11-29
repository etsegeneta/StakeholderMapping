
/* global dhis2, angular, selection, i18n_ajax_login_failed, _ */

dhis2.util.namespace('dhis2.iprm');

// whether current user has any organisation units
dhis2.iprm.emptyOrganisationUnits = false;

dhis2.iprm.apiUrl = '../api';

var i18n_no_orgunits = 'No organisation unit attached to current user, no data entry possible';
var i18n_offline_notification = 'You are offline';
var i18n_online_notification = 'You are online';
var i18n_ajax_login_failed = 'Login failed, check your username and password and try again';

var optionSetsInPromise = [];
var attributesInPromise = [];
dhis2.iprm.batchSize = 50;

dhis2.iprm.store = null;
dhis2.iprm.metaDataCached = dhis2.iprm.metaDataCached || false;
dhis2.iprm.memoryOnly = $('html').hasClass('ie7') || $('html').hasClass('ie8');
var adapters = [];
if( dhis2.iprm.memoryOnly ) {
    adapters = [ dhis2.storage.InMemoryAdapter ];
} else {
    adapters = [ dhis2.storage.IndexedDBAdapter, dhis2.storage.DomLocalStorageAdapter, dhis2.storage.InMemoryAdapter ];
}


dhis2.iprm.store = new dhis2.storage.Store({
    name: 'dhis2iprm',
    adapters: [dhis2.storage.IndexedDBAdapter, dhis2.storage.DomSessionStorageAdapter, dhis2.storage.InMemoryAdapter],
    objectStores: ['dataElements', 'dataElementGroups', 'dataElementGroupSets', 'programs', 'optionSets', 'optionGroups', 'categoryCombos', 'attributes', 'ouLevels']
});

(function($) {
    $.safeEach = function(arr, fn)
    {
        if (arr)
        {
            $.each(arr, fn);
        }
    };
})(jQuery);

/**
 * Page init. The order of events is:
 *
 * 1. Load ouwt
 * 2. Load meta-data (and notify ouwt)
 *
 */
$(document).ready(function()
{
    $.ajaxSetup({
        type: 'POST',
        cache: false
    });

    $('#loaderSpan').show();
});

$(document).bind('dhis2.online', function(event, loggedIn)
{
    if (loggedIn)
    {
        if (dhis2.iprm.emptyOrganisationUnits) {
            setHeaderMessage(i18n_no_orgunits);
        }
        else {
            setHeaderDelayMessage(i18n_online_notification);
        }
    }
    else
    {
        var form = [
            '<form style="display:inline;">',
            '<label for="username">Username</label>',
            '<input name="username" id="username" type="text" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
            '<label for="password">Password</label>',
            '<input name="password" id="password" type="password" style="width: 70px; margin-left: 10px; margin-right: 10px" size="10"/>',
            '<button id="login_button" type="button">Login</button>',
            '</form>'
        ].join('');

        setHeaderMessage(form);
        ajax_login();
    }
});

$(document).bind('dhis2.offline', function()
{
    if (dhis2.iprm.emptyOrganisationUnits) {
        setHeaderMessage(i18n_no_orgunits);
    }
    else {
        setHeaderMessage(i18n_offline_notification);
    }
});

function ajax_login()
{
    $('#login_button').bind('click', function()
    {
        var username = $('#username').val();
        var password = $('#password').val();

        $.post('../dhis-web-commons-security/login.action', {
            'j_username': username,
            'j_password': password
        }).success(function()
        {
            var ret = dhis2.availability.syncCheckAvailability();

            if (!ret)
            {
                alert(i18n_ajax_login_failed);
            }
        });
    });
}

// -----------------------------------------------------------------------------
// Metadata downloading
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Metadata downloading
// -----------------------------------------------------------------------------

dhis2.iprm.downloadMetaData = function(){
    var metadataCached = JSON.parse(sessionStorage.getItem('METADATA_CACHED'));

    if ( metadataCached ){
        return Promise.resolve();
    }

    console.log('Loading required meta-data');

    return dhis2.iprm.store.open()
        .then( getUserAccessiblePrograms )
        .then( getUserAccessibleCategoryOptions )
        .then( getOrgUnitLevels )
        .then( getSystemSetting )

        //fetch data elements
        .then( getMetaDataElements )
        .then( filterMissingDataElements )
        .then( getDataElements )

        //fetch data element groups
        .then( getMetaDataElementGroups )
        .then( filterMissingDataElementGroups )
        .then( getDataElementGroups )

        //fetch data element groupsets
        .then( getMetaDataElementGroupSets )
        .then( filterMissingDataElementGroupSets )
        .then( getDataElementGroupSets )

        //fetch programs
        .then( getMetaPrograms )
        .then( filterMissingPrograms )
        .then( getPrograms )

        //fetch option sets
        .then( getMetaOptionSets )
        .then( filterMissingOptionSets )
        .then( getOptionSets )

        //fetch option groups
        .then( getMetaOptionGroups )
        .then( filterMissingOptionGroups )
        .then( getOptionGroups )

        //fetch category combos
        .then( getMetaCategoryCombos )
        .then( filterMissingCategoryCombos )
        .then( getCategoryCombos )

        //fetch custom attributes
        .then( getMetaAttributes )
        .then( filterMissingAttributes )
        .then( getAttributes );
};

function getUserAccessibleDataSets(){
    return dhis2.metadata.getMetaObject(null, 'ACCESSIBLE_DATASETS', dhis2.iprm.apiUrl + '/dataSets.json', 'fields=id,access[data[write]]&paging=false', 'sessionStorage', dhis2.iprm.store);
}

function getUserAccessiblePrograms(){
    return dhis2.metadata.getMetaObject(null, 'ACCESSIBLE_PROGRAMS', dhis2.iprm.apiUrl + '/programs.json', 'filter=programType:eq:WITHOUT_REGISTRATION&fields=id,access[data[write,read]]&paging=false', 'sessionStorage', dhis2.iprm.store);
}

function getUserAccessibleCategoryOptions(){
    return dhis2.metadata.getMetaObject(null, 'ACCESSIBLE_CATEGORY_OPTIONS', dhis2.iprm.apiUrl + '/categoryOptions.json', 'fields=id,access[data[write,read]]&paging=false', 'sessionStorage', dhis2.iprm.store);
}

function getOrgUnitLevels()
{
    dhis2.iprm.store.getKeys( 'ouLevels').done(function(res){
        if(res.length > 0){
            return;
        }
        return dhis2.metadata.getMetaObjects('ouLevels', 'organisationUnitLevels', dhis2.iprm.apiUrl + '/organisationUnitLevels.json', 'fields=id,displayName,level&paging=false', 'idb', dhis2.iprm.store);
    });
}

function getSystemSetting(){
    if(localStorage['SYSTEM_SETTING']){
       return;
    }
    return dhis2.metadata.getMetaObject(null, 'SYSTEM_SETTING', dhis2.iprm.apiUrl + '/systemSettings?key=keyUiLocale&key=keyCalendar&key=keyDateFormat&key=multiOrganisationUnitForms', '', 'localStorage', dhis2.iprm.store);
}

function getMetaCategoryCombos(){
    return dhis2.metadata.getMetaObjectIds('categoryCombos', dhis2.iprm.apiUrl + '/categoryCombos.json', 'paging=false&fields=id,version');
}

function filterMissingCategoryCombos( objs ){
    return dhis2.metadata.filterMissingObjIds('categoryCombos', dhis2.iprm.store, objs);
}

function getCategoryCombos( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.iprm.batchSize, 'categoryCombos', 'categoryCombos', dhis2.iprm.apiUrl + '/categoryCombos.json', 'paging=false&fields=id,displayName,code,skipTotal,isDefault,categories[id,displayName,code,dimension,dataDimensionType,attributeValues[value,attribute[id,name,valueType,code]],categoryOptions[id,displayName,code,attributeValues[value,attribute[id,code,valueType]]]]', 'idb', dhis2.iprm.store);
}

function getMetaDataElements(){
    return dhis2.metadata.getMetaObjectIds('dataElements', dhis2.iprm.apiUrl + '/dataElements.json', 'paging=false&fields=id,version');
}

function filterMissingDataElements( objs ){
    return dhis2.metadata.filterMissingObjIds('dataElements', dhis2.iprm.store, objs);
}

function getDataElements( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.iprm.batchSize, 'dataElements', 'dataElements', dhis2.iprm.apiUrl + '/dataElements.json', 'paging=false&fields=id,code,displayName,shortName,description,formName,valueType,optionSetValue,optionSet[id],attributeValues[value,attribute[id,name,valueType,code]],categoryCombo[id]', 'idb', dhis2.iprm.store);
}

function getMetaDataElementGroups(){
    return dhis2.metadata.getMetaObjectIds('dataElementGroups', dhis2.iprm.apiUrl + '/dataElementGroups.json', 'paging=false&fields=id,version');
}

function filterMissingDataElementGroups( objs ){
    return dhis2.metadata.filterMissingObjIds('dataElementGroups', dhis2.iprm.store, objs);
}

function getDataElementGroups( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.iprm.batchSize, 'dataElementGroups', 'dataElementGroups', dhis2.iprm.apiUrl + '/dataElementGroups.json', 'paging=false&fields=id,displayName,code,description,dataElements[id],attributeValues[value,attribute[id,name,valueType,code]]', 'idb', dhis2.iprm.store);
}

function getMetaDataElementGroupSets(){
    return dhis2.metadata.getMetaObjectIds('dataElementGroupSets', dhis2.iprm.apiUrl + '/dataElementGroupSets.json', 'paging=false&fields=id,version');
}

function filterMissingDataElementGroupSets( objs ){
    return dhis2.metadata.filterMissingObjIds('dataElementGroupSets', dhis2.iprm.store, objs);
}

function getDataElementGroupSets( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.iprm.batchSize, 'dataElementGroupSets', 'dataElementGroupSets', dhis2.iprm.apiUrl + '/dataElementGroupSets.json', 'paging=false&fields=id,code,description,displayName,dataElementGroups[id,displayName],attributeValues[value,attribute[id,name,valueType,code]]', 'idb', dhis2.iprm.store);
}

function getMetaPrograms(){
    return dhis2.metadata.getMetaObjectIds('programs', dhis2.iprm.apiUrl + '/programs.json', 'filter=programType:eq:WITHOUT_REGISTRATION&paging=false&fields=id,version');
}

function filterMissingPrograms( objs ){
    return dhis2.metadata.filterMissingObjIds('programs', dhis2.iprm.store, objs);
}

function getPrograms( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.iprm.batchSize, 'programs', 'programs', dhis2.iprm.apiUrl + '/programs.json', 'paging=false&fields=*,categoryCombo[id],attributeValues[value,attribute[id,name,valueType,code]],organisationUnits[id,level],programStages[id,displayName,programStageDataElements[*,dataElement[id,attributeValues[value,attribute[id,name,valueType,code]]]]]', 'idb', dhis2.iprm.store, dhis2.metadata.processObject);
}

/*function getMetaDataSets(){
    return dhis2.metadata.getMetaObjectIds('dataSets', dhis2.iprm.apiUrl + '/dataSets.json', 'paging=false&fields=id,version');
}

function filterMissingDataSets( objs ){
    return dhis2.metadata.filterMissingObjIds('dataSets', dhis2.iprm.store, objs);
}

function getDataSets( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.iprm.batchSize, 'dataSets', 'dataSets', dhis2.iprm.apiUrl + '/dataSets.json', 'paging=false&fields=id,code,periodType,openFuturePeriods,displayName,version,categoryCombo[id],attributeValues[value,attribute[id,name,valueType,code]],organisationUnits[code,id],dataSetElements[id,dataElement[id]]', 'idb', dhis2.iprm.store, '');
}*/

function getMetaOptionSets(){
    return dhis2.metadata.getMetaObjectIds('optionSets', dhis2.iprm.apiUrl + '/optionSets.json', 'paging=false&fields=id,version');
}

function filterMissingOptionSets( objs ){
    return dhis2.metadata.filterMissingObjIds('optionSets', dhis2.iprm.store, objs);
}

function getOptionSets( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.iprm.batchSize, 'optionSets', 'optionSets', dhis2.iprm.apiUrl + '/optionSets.json', 'paging=false&fields=id,displayName,code,version,valueType,attributeValues[value,attribute[id,name,valueType,code]],options[id,displayName,code,attributeValues[value,attribute[id,name,valueType,code]]]', 'idb', dhis2.iprm.store);
}

function getMetaOptionGroups(){
    return dhis2.metadata.getMetaObjectIds('optionGroups', dhis2.iprm.apiUrl + '/optionGroups.json', 'paging=false&fields=id,version');
}

function filterMissingOptionGroups( objs ){
    return dhis2.metadata.filterMissingObjIds('optionGroups', dhis2.iprm.store, objs);
}

function getOptionGroups( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.iprm.batchSize, 'optionGroups', 'optionGroups', dhis2.iprm.apiUrl + '/optionGroups.json', 'paging=false&fields=id,displayName,code,version,attributeValues[value,attribute[id,name,valueType,code]],options~pluck[id]', 'idb', dhis2.iprm.store);
}

function getMetaAttributes(){
    return dhis2.metadata.getMetaObjectIds('attributes', dhis2.iprm.apiUrl + '/attributes.json', 'paging=false&fields=id,version');
}

function filterMissingAttributes( objs ){
    return dhis2.metadata.filterMissingObjIds('attributes', dhis2.iprm.store, objs);
}

function getAttributes( ids ){
    return dhis2.metadata.getBatches( ids, dhis2.iprm.batchSize, 'attributes', 'attributes', dhis2.iprm.apiUrl + '/attributes.json', 'paging=false&fields=:all,!access,!lastUpdatedBy,!lastUpdated,!created,!href,!user,!translations,!favorites,optionSet[id,displayName,code,options[id,displayName,code,sortOrder]]', 'idb', dhis2.iprm.store);
}
