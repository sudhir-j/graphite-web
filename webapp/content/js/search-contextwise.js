// Global object names
var contextSelector;
var contextSelectorFields = [];
var selectedScheme = null;
var metricSelector;
var metricSelectorMode;
var metricSelectorGrid;
var metricSelectorTextField;
var navBar;
var spacer;

var cookieProvider = new Ext.state.CookieProvider({
  path: "/dashboard"
});

function focusCompleter() {
  if (metricSelectorTextField) metricSelectorTextField.focus(false, 50);
}

/* Nav Bar configuration */
var navBarWestConfig = {
  region: 'west',
  layout: 'vbox',
  layoutConfig: { align: 'stretch' },
  collapsible: true,
  collapseMode: 'mini',
  width : 338,
  split: true,
  title : 'Context Search',
  listeners: {
    expand: function() { focusCompleter(); } // defined below
  }
};


// Record types and stores
var SchemeRecord = Ext.data.Record.create([
  {name: 'name'},
  {name: 'pattern'},
  {name: 'fields', type: 'auto'}
]);

var schemeRecords = [];

var schemesStore = new Ext.data.Store({
  fields: SchemeRecord
});


var ContextFieldValueRecord = Ext.data.Record.create([
  {name: 'name'},
  {path: 'path'}
]);

var contextFieldStore = new Ext.data.JsonStore({
  url: '/metrics/find/',
  root: 'metrics',
  idProperty: 'name',
  fields: ContextFieldValueRecord,
  baseParams: {format: 'completer', wildcards: '1'}
});



function createContextNavbar () {

  // Populate naming-scheme based datastructures
  Ext.each(schemes, function (scheme_info) {
    scheme_info.id = scheme_info.name;
    schemeRecords.push( new SchemeRecord(scheme_info) );

    Ext.each(scheme_info.fields, function (field) {

      // Context Field configuration
      contextSelectorFields.push( new Ext.form.ComboBox({
        id: scheme_info.name + '-' + field.name,
        fieldLabel: field.label,
        width: CONTEXT_FIELD_WIDTH,
        mode: 'remote',
        triggerAction: 'all',
        editable: true,
        forceSelection: false,
        store: contextFieldStore,
        displayField: 'name',
        queryDelay: 100,
        queryParam: 'query',
        minChars: 1,
        typeAhead: false,
        value: queryString[field.name] || getContextFieldCookie(field.name) || "*",
        listeners: {
          beforequery: buildQuery,
          change: contextFieldChanged,
          select: function (thisField) { thisField.triggerBlur(); focusCompleter(); },
          afterrender: function (thisField) { thisField.hide(); },
          hide: function (thisField) { thisField.getEl().up('.x-form-item').setDisplayed(false); },
          show: function (thisField) { thisField.getEl().up('.x-form-item').setDisplayed(true); }
        }
      }) );

    });

  });
  schemesStore.add(schemeRecords);

  spacer = new Ext.form.TextField({
    hidden: true,
    hideMode: 'visibility'
  });

  var metricTypeCombo = new Ext.form.ComboBox({
    id: 'metric-type-field',
    fieldLabel: 'Metric Type',
    width: CONTEXT_FIELD_WIDTH,
    mode: 'local',
    triggerAction: 'all',
    editable: false,
    store: schemesStore,
    displayField: 'name',
    listeners: {
      afterrender: function (combo) {
        var value = (queryString.metricType) ? queryString.metricType : getContextFieldCookie('metric-type');

        if (!value) {
          value = "Everything";
        }
        var index = combo.store.find("name", value);
        if (index > -1) {
          var record = combo.store.getAt(index);
          combo.setValue(value);
          metricTypeSelected.defer(250, this, [combo, record, index]);
        }
      },
      select: metricTypeSelected
    }
  });

  contextSelector = new Ext.form.FormPanel({
    flex: 1,
    autoScroll: true,
    labelAlign: 'right',
    items: [
      spacer,
      metricTypeCombo
    ].concat(contextSelectorFields)
  });

  function expandNode(node, recurse) {
    function addAll () {
      Ext.each(node.childNodes, function (child) {
        if (child.leaf) {
	  // replace with graph update 
          //graphAreaToggle(child.id, {dontRemove: true});
  	  if (node.attributes.graphUrl) {
	    var url = decodeURIComponent(node.attributes.graphUrl).replace(/#/,'%23');
	    Composer.loadMyGraph(node.attributes.text, url);
	    return;
	  }
	  Composer.toggleTarget(node.id);
        } else if (recurse) {
          expandNode(child, recurse);
        }
      });
    }

    if (node.isExpanded()) {
      addAll();
    } else {
      node.expand(false, false, addAll);
    }
  }

  var folderContextMenu = new Ext.menu.Menu({
    items: [{
      text: "Add All Metrics",
      handler: function (item, e) {
                 expandNode(item.parentMenu.node, false);
               }
    }, {
      text: "Add All Metrics (recursively)",
      handler: function (item, e) {
                 expandNode(item.parentMenu.node, true);
               }
    }]
  });

    metricSelectorMode = 'tree';
    metricSelector = new Ext.tree.TreePanel({
      root: new Ext.tree.TreeNode({}),
      containerScroll: true,
      autoScroll: true,
      flex: 3.0,
      pathSeparator: '.',
      rootVisible: false,
      singleExpand: false,
      trackMouseOver: true,
      listeners: {
      click: metricTreeSelectorNodeClicked,
      contextmenu: function (node, e) {
                     if (!node.leaf) {
                       folderContextMenu.node = node;
                       folderContextMenu.showAt( e.getXY() );
                     }
                   }
      }
    });

  var autocompleteTask = new Ext.util.DelayedTask(function () {
    var query = metricSelectorTextField.getValue();
    var store = metricSelectorGrid.getStore();
    store.setBaseParam('query', query);
    store.load();
  });



  /* Nav Bar */
  navBarWestConfig.items = [contextSelector, metricSelector];
  var navBarConfig = navBarWestConfig;
  navBar = new Ext.Panel(navBarConfig);
  return navBar;
}

function metricTypeSelected (combo, record, index) {
  selectedScheme = record;

  // Show only the fields for the selected context
  Ext.each(contextSelectorFields, function (field) {
    if (field.getId().indexOf( selectedScheme.get('name') ) == 0) {
      field.show();
    } else {
      field.hide();
    }
  });

  setContextFieldCookie("metric-type", combo.getValue());
  contextFieldChanged();
  focusCompleter();
}


function buildQuery (queryEvent) {
  var queryString = "";
  var parts = selectedScheme.get('pattern').split('.');
  var schemeName = selectedScheme.get('name');

  // Clear cached records to force JSON queries every time
  contextFieldStore.removeAll();
  delete queryEvent.combo.lastQuery;

  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    var field = part.match(/^<[^>]+>$/) ? part.substr(1, part.length - 2) : null;

    if (field == null) {
      queryString += part + '.';
      continue;
    }

    var combo = Ext.getCmp(schemeName + '-' + field);
    var value = combo.getValue();

    if (UI_CONFIG.automatic_variants) {
      if (value.indexOf(',') > -1 && value.search(/[{}]/) == -1) {
        value = '{' + value + '}';
      }
    }

    if (combo === queryEvent.combo) {
      queryEvent.query = queryString + queryEvent.query + '*';
      return;
    } else {
      if (value) {
        queryString += value + '.';
      } else {
        Ext.Msg.alert('Missing Context', 'Please fill out all of the fields above first.');
        queryEvent.cancel = true;
        return;
      }
    }
  }

  Ext.Msg.alert('Error', 'Failed to build query, could not find "' + queryEvent.combo.getId() + '" field');
  queryEvent.cancel = true;
}


function contextFieldChanged() {
  var pattern = getContextFieldsPattern();
  if (pattern) metricSelectorShow(pattern);
}

function getContextFieldsPattern() {
  var schemeName = selectedScheme.get('name');
  var pattern = selectedScheme.get('pattern');
  var fields = selectedScheme.get('fields');
  var missing_fields = false;

  Ext.each(fields, function (field) {
    var id = schemeName + '-' + field.name;
    var value = Ext.getCmp(id).getValue();

    // Update context field cookies
    setContextFieldCookie(field.name, value);

    if (UI_CONFIG.automatic_variants) {
      if (value.indexOf(',') > -1 && value.search(/[{}]/) == -1) {
        value = '{' + value + '}';
      }
    }

    if (value.trim() == "") {
      missing_fields = true;
    } else {
      pattern = pattern.replace('<' + field.name + '>', value);
    }
  });

  if (missing_fields) {
    return;
  }

  return pattern;
}

function metricSelectorShow(pattern) {
  if (metricSelectorMode == 'tree') {
    metricTreeSelectorShow(pattern);
  } else {
    metricTextSelectorShow(pattern);
  }
}

function metricTreeSelectorShow(pattern) {
  var base_parts = pattern.split('.');

  function setParams (loader, node, callback) {
    loader.baseParams.format = 'treejson';

    if (node.id == 'rootMetricSelectorNode') {
      loader.baseParams.query = pattern + '.*';
    } else {
      var id_parts = node.id.split('.');
      id_parts.splice(0, base_parts.length); //make it relative
      var relative_id = id_parts.join('.');
      loader.baseParams.query = pattern + '.' + relative_id + '.*';
    }
  }

  var loader = new Ext.tree.TreeLoader({
    url: '/metrics/find/',
    requestMethod: 'GET',
    listeners: {beforeload: setParams}
  });

  try {
    var oldRoot = Ext.getCmp('rootMetricSelectorNode');
    oldRoot.destroy();
  } catch (err) { }

  var root = new Ext.tree.AsyncTreeNode({
    id: 'rootMetricSelectorNode',
    loader: loader
  });

  metricSelector.setRootNode(root);
  root.expand();
}

function metricTextSelectorShow(pattern) {
  var store = metricSelectorGrid.getStore();
  store.setBaseParam('query', pattern);
  store.load();
}


function metricTreeSelectorNodeClicked (node, e) {
  if (!node.leaf) {
    node.toggle();
    return;
  }

//  replace with graph update 
//  graphAreaToggle(node.id);
  if (node.attributes.graphUrl) {
    var url = decodeURIComponent(node.attributes.graphUrl).replace(/#/,'%23');
    Composer.loadMyGraph(node.attributes.text, url);
    return;
  }
  Composer.toggleTarget(node.id);
}


function failedAjaxCall(response, options) {
  Ext.Msg.alert(
    "Ajax Error",
    "Ajax call failed, response was :" + response.responseText
  );
}

/* Cookie stuff */
function getContextFieldCookie(field) {
  return cookieProvider.get(field);
}

function setContextFieldCookie(field, value) {
  cookieProvider.set(field, value);
}

