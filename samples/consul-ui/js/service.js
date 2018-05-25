class ConsulService {
  constructor(ressourceURL, refresh) {
    this.ressourceURL = ressourceURL;
    this.fetchRessource();
    this.serviceList = $("#service-list");
    this.serviceFilter = $("#service-filter");
    this.serviceFilter.keyup(this.filterService);
    this.instanceFilter = $("#instance-filter");
    this.instanceFilter.keyup(this.filterInstances);
    this.refresh = parseInt(refresh);
    this.filterStatus = null;
    this.serviceFilterCounter = $("#service-counter");
    this.serviceFilterCount = 0;
    this.showTags($('#showTagsInList').checked)
  }

  showTags(showTags) {
    var stylesheet = document.getElementById('css-states');
    stylesheet.textContent = '.service-tags { display: ' + (showTags? 'block':'none') + ';}';
  }

  fetchRessource() {
    $.ajax({url: "consul_template.json", cache: false, dataType: "json", sourceObject: this, success: function(result){
      consulService.initRessource(result);
    }});
  }

  initRessource(data) {
    this.data = data;
    this.reloadServiceList();
    console.log('Data generated at: ' + data['generated_at']);

    var urlParam = new URL(location.href).searchParams.get('service');
    if (urlParam) {
      var nodes = document.getElementById('service-list').childNodes;
      for(var i in nodes) {
        if($(nodes[i]).find(".service-name").html() == urlParam) {
          var selectedElement = $(nodes[i])
          this.selectService(selectedElement);
          selectedElement.focus()
          break;
        }
      }
    } else {
      this.selectService(document.getElementById('service-list').firstElementChild);
    }

    if(this.refresh > 0) {
      setTimeout(this.fetchRessource, this.refresh * 1000);
    }
  }

  reloadServiceList() {
    this.serviceList.html('');
    this.serviceFilterCount = 0;
    for (var serviceName in this.data.services) {
      var service = this.data.services[serviceName];
      var serviceStatus = buildServiceStatus(service);

      var listItem = document.createElement('button');
      listItem.setAttribute('type','button');
      listItem.setAttribute('onfocus','consulService.onClickServiceName(this)');
      listItem.setAttribute('onclick','consulService.onClickServiceName(this)');
      listItem.setAttribute('value',serviceName);
      listItem.setAttribute('class','list-group-item list-group-item-action');

      var statuses = document.createElement('div');
      statuses.setAttribute('class','statuses float-right');

      if (!!serviceStatus['passing']) {
        statuses.appendChild(createBadge('badge-success passing', serviceStatus['passing']));
      }

      if (!!serviceStatus['warning']) {
        statuses.appendChild(createBadge('badge-warning warning', serviceStatus['warning']));
      }

      if (!!serviceStatus['critical']) {
        statuses.appendChild(createBadge('badge-danger critical', serviceStatus['critical']));
      }

      statuses.appendChild(createBadge('badge-dark', (serviceStatus['total'] || 0)));
      listItem.appendChild(statuses);

      var serviceNameItem = document.createElement('div');
      serviceNameItem.setAttribute('class', 'service-name');
      serviceNameItem.appendChild(document.createTextNode(serviceName));
      listItem.appendChild(serviceNameItem);

      var serviceTagsItem = document.createElement('div');
      serviceTagsItem.setAttribute('class', 'service-tags');

      for (var i = 0; i < service.tags.length; i++) {
        serviceTagsItem.appendChild(createBadge('float-right badge-' + (i%2?'secondary':'info') , service.tags[i]));
      }

      listItem.appendChild(serviceTagsItem);
      this.serviceFilterCount += 1;
      this.serviceList.append(listItem);
    }
    this.serviceFilterCounter.html(this.serviceFilterCount);
    resizeWrapper('service-wrapper', 'service-list');
    this.filterService();
  }

  filterService() {
    var filter = new RegExp(consulService.serviceFilter.val());
    consulService.serviceFilterCount = 0;
    consulService.serviceList.children('button').each(function (){
      var ui = $(this);
      if(serviceMatcher(this, filter)) {
        ui.removeClass('d-none');
        ui.addClass('d-block');
        consulService.serviceFilterCount += 1;
        consulService.serviceFilterCounter.html(consulService.serviceFilterCount);
      } else {
        ui.removeClass('d-block');
        ui.addClass('d-none');
      }
    })
  }

  onClickServiceName(source) {
    this.selectService(source);
    this.updateURL($(source).find(".service-name").html());
  }

  onClickFilter(source) {
    var status = $(source).attr('status');
    this.filterStatus = (this.filterStatus == status) ? null : status;
    this.filterInstances();
  }

  filterInstances() {
    console.log("Filtering");
    $('.progress-status').each(function() {
      var status = $(this).attr('status');
      if (consulService.filterStatus == null) {
        $(this).removeClass('progress-deactivated');
      } else if(consulService.filterStatus == status) {
        $(this).removeClass('progress-deactivated');
      } else {
        $(this).addClass('progress-deactivated');
      }
    })
    var filter = new RegExp(consulService.instanceFilter.val());
    $('#instances-list').children('div').each(function() {
      var status = $(this).attr('status');
      if(instanceMatcher(this, filter)) {
        if (consulService.filterStatus == null) {
          $(this).removeClass('d-none');
          $(this).addClass('d-block');
        } else if (consulService.filterStatus == status) {
          $(this).removeClass('d-none');
          $(this).addClass('d-block');
        } else {
          $(this).removeClass('d-block');
          $(this).addClass('d-none');
        }
      } else {
        $(this).removeClass('d-block');
        $(this).addClass('d-none');
      }
    })
  }

  updateURL(link) {
    var newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    if (link) {
      newUrl += '?service=' + link
    }
    window.history.pushState({},"",newUrl);
  }

  selectService(source) {
    if (this.selectedService) {
      $(this.selectedService).removeClass('active');
    }
    var serviceName = $(source).find(".service-name").html()
    this.selectedService = source.closest( "button" );
    $(this.selectedService).addClass('active');

    this.displayService(this.data.services[serviceName]);
  }

  displayService(service) {
    $("#service-title").html(service['name']);
    $("#instances-list").html("");

    var serviceStatus = buildServiceStatus(service);

    for (var key in service['instances']) {
      var instance = service['instances'][key];
      var serviceHtml = document.createElement('div');
      serviceHtml.setAttribute('class','list-group-item');

      serviceHtml.appendChild(serviceTitleGenerator(instance));
      serviceHtml.appendChild(tagsGenerator(instance));
      serviceHtml.appendChild(checksStatusGenerator(instance));
      var state = nodeState(instance);
      serviceHtml.setAttribute('status', state);
      $("#instances-list").append(serviceHtml);
    }

    $('#service-progress-passing').css('width', (serviceStatus['passing'] || 0) / serviceStatus['total'] * 100 + '%')
    $('#service-progress-passing').html("passing (" + (serviceStatus['passing'] || 0) + ")")
    $('#service-progress-warning').css('width', (serviceStatus['warning'] || 0) / serviceStatus['total'] * 100 + '%')
    $('#service-progress-warning').html("warning (" + (serviceStatus['warning'] || 0) +")")
    $('#service-progress-critical').css('width', (serviceStatus['critical'] || 0) / serviceStatus['total'] * 100 + '%')
    $('#service-progress-critical').html("critical (" + (serviceStatus['critical'] || 0) + ")")

    resizeWrapper('instances-wrapper', 'instances-list');
    $('#instances-list .list-group-item').resize(resizeAll);
  }
}

function buildServiceStatus(service) {
  var serviceStatus = {};

  for (var key in service['instances']) {
    var instance = service['instances'][key];
    var state = nodeState(instance);

    serviceStatus[state] = (serviceStatus[state] || 0) + 1;
    serviceStatus['total'] = (serviceStatus['total'] || 0) + 1;
  }

  return serviceStatus;
}

function nodeState(instance) {
  status='passing';
  for (var checkKey in instance.checks) {
    switch(instance.checks[checkKey]['status']) {
      case 'passing': break;
      case 'warning': status='warning'; break;
      case 'critical': return 'critical'; break;
    }
  }
  return status;
}

supported_protocols = ['https', 'http', 'sftp', 'ftp', 'ssh', 'telnet']

function serviceTitleGenerator(instance) {
  var protocol = null;
  for (i in supported_protocols) {
    var protoc = supported_protocols[i]
    if (instance.tags.includes(protoc)) {
      protocol = protoc + '://';
      break;
    }
  }

  var htmlTitle = document.createElement('h5');

  var instanceLink = document.createElement('a');
  instanceLink.setAttribute('class',  'instance-name');
  if (protocol != null) {
    instanceLink.setAttribute('href',  protocol + instance.addr + ':' + instance.port);
    instanceLink.setAttribute('target',  '_blank');
  }
  instanceLink.appendChild(document.createTextNode(instance.name + ':' + instance.port));
  htmlTitle.appendChild(instanceLink);

  return htmlTitle;
}

function tagsGenerator(instance) {
  var tags = document.createElement('div');

  tags.className = 'instance-tags';
  tags.appendChild(document.createTextNode("Tags: "));
  tags.appendChild(document.createElement('br'));

  for (var tagKey in instance.tags) {
    var tag = document.createElement('span');
    tag.setAttribute('class', 'badge badge-secondary mx-1');
    tag.appendChild(document.createTextNode(instance.tags[tagKey]));
    tags.appendChild(tag);
  }
  return tags;
}

function checksStatusGenerator(instance) {
  var checks = document.createElement('div');
  checks.className = 'checks';
  checks.appendChild(document.createTextNode("Checks: "));
  checks.appendChild(document.createElement('br'));

  for (var checkKey in instance.checks) {
    checkId = Math.floor(Math.random()*10000);
    switch(instance.checks[checkKey]['status']) {
      case 'passing': var btn = 'btn-success'; break;
      case 'warning': var btn = 'btn-warning'; break;
      case 'critical': var btn = 'btn-danger'; break;
    }
    var check = document.createElement('div');

    var btnCheck = document.createElement('button');
    btnCheck.setAttribute('class','btn ' + btn + ' btn-sm m-1');
    btnCheck.setAttribute('type', 'button');
    btnCheck.setAttribute('data-toggle', 'collapse');
    btnCheck.setAttribute('data-target', '#' + checkId);
    btnCheck.setAttribute('aria-expanded', 'false');

    btnCheck.appendChild(document.createTextNode(instance.checks[checkKey]['name']));

    check.appendChild(btnCheck);

    var collapseCheck = document.createElement('div');
    collapseCheck.setAttribute('class', 'collapse')
    collapseCheck.setAttribute('id', checkId)

    var cardCheck = document.createElement('div');
    cardCheck.setAttribute('class', 'card card-body p-3 m-1 mb-2');

    var notes = document.createElement('table');
    notes.setAttribute('class', 'table table-hover mb-0');

    var dataToDisplay = ['notes', 'output'];
    for (var index in dataToDisplay) {
      var tr = document.createElement('tr');
      var td1 = document.createElement('td');
      var td2 = document.createElement('td');
      var fieldName = dataToDisplay[index].replace(/\b\w/g, l => l.toUpperCase());
      td1.appendChild(document.createTextNode(fieldName + ': '));
      var target = td2
      if (index != 1) {
        target = document.createElement('div');
        target.setAttribute("class", "check-notes")
      } else {
        // Notes are rendered as plain text
        target = document.createElement('pre');
        target.setAttribute("class", "check-output")
      }
      target.appendChild(document.createTextNode(instance.checks[checkKey][dataToDisplay[index]]));
      td2.appendChild(target)
      tr.appendChild(td1);
      tr.appendChild(td2);
      notes.appendChild(tr);
    }

    cardCheck.appendChild(notes);
    collapseCheck.appendChild(cardCheck);
    check.appendChild(collapseCheck);
    checks.appendChild(check)
  }

  return checks;
}

function resizeAll() {
  resizeWrapper('service-wrapper', 'service-list');
  resizeWrapper('instances-wrapper', 'instances-list');
}

function resizeWrapper(wrapperId, wrapped) {
  var size = $(window).height() - $('#' + wrapperId).offset()["top"] - 20;
  $('#' + wrapperId).css("height", size);
}

function createBadge(classes, data) {
  var badge = document.createElement('span');
  badge.setAttribute('class', 'badge mx-1');
  classesArray = classes.split(' ');
  for (var i = 0; i < classesArray.length; i++) {
    badge.classList.add(classesArray[i]);
  }

  badge.appendChild(document.createTextNode(data));
  return badge;
}

function serviceMatcher(service, regex) {
  if(service.getElementsByClassName('service-name')[0].innerHTML.match(regex)) {
    return true;
  }
  var tags = service.getElementsByClassName('service-tags')[0].getElementsByClassName('badge');

  for (var i=0; i < tags.length; i++) {
    if(tags[i].innerHTML.match(regex)) {
      return true;
    }
  }
  return false;
}

function instanceMatcher(instance, regex) {
  if(instance.getElementsByClassName('instance-name')[0].innerHTML.match(regex)) {
    return true;
  }
  var tags = instance.getElementsByClassName('instance-tags')[0].getElementsByClassName('badge');

  for (var i=0; i < tags.length; i++) {
    if(tags[i].innerHTML.match(regex)) {
      return true;
    }
  }
  return false;
}

$( window ).resize(resizeAll);
resizeAll();
