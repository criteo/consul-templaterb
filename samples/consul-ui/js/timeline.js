// strict
class ServiceTimeline {
    constructor(ressourceURL, refresh) {
      this.ressourceURL = ressourceURL;
      this.fetchRessource();
      this.serviceList = $("#service-list");
      this.serviceFilter = $("#service-filter");
      this.serviceFilter.keyup(this.filterService);
      this.serviceInstanceFilter = '';
      this.instanceFilter = $("#instance-filter");
      this.instanceFilter.keyup(this.doFilter);
      this.refresh = parseInt(refresh);
      this.filterStatus = null;
      this.refreshTimeout = null;
      this.serviceFilterCounter = $("#service-counter");
      this.serviceFilterCount = 0;
      this.services = {}
      this.presentServices = {}
      var sT = this;
    }

    fetchRessource() {
        $.ajax({url: this.ressourceURL, cache: false, dataType: "json", sourceObject: this, success: function(result){
          serviceTimeline.initRessource(result);
        }});
    }

    initRessource(data) {
        this.data = data;
        this.reloadTimeline(true);
    }

    createServiceDefItem(label, serviceName, counter) {
        var listItem = document.createElement('li');
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
        statuses.appendChild(this.createBadge(counter, 'dark'));
        listItem.prepend(statuses);
        return listItem;
    }

    reloadTimeline(firstReload) {
        if (!this.data) {
          console.log("No data to display");
        }
        this.serviceList.html('');
        this.serviceFilterCount = 0;
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
        var allServices = this.createServiceDefItem('All', '', numberOfEvents);
        allServices.setAttribute('id', 'anyService');
        serviceListItems.appendChild(allServices);
        this.presentServices = servicesPerName;
        for (var i = 0 ; i < sorted.length; i++) {
            var serviceName = sorted[i];
            var counter = servicesPerName[serviceName];
            var listItem = this.createServiceDefItem(serviceName, serviceName, counter);
            serviceListItems.appendChild(listItem);
        }
        this.displayEvents();
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
         } else if (clazz != 'warning') {
            clazz='danger';
         }
      }
      var span = document.createElement('span');
      span.setAttribute('class', 'lookup badge badge-pill badge-' + clazz);
      span.appendChild(document.createTextNode(status));
      return span;
    }

    doFilter() {
        var filterValue = $('#instance-filter')[0].value;
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
        if (serviceTimeline.serviceInstanceFilter == ''){
            var stylesheet = document.getElementById('serviceCol');
            var txt = '';
            if (filterValue) {
                txt+='tr.filtered { display: none; }';
            }
            stylesheet.textContent = txt;
        } else {
            var stylesheet = document.getElementById('serviceCol');
            var txt = '.serviceCol';
            if (filterValue) {
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
        if (filterValue) {
            console.log("Additional filter: ", filterValue);
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

    selectService(source, updateUrl) {
        $(this.selectedService).removeClass('active');
        var serviceName = $(source).find(".service-name").html()
        this.selectedService = source.closest('li');
        $(this.selectedService).addClass('active');
        if (serviceName == 'All') {
            serviceName = '';
            $("#service-title").html('');
        } else {
            var titleText = '<a href="consul-services-ui.html?service=' + serviceName + '">'+serviceName+'</a>';
            $("#service-title").html(titleText);
        }
        serviceTimeline.serviceInstanceFilter = serviceName;
        if (updateUrl) {
          serviceTimeline.updateURL(serviceName == 'All' ? '' : serviceName);
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
        serviceTimeline.serviceFilterCount = 0;
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

    displayEvents() {
        //$("#service-title").html(service['name']);
        var tableBody = $('#all-events > tbody');
        tableBody.html("");
        var tbody = tableBody[0];
        var filter = "";
        for (var i = 0 ; i < this.data.length; i++) {
            var e = this.data[i];
            var row = document.createElement('tr');
            row.setAttribute("class", 'srv-' + e.service);
            this.buildCell(row, 'td', 'ts', this.appChild('time', document.createTextNode(e.ts)));
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
                var checksCell = document.createElement("div")
                this.buildCell(row, 'td', 'lookup checks', checksCell);
                for (var j = 0; j < e.checks.length; j++) {
                    var c = e.checks[j];
                    var statusSpan = document.createElement('div');
                    statusSpan.setAttribute('class', 'checkTransition');
                    statusSpan.appendChild(this.createBadge(c['old']));
                    statusSpan.appendChild(document.createTextNode('→'));
                    var newBadge = this.createBadge(c['new']);
                    newBadge.setAttribute('title', c['output']);
                    statusSpan.appendChild(newBadge);
                    checksCell.appendChild(statusSpan);
                    var checkName = document.createElement('div');
                    checkName.setAttribute('class', 'lookup checkName');
                    checkName.setAttribute('title', c['id']);
                    checkName.appendChild(document.createTextNode(c['name']));
                    checksCell.appendChild(checkName);
                }
            }
            {
                var statusSpan = document.createElement('span');
                statusSpan.appendChild(this.createBadge(e['old_state']));
                statusSpan.appendChild(document.createTextNode('→'));
                statusSpan.appendChild(this.createBadge(e['new_state']));
                this.buildCell(row, 'td', 'status', statusSpan);
            }
            {
                var allInstances = document.createElement('span');
                var nSuccess = e['stats']['passing'];
                if (nSuccess > 0) {
                    var success = this.createBadge(nSuccess, 'success');
                    allInstances.appendChild(success);
                }
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
                allInstances.appendChild(this.createBadge(percent + " %", clazz));
                row.appendChild(allInstances);
            }
            tbody.prepend(row)
        }
    }
}