class ConsulService {
  constructor(ressourceURL, refresh) {
    this.ressourceURL = ressourceURL;
    this.fetchRessource();
    this.serviceList = $("#service-list");
    this.serviceFilter = $("#service-filter");
    this.serviceFilter.keyup(this.filterService);
    this.refresh = parseInt(refresh);
    this.filterStatus = null;
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
        if($(nodes[i]).html() == urlParam) {
          this.selectService(nodes[i]);
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
    for (var service in this.data.services) {
      var listItem = '<button type="button" onclick="consulService.onClickServiceName(this)" class="list-group-item list-group-item-action">';
      listItem += '<span class="service-name">' + service + '</span>';
      listItem += '<span class="badge badge-pill badge-dark" style="float:right;">' + this.data.services[service].count + '</span>';
      listItem += '</button>';
      this.serviceList.append(listItem);
    }
    resizeWrapper('service-wrapper', 'service-list');
  }

  filterService(e) {
    var filter = new RegExp(e.target.value);
    consulService.serviceList.children('button').each(function (){
      if($(this).html().match(filter)) {
        $(this).removeClass('d-none');
        $(this).addClass('d-block');
      } else {
        $(this).removeClass('d-block');
        $(this).addClass('d-none');
      }
    })
  }

  onClickServiceName(source) {
    this.selectService(source);
    this.updateURL();
  }

  onClickFilter(source) {
    var status = $(source).attr('status');
    this.filterStatus = (this.filterStatus == status) ? null : status;
    this.filterInstances();
  }

  filterInstances() {
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
    $('#instances-list').children('div').each(function() {
      var status = $(this).attr('status');
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
    })
  }

  updateURL() {
    var newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    newUrl += '?service=' + $(this.selectedService).html();
    window.history.pushState({},"",newUrl);
  }

  selectService(source) {
    if (this.selectedService) {
      $(this.selectedService).removeClass('active');
    }
    this.selectedService = source;
    $(this.selectedService).addClass('active');

    var serviceName = $(source).find(".service-name").html();

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
  if (protocol != null) {
    instanceLink.setAttribute('href',  protocol + instance.name + ':' + instance.port);
    instanceLink.setAttribute('target',  '_blank');
  }
  instanceLink.appendChild(document.createTextNode(instance.name + ':' + instance.port));
  htmlTitle.appendChild(instanceLink);

  return htmlTitle;
}

function tagsGenerator(instance) {
  var tags = document.createElement('div');

  tags.className = 'tags';
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

$( window ).resize(resizeAll);
resizeAll();
