// strict
class ServiceTimeline {
    constructor(ressourceURL, refresh) {
      this.ressourceURL = ressourceURL;
      this.fetchRessource(true);
      this.serviceList = $("#service-list");
      this.serviceFilter = $("#service-filter");
      this.serviceFilter.keyup(debounce('timeline-service-filter-keyup', this.filterService, 250));
      this.serviceInstanceFilter = '';
      this.instanceFilter = $("#instance-filter");
      this.instanceFilter.keyup(debounce('timeline-instance-filter-keyup', this.doFilter, 250));
      this.refresh = parseInt(refresh);
      this.filterStatus = null;
      this.refreshTimeout = null;
      this.reloadData = null;
      this.services = {}
      this.lastEntryLoaded = null;
      this.presentServices = {}
      this.currentlyUpdating = false;
      this.start = null;
      this.next = null;
      this.prev = null;
      var sT = this;
    }

    fetchRessource(firstReload) {
        $.ajax({url: this.ressourceURL, cache: true, dataType: "json", sourceObject: this,
                success: function(result){
                           serviceTimeline.initRessource(result, firstReload);
                           serviceTimeline.currentlyUpdating = false;
                },
                error: function(err) {
                           console.log("Error updating data", err);
                           serviceTimeline.currentlyUpdating = false;
                }
         });
    }

    nextPage() {
        this.start = this.next;
        console.log("nextPage() at ", this.start);
        this.doFilter();
    }

    prevPage() {
        this.start = this.prev;
        console.log("prevPage() at ", this.start);
        this.doFilter();
    }

    firstPage() {
        this.start = null;
        this.doFilter();
    }

    initRessource(data, firstReload) {
        if (!data || data.length < 1) {
            console.log("No new data to load ", data);
            return;
        }
        if (this.data != null) {
            var previousCount = this.data.length;
            if (previousCount > 0) {
                var previousMaxIndex = indexOfTimelineEvent(this.data[previousCount - 1]);
                var newIndex = indexOfTimelineEvent(data[data.length - 1]);
                if (newIndex < previousMaxIndex) {
                    console.log("New index " + newIndex + " is lower than previous one", previousMaxIndex, " no need to reload");
                    return;
                } else if (newIndex == previousMaxIndex) {
                    if (this.data.length >= data.length) {
                        //console.log("new := (idx=", newIndex, ",len=", data.length, ") old := (idx:=", previousMaxIndex, this.data.length, "), no need to reload");
                        return;
                    }
                } else {
                    // Lets merge old data with new one
                    if (this.data.length > data.length) {
                        var diff = this.data.length - data.length;
                        var firstNewItem = indexOfTimelineEvent(data[0]);
                        var maxItemsInMemory = 100000;
                        if (maxItemsInMemory > data.length) {
                            console.log("Looking for matches with ", firstNewItem);
                            for (var i = 0 ; i < this.data.length; i++){
                                var oldVal = indexOfTimelineEvent(this.data[i]);
                                if (oldVal == firstNewItem) {
                                    // We found the common start
                                    var maxItemsToAdd = maxItemsInMemory - data.length;
                                    var start = 0;
                                    if (i > maxItemsToAdd) {
                                        start = i - maxItemsToAdd;
                                    }
                                    console.log("Did preprend ", (i - start), "items to data");
                                    data = this.data.slice(start, i).concat(data);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        console.log("Loading", data.length, "items...");
        this.data = data;
        this.reloadTimeline(firstReload);
    }

    createServiceDefItem(label, serviceName, counter) {
        var listItem = document.createElement('li');
        listItem.setAttribute('id', 'service-item-filter-' + serviceName);
        listItem.setAttribute('onfocus','serviceTimeline.selectService(this, true)');
        listItem.setAttribute('onclick','serviceTimeline.selectService(this, true)');
        listItem.setAttribute('value', serviceName);
        var serviceNameItem = document.createElement('div');
        serviceNameItem.setAttribute('class', 'service-name');
        serviceNameItem.appendChild(document.createTextNode(label));
        listItem.appendChild(serviceNameItem);
        var listItemClass = 'serviceListItem list-group-item list-group-item-action';
        listItem.setAttribute('class', listItemClass);

        var statuses = document.createElement('div');
        statuses.setAttribute('class','statuses float-right');
        statuses.appendChild(this.createBadge(counter, 'dark instanceCounter'));
        listItem.prepend(statuses);
        return listItem;
    }

    reloadDataFromJSON(){
        if (document.getElementById('autorefresh-check') && document.getElementById('autorefresh-check').checked) {
            if (serviceTimeline.currentlyUpdating == false) {
                serviceTimeline.currentlyUpdating = true;
                serviceTimeline.fetchRessource(false);
            }
        }
    }

    reloadTimeline(firstReload) {
        if (!this.data) {
          console.log("No data to display");
          serviceTimeline.currentlyUpdating = false;
        }
        var servicesPerName = {};
        var numberOfEvents = this.data.length;
        for (var i = 0 ; i < numberOfEvents; i++) {
            var e = this.data[i];
            var srvName = e.service;
            var arr = servicesPerName[srvName];
            if (arr == null) {
                arr = 0;
            }
            servicesPerName[srvName] = (arr + 1);
        }
        var sorted = Object.keys(servicesPerName).sort();
        var serviceListItems = this.serviceList[0];
        $('#allServicesCount').html(numberOfEvents)
        this.presentServices = servicesPerName;
        for (var i = 0 ; i < sorted.length; i++) {
            var serviceName = sorted[i];
            var counter = servicesPerName[serviceName];
            var existing = $('#service-item-filter-' + serviceName);
            if (existing.length > 0) {
                $('#service-item-filter-' + serviceName+ ' .instanceCounter').html(counter);
            } else {
                var listItem = this.createServiceDefItem(serviceName, serviceName, counter);
                serviceListItems.appendChild(listItem);
            }
            
        }
        this.displayEvents(firstReload);
        serviceTimeline.currentlyUpdating = false;
        if (firstReload) {
            var sT = this;
            setTimeout(function(){
                var filterParam = new URL(location.href).searchParams.get('filter');
                if (filterParam) {
                    $('#instance-filter')[0].value = filterParam;
                }
                var urlParam = new URL(location.href).searchParams.get('service');
                if (urlParam === null) {
                    var servicePrefix = '#service_'
                    if (location.hash.startsWith(servicePrefix)) {
                        urlParam = location.hash.substr(servicePrefix.length)
                    }
                }
                var found = false;
                if (urlParam && urlParam != '.*') {
                    var nodes = document.getElementById('service-list').childNodes;
                    for (var i = 0; i < nodes.length; i++) {
                        if($(nodes[i]).find(".service-name").html() == urlParam) {
                            var selectedElement = $(nodes[i])
                            found = true;
                            sT.selectService(selectedElement, false);
                            setTimeout(function(){
                              selectedElement.focus();
                            }, 150);
                            break;
                        }
                    }
                }
                if (!found) {
                    sT.selectService($('#anyService', false));
                }
                console.log("Starting autorefresh every ", serviceTimeline.refresh, "ms.")
                setInterval(sT.reloadDataFromJSON, serviceTimeline.refresh);
            }, 150);
        }
    }

    appChild(rootKind, elem) {
        var root = document.createElement(rootKind)
        root.appendChild(elem);
        return root
    }

    buildCell(row, elem, clazz, value) {
        var td = document.createElement(elem);
        td.setAttribute('class', clazz);
        td.appendChild(value);
        row.appendChild(td);
        return td;
    }

    createBadge(status, clazz) {
      if (status == null) {
        status = 'missing';
        clazz = 'dark';
      } else if (status != null && clazz == null) {
         if (status == 'passing') {
            clazz='success';
         } else if (status != 'warning') {
            clazz='danger';
         } else {
            clazz='warning';
         }
      }
      var span = document.createElement('span');
      span.setAttribute('class', 'lookup badge badge-pill badge-' + clazz);
      span.appendChild(document.createTextNode(status));
      return span;
    }

    doFilter() {
        var filterValue = $('#instance-filter')[0].value;
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
        this.refreshTimeout = window.setTimeout(function(){
            serviceTimeline.displayEvents(false, filterValue);
        }, 16);
    }

    selectService(source, updateUrl) {
        $(this.selectedService).removeClass('active');
        var serviceName = $(source).find(".service-name").html()
        this.selectedService = source.closest('li');
        $(this.selectedService).addClass('active');
        if (serviceName == 'All') {
            $("#service-title").html('');
        } else {
            var titleText = '<a href="consul-services-ui.html?service=' + serviceName + '">'+serviceName+'</a>';
            $("#service-title").html(titleText);
        }
        serviceTimeline.serviceInstanceFilter = serviceName;
        if (updateUrl) {
          serviceTimeline.updateURL(serviceName);
        }
        this.doFilter();
    }

    updateURL(link) {
        var newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        if (link) {
          newUrl += '?service=' + link
        }
        window.history.pushState({},"",newUrl);
      }

    filterService() {
        var filter;
        var serviceVal = serviceTimeline.serviceFilter.val();
        try {
          filter = new RegExp(serviceVal);
        } catch (e) {
          var safeReg = serviceVal.replace(/[-[\]{}()*+?.,\\^$|]/g, "\\$&")
          console.log("Failed to compile regexp for '" + serviceVal + "', using strict lookup due to: " + e);
          filter = new RegExp(safeReg);
        }
        var showProxiesInList = serviceTimeline.showProxiesInList;
        serviceTimeline.serviceList.children('.serviceListItem').each(function (){
          var ui = $(this);
          if(this.getElementsByClassName('service-name')[0].innerHTML == 'All' || this.getElementsByClassName('service-name')[0].innerHTML.match(filter)) {
            ui.removeClass('d-none');
            ui.addClass('d-block');
          } else {
            ui.removeClass('d-block');
            ui.addClass('d-none');
          }
        });
      }

    displayEvents(firstReload) {
        var filterValue = $('#instance-filter')[0].value;
        var serviceName = serviceTimeline.serviceInstanceFilter;
        var serviceEvaluator = function(){return true};
        var showServiceColumn = true;
        if (serviceName != '' && serviceName != 'All') {
           showServiceColumn = false;
           serviceEvaluator = function(e){ return e.service === serviceName }
        }
        var maxRows = document.getElementById("maxRows").value;
        //$("#service-title").html(service['name']);
        var tableBody = $('#all-events > tbody');
        var newDoc = document.createDocumentFragment();
        var frag = document.createElement('tbody');
        newDoc.appendChild(frag);
        var filter = "";
        var count = 0;
        if (filterValue != ''){
            var matcher;
            try {
                matcher = new RegExp(filterValue);
            } catch (e) {
                var safeReg = filterValue.replace(/[-[\]{}()*+?.,\\^$|]/g, "\\$&")
                console.log("Failed to compile regexp for '" + filterValue + "', using strict lookup due to: " + e);
                matcher = new RegExp(safeReg);
            }
            var delegateServiceEvaluator = serviceEvaluator;
            const fields = ['instance', 'service'];
            const instance_info_fields = ['node', 'port'];
            const check_fields = ['name', 'output'];
            serviceEvaluator = function(e) {
                var res = delegateServiceEvaluator(e);
                if (!res) {
                    return false;
                }
                for (var i = 0; i < fields.length; i++) {
                    var field = fields[i];
                    if (matcher.test(e[field])){
                        return true;
                    }
                }
                for (var i = 0; i < instance_info_fields.length; i++) {
                    var field = instance_info_fields[i];
                    if (matcher.test(e.instance_info[field])){
                        return true;
                    }
                }
                for (var checkId in e.instance_info.checks) {
                    if (matcher.test(checkId)) {
                        return true;
                    }
                    var check = e.instance_info.checks[checkId];
                    for (var i = 0; i < check_fields.length; i++) {
                        var field = check_fields[i];
                        if (matcher.test(check[field])){
                            return true;
                        }
                    }
                }
                return false;
            }
        }
        var startIdx = this.start;
        if (startIdx == null) {
            startIdx = (this.data[this.data.length - 1].idx);
        } else {
            //console.log("startIdx := ", startIdx);
        }
        var previousElements = [];
        document.getElementById('prevPage').setAttribute('disabled', 'disabled');
        this.next = null;
        document.getElementById('firstPage').setAttribute('disabled', 'disabled');
        this.prev = null;
        document.getElementById('nextPage').setAttribute('disabled', 'disabled');
        var totalSkipped = 0;
        for (var i = this.data.length - 1 ; i >= 0; i--) {
            if (count >= maxRows) {
                this.next = this.data[i].idx;
                //console.log("next is ", this.data[i].ts, ' at ', this.next);
                var nextTs = this.data[i].ts;
                setTimeout(function(){
                  nextPage = document.getElementById('nextPage');
                  nextPage.removeAttribute('disabled');
                  nextPage.setAttribute('title', 'Older entries at ' + nextTs);
                }, 1);
                break;
            }
            var e = this.data[i];
            if (!serviceEvaluator(e)) {
                continue;
            }
            if (startIdx < e.idx) {
                totalSkipped++;
                previousElements.push(e);
                var previousCounter = previousElements.length;
                if (previousCounter == 1) {
                    setTimeout(function(){
                      document.getElementById('prevPage').removeAttribute('disabled');
                      document.getElementById('firstPage').removeAttribute('disabled');
                    }, 1);
                } else if (previousCounter >= maxRows){
                    previousElements.shift();
                }
                continue;
            }
            count++;
            if (count == 1) {
                if (previousElements.length > 0) {
                    //console.log("Current is ", e.ts, ' aka  ',  e.idx, ", Had ", previousElements.length, 'elements before, skipped := ', totalSkipped, "skipped elements", previousElements);
                    this.prev = previousElements.shift().idx;
                }
            }
            var row = document.createElement('tr');
            row.setAttribute("class", 'srv-' + e.service);
            var timestamp;
            var fullTimestamp;
            try {
                var tsMs = Date.parse(e.ts);
                if (isNaN(tsMs)) {
                    timestamp = e.ts;
                    fullTimestamp = e.ts;
                } else {
                    fullTimestamp = new Date(tsMs);
                    timestamp = formatDate(fullTimestamp);
                }
            } catch (err){ console.log("Failed parsing date", e.ts, err);}
            {
              var timeElement = this.appChild('time', document.createTextNode(timestamp));
              timeElement.setAttribute('datetime', fullTimestamp);
              timeElement.setAttribute('title', fullTimestamp + '\nX-Consul-Index: ' +e.idx);
              this.buildCell(row, 'td', 'ts', timeElement);
            }
            if (showServiceColumn) {
              this.buildCell(row, 'td', 'lookup serviceName serviceCol', document.createTextNode(e.service));
            }
            var text = e.instance;
            if (e.instance_info && e.instance_info.node) {
                text = e.instance_info.node;
                if (e.instance_info.port > 0) {
                    text += ":" + e.instance_info.port
                }
            }
            var instanceCell = this.buildCell(row, 'td', 'lookup instance', document.createTextNode(text));
            instanceCell.setAttribute("title", e.instance);
            {
                var checksCell;
                if (e.checks.length == 0) {
                    checksCell = this.createBadge('No check modified', 'primary');
                } else {
                    checksCell = document.createElement("div");
                    for (var j = 0; j < e.checks.length; j++) {
                        var c = e.checks[j];
                        var statusSpan = document.createElement('div');
                        statusSpan.setAttribute('class', 'checkTransition');
                        statusSpan.appendChild(this.createBadge(c['old']));
                        statusSpan.appendChild(document.createTextNode('→'));
                        var newBadge = this.createBadge(c['new']);
                        statusSpan.appendChild(newBadge);
                        checksCell.appendChild(statusSpan);
                        var checkName = document.createElement('div');
                        checkName.setAttribute('class', 'lookup checkName');
                        checkName.setAttribute('data-toggle', 'tooltip');
                        checkName.setAttribute('title', 'ID: ' + c['id'] + '\nName: ' + c['name'] + '\n\n' + c.output);
                        checkName.appendChild(document.createTextNode(c['name']));
                        checksCell.appendChild(checkName);
                    }
                }
                this.buildCell(row, 'td', 'lookup checks', checksCell);
            }
            {
                if (e.new_state == e.old_state) {
                    var td = this.buildCell(row, 'td', 'evt-service-status', this.createBadge(e['new_state']));
                } else {
                    var old = e.old_state == null ? this.createBadge('new', 'primary') : this.createBadge(e.old_state);
                    var td = this.buildCell(row, 'td', 'evt-service-status', old);
                    td.appendChild(document.createTextNode('→'));
                    var newState = (e.new_state == null) ? this.createBadge('removed', 'dark') : this.createBadge(e.new_state);
                    td.appendChild(newState);
                }
            }
            {
                var nSuccess = e['stats']['passing'];
                var allInstances = this.buildCell(row, 'td', 'all-instances', this.createBadge(nSuccess, 'success'));
                var nWarnings = e['stats']['warning'];
                if (nWarnings > 0) {
                    var elem = this.createBadge(nWarnings, 'warning');
                    allInstances.appendChild(elem);
                }
                var nCritical = e['stats']['critical'];
                if (nCritical > 0) {
                    var elem = this.createBadge(nCritical, 'danger');
                    allInstances.appendChild(elem);
                }
                var elem = this.createBadge(nCritical);
                if (e['stats']['total'] > 0) {
                    var percent = Math.round(nSuccess * 100 / e['stats']['total']);
                    var clazz = 'secondary'
                    if (percent > 90) {
                        clazz = 'success';
                    } else if (percent < 20) {
                        clazz = 'danger';
                    } else if (percent < 50) {
                        clazz = 'warning';
                    }
                    this.buildCell(row, 'td', 'ipercents', this.createBadge(percent + " %", clazz));
                } else {
                    this.buildCell(row, 'td', 'ipercents', this.createBadge('none', 'danger'));
                }
            }
            frag.append(row);
        }
        $('#numRowsDisplayed').html(totalSkipped + '…' + (totalSkipped + count) + ' / ' + this.data.length);
        var tbody = tableBody[0];
        tbody.parentNode.replaceChild(frag, tbody);
        if (this.data.length > 1) {
          this.lastEntryLoaded = this.data[this.data.length - 1];
        }
        if (showServiceColumn) {
          $('.serviceCol').show();
        } else {
          $('.serviceCol').hide();
        }
    }
}
