// strict
class ServiceTimeline {
    constructor(ressourceURL, refresh) {
      this.ressourceURL = ressourceURL;
      this.fetchRessource(true);
      this.serviceList = $("#service-list");
      this.serviceFilter = $("#service-filter");
      this.serviceFilter.keyup(this.filterService);
      this.serviceInstanceFilter = '';
      this.instanceFilter = $("#instance-filter");
      this.instanceFilter.keyup(this.doFilter);
      this.refresh = parseInt(refresh);
      this.filterStatus = null;
      this.refreshTimeout = null;
      this.reloadData = null;
      this.services = {}
      this.lastEntryLoaded = null;
      this.presentServices = {}
      this.currentlyUpdating = false;
      var sT = this;
    }

    fetchRessource(firstReload) {
        $.ajax({url: this.ressourceURL, cache: false, dataType: "json", sourceObject: this,
                success: function(result){
                           serviceTimeline.initRessource(result, firstReload);
                },
                error: function(err) {
                           console.log("Error updating data", err);
                           serviceTimeline.currentlyUpdating = false;
                }
         });
    }

    initRessource(data, firstReload) {
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
                setInterval(sT.reloadDataFromJSON, 10000);
            }, 150);
        } else {
            this.performFiltering($('#instance-filter')[0].value);
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
         } else if (clazz != 'warning') {
            clazz='danger';
         }
      }
      var span = document.createElement('span');
      span.setAttribute('class', 'lookup badge badge-pill badge-' + clazz);
      span.appendChild(document.createTextNode(status));
      return span;
    }

    performFiltering(filterValue) {
        this.refreshTimeout = null;
        var matcher;
        try {
            matcher = new RegExp(filterValue);
        } catch (e) {
          var safeReg = filterValue.replace(/[-[\]{}()*+?.,\\^$|]/g, "\\$&")
          console.log("Failed to compile regexp for '" + filterValue + "', using strict lookup due to: " + e);
          matcher = new RegExp(safeReg);
        }
        console.log("Filtering on service", serviceTimeline.serviceInstanceFilter, " with ", matcher, "filterValue:=", filterValue);
        var isCorrectService = function(){ return true; };
        if (serviceTimeline.serviceInstanceFilter == 'All') {
            serviceTimeline.serviceInstanceFilter = '';
        }
        if (serviceTimeline.serviceInstanceFilter == ''){
            var stylesheet = document.getElementById('serviceCol');
            var txt = '';
            if (filterValue != '') {
                txt+='tr.filtered { display: none; }';
            }
            stylesheet.textContent = txt;
        } else {
            var stylesheet = document.getElementById('serviceCol');
            var txt = '.serviceCol';
            if (filterValue != '') {
                txt+=',tr.filtered'
            }
            for (var i in this.presentServices) {
                if (i != serviceTimeline.serviceInstanceFilter) {
                    txt+=',tr.srv-'+i;
                }
            }
            stylesheet.textContent = txt + ' { display: none; }';
            isCorrectService = function(ui) { return ui.hasClass('srv-' + serviceTimeline.serviceInstanceFilter) };
        }
        if (filterValue != '') {
            $("#all-events > tbody").children('tr').each(function (){
            var ui = $(this);
            var shouldShow = isCorrectService(ui) && ui.children('.lookup').is(function (){
                var elem = $(this);
                if (elem[0].innerHTML.match(matcher)) {
                return true;
                }
                return false;
            });
            if (shouldShow) {
                ui.removeClass('filtered');
            } else {
                ui.addClass('filtered');
            }
            });
        }
    }

    doFilter() {
        var filterValue = $('#instance-filter')[0].value;
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
        this.refreshTimeout = window.setTimeout(function(){
            serviceTimeline.performFiltering(filterValue);
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
        var showProxiesInList = this.showProxiesInList;
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
        var maxRows = document.getElementById("maxRows").value;
        //$("#service-title").html(service['name']);
        var tableBody = $('#all-events > tbody');
        var startIndex = 0;
        if (firstReload || this.lastEntryLoaded == null) {
            tableBody.html("");
        } else {
            // We first try to find new entries...
            var lastDisplayedIndex = indexOfTimelineEvent(this.lastEntryLoaded);
            var newestIndexInNewDocument = "000";
            if (this.data.length > 0) {
                newestIndexInNewDocument = indexOfTimelineEvent(this.data[this.data.length - 1]);
            }
            if (lastDisplayedIndex >= newestIndexInNewDocument) {
                // Might happen when behind a VIP
                console.log("Skip reload, index: ", lastDisplayedIndex, ", new is ", newestIndexInNewDocument);
                return;
            } else {
                console.log("Index ", lastDisplayedIndex, " -> ", newestIndexInNewDocument);
            }
            for (var i = 0 ; i < this.data.length; i++) {
                var e = this.data[i];
                if (lastDisplayedIndex < indexOfTimelineEvent(e)) {
                    startIndex = i + 1;
                    console.log('Resuming at ', startIndex, " with ", e);
                    break;
                }
            }
        }
        var frag = document.createDocumentFragment();
        var filter = "";
        var lastEntryFound = null;
        if (this.data.length > maxRows) {
            var remaining = this.data.length - startIndex;
            if (startIndex < remaining) {
                startIndex = this.data.length - maxRows;
                console.log('Skip first ', startIndex, " entries on ", this.data.length, " lines...");
            }
        }
        for (var i = startIndex ; i < this.data.length; i++) {
            var e = this.data[i];
            lastEntryFound = e;
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
              timeElement.setAttribute('title', fullTimestamp);
              this.buildCell(row, 'td', 'ts', timeElement);
            }
            this.buildCell(row, 'td', 'lookup serviceName serviceCol', document.createTextNode(e.service));
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
                        checkName.setAttribute('title', c['id']+'\n\n' + c.output);
                        checkName.appendChild(document.createTextNode(c['name']));
                        checksCell.appendChild(checkName);
                    }
                }
                this.buildCell(row, 'td', 'lookup checks', checksCell);
            }
            {
                var td = this.buildCell(row, 'td', 'service-status', this.createBadge(e['old_state']));
                td.appendChild(document.createTextNode('→'));
                td.appendChild(this.createBadge(e['new_state']));
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
            }
            frag.prepend(row);
        }
        var tbody = tableBody[0];
        tbody.prepend(frag);
        this.lastEntryLoaded = lastEntryFound;
        console.log("Last entry loaded: ", indexOfTimelineEvent(this.lastEntryLoaded));
        var i = 0;
        
        var tbody = tableBody.children('tr').each (function() {
            i++;
            if (i > maxRows) {
                $(this).remove()
            }
        });
        if (i > maxRows) {
            console.log("Removed ", maxRows - i, " lines.")
        }
    }
}