class ConsulKeys {
  constructor(ressourceURL, refresh) {
    this.ressourceURL = ressourceURL;
    this.fetchRessource();
    this.keysList = $("#keys-list");
    this.keysFilter = $("#keys-filter");
    this.keysFilter.keyup(debounce(this.filterService, 250));
    this.refresh = parseInt(refresh);
    this.keysFilterCounter = $("#keys-counter");
    this.keysFilterCount = 0;
  }

  fetchRessource() {
    $.ajax({url: this.ressourceURL, cache: false, dataType: "json", sourceObject: this, success: function(result){
      consulKeys.initRessource(result);
    }});
  }

  initRessource(data) {
    this.data = data;
    this.reloadKeysList();
    console.log('Data generated at: ' + data['generated_at']);

    var urlParam = new URL(location.href).searchParams.get('key');
    if (urlParam) {
      var nodes = document.getElementById('keys-list').childNodes;
      for(var i in nodes) {
        if($(nodes[i]).find(".key-name").html() == urlParam) {
          var selectedElement = $(nodes[i])
          this.selectKey(selectedElement);
          selectedElement.focus()
          break;
        }
      }
    } else {
      this.selectKey(document.getElementById('keys-list').firstElementChild);
    }

    if(this.refresh > 0) {
      setTimeout(this.fetchRessource, this.refresh * 1000);
    }
  }

  reloadKeysList() {
    this.keysList.html('');
    this.keysFilterCount = 0;

    for (var key in this.data.kv) {

      var listItem = document.createElement('button');
      listItem.setAttribute('type','button');
      listItem.setAttribute('onfocus','consulKeys.onClickServiceName(this)');
      listItem.setAttribute('onclick','consulKeys.onClickServiceName(this)');
      listItem.setAttribute('value',key);
      listItem.setAttribute('class','list-group-item list-group-item-action');

      var serviceNameItem = document.createElement('div');
      serviceNameItem.setAttribute('class', 'key-name');
      serviceNameItem.appendChild(document.createTextNode(key));
      listItem.appendChild(serviceNameItem);

      this.keysFilterCount += 1;
      this.keysList.append(listItem);
    }
    this.keysFilterCounter.html(this.keysFilterCount);
    resizeWrapper('keys-wrapper', 'keys-list');
    this.filterService();
  }

  filterService() {
    var filter = new RegExp(consulKeys.keysFilter.val());
    consulKeys.keysFilterCount = 0;
    consulKeys.keysList.children('button').each(function (){
      var ui = $(this);
      if(keyMatcher(this, filter)) {
        ui.removeClass('d-none');
        ui.addClass('d-block');
        consulKeys.keysFilterCount += 1;
        consulKeys.keysFilterCounter.html(consulKeys.keysFilterCount);
      } else {
        ui.removeClass('d-block');
        ui.addClass('d-none');
      }
    })
  }

  onClickServiceName(source) {
    this.selectKey(source);
    this.updateURL($(source).find(".key-name").html());
  }

  updateURL(link) {
    var newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    if (link) {
      newUrl += '?key=' + link
    }
    window.history.pushState({},"",newUrl);
  }

  selectKey(source) {
    if (this.selectedKey) {
      $(this.selectedKey).removeClass('active');
    }
    var serviceName = $(source).find(".key-name").html()
    this.selectedKey = source.closest( "button" );
    $(this.selectedKey).addClass('active');
    this.displayKey([serviceName]);
  }

  displayKey(key) {
    $("#kv-title").html(key);
    if(this.data.kv[key] != null) {
      var dataToDisplay = atob(this.data.kv[key]);
    } else {
      var dataToDisplay = 'NO DATA';
    }

    $("#kv-data").html(dataToDisplay);
    $("#kv-data").removeClass();

    $('pre code').each(function(i, block) {
      hljs.highlightBlock(block);
    });
    resizeWrapper('data-wrapper', 'kv-data');
  }
}

$( window ).resize(resizeData);
resizeData();
