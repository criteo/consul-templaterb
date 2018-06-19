function buildServiceStatus(service) {
  var serviceStatus = {};

  for (var key in service['instances']) {
    var instance = service['instances'][key];
    var state = nodeState(instance.checks);

    serviceStatus[state] = (serviceStatus[state] || 0) + 1;
    serviceStatus['total'] = (serviceStatus['total'] || 0) + 1;
  }

  return serviceStatus;
}

function nodeState(checks) {
  status='passing';
  for (var checkKey in checks) {
    switch(checks[checkKey]['status']) {
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

function nodeNameGenator(nodename, nodeaddr) {
  var protocol = 'ssh://'

  var htmlTitle = document.createElement('h5');

  var instanceLink = document.createElement('a');
  instanceLink.setAttribute('class',  'instance-name');
  if (protocol != null) {
    instanceLink.setAttribute('href',  protocol + nodeaddr);
    instanceLink.setAttribute('target',  '_blank');
  }
  instanceLink.appendChild(document.createTextNode(nodename));
  htmlTitle.appendChild(instanceLink);

  return htmlTitle;
}

function nodeAddressGenator(nodeaddr) {
  var htmlAddress = document.createElement('h5');
  htmlAddress.className = 'instance-addr';
  htmlAddress.appendChild(document.createTextNode(nodeaddr));
  return htmlAddress;
}

function nodeMetaGenator(nodeMetaTags) {
  var metaTags = document.createElement('div');
  metaTags.className = 'meta-tags';
  for (var tagKey in nodeMetaTags) {
    if(!nodeMetaTags[tagKey]) {
      continue;
    }
    var metaTag = document.createElement('span');
    metaTag.setAttribute('class', 'badge badge-primary mx-1');
    metaTag.appendChild(document.createTextNode(tagKey + ':' + nodeMetaTags[tagKey]));
    metaTags.appendChild(metaTag);
  }
  return metaTags;
}

function tagsGenerator(instanceTags) {
  var tags = document.createElement('div');

  tags.className = 'instance-tags';
  tags.appendChild(document.createTextNode("Tags: "));
  tags.appendChild(document.createElement('br'));
  for (var tagKey in instanceTags) {
    var tag = document.createElement('span');
    tag.setAttribute('class', 'badge badge-secondary mx-1');
    tag.appendChild(document.createTextNode(instanceTags[tagKey]));
    tags.appendChild(tag);
  }
  return tags;
}

function serviceMetaGenerator(instanceMeta) {
  var top = document.createElement('div');
  top.className = 'instance-meta';
  if (instanceMeta) {
    var container = document.createElement('dl');
    top.appendChild(container);
    container.className = 'row';
    for (var meta in instanceMeta) {
      var metaH = document.createElement('dt');
      metaH.className = 'col-sm-4';
      metaH.appendChild(document.createTextNode(meta));
      container.appendChild(metaH);
      var metaVH = document.createElement('dd');
      metaVH.className = 'col-sm-8';
      metaVH.appendChild(document.createTextNode(instanceMeta[meta]));
      container.appendChild(metaVH);
    }
  }
  return top;
}

function servicesGenerator(instanceServices) {
  var services = document.createElement('div');
  services.className = 'instance-services';
  services.appendChild(document.createTextNode("Services: "));
  services.appendChild(document.createElement('br'));
  for (var serviceKey in instanceServices) {
    var service = document.createElement('a');
    var serviceName = instanceServices[serviceKey]['Service']['Service'];
    var servicePort = instanceServices[serviceKey]['Service']['Port'];
    service.setAttribute('class', 'btn btn-sm m-1');
    service.setAttribute('target', '_blank');
    nodeAddr = instanceServices[serviceKey]['Service']['Address'];
    service.setAttribute('href', 'http://' + nodeAddr + ':' + servicePort);
    switch(nodeState(instanceServices[serviceKey]['Checks'])) {
        case 'passing': service.classList.add('btn-outline-success'); break;
        case 'warning': service.classList.add('btn-outline-warning'); break;
        case 'critical': service.classList.add('btn-outline-danger'); break;
    }
    service.appendChild(document.createTextNode(serviceName + ':' + servicePort));
    services.appendChild(service);
  }
  return services;
}

function checksStatusGenerator(instanceChecks) {
  var checks = document.createElement('div');
  checks.className = 'checks';
  checks.appendChild(document.createTextNode("Checks: "));
  checks.appendChild(document.createElement('br'));

  for (var checkKey in instanceChecks) {
    checkId = Math.floor(Math.random()*10000);
    switch(instanceChecks[checkKey]['status']) {
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

    btnCheck.appendChild(document.createTextNode(instanceChecks[checkKey]['name']));

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
      target.appendChild(document.createTextNode(instanceChecks[checkKey][dataToDisplay[index]]));
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

function resizeInstances() {
  resizeWrapper('instances-wrapper', 'instances-list');
}

function resizeData() {
  resizeWrapper('keys-wrapper', 'keys-list');
  resizeWrapper('data-wrapper', 'kv-data');
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

  var sstatus = service.getAttribute('status')
  if(sstatus && sstatus.match(regex)) {
    return true;
  }
  
  return false;
}

function keyMatcher(service, regex) {
  if(service.getElementsByClassName('key-name')[0].innerHTML.match(regex)) {
    return true;
  }
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

function nodeMatcher(instance, regex) {
    instanceMatcher(instance, regex);
    if(instance.getElementsByClassName('instance-name')[0].innerHTML.match(regex)) {
      return true;
    }

    if(instance.getElementsByClassName('instance-addr')[0].innerHTML.match(regex)) {
      return true;
    }

    var metaTags = instance.getElementsByClassName('meta-tags')[0].getElementsByClassName('badge');
    for (var i=0; i < metaTags.length; i++) {
      if(metaTags[i].innerHTML.match(regex)) {
        return true;
      }
    }

    var services = instance.getElementsByClassName('instance-services')[0].getElementsByClassName('btn');
    for (var i=0; i < services.length; i++) {
      if(services[i].innerHTML.match(regex)) {
        return true;
      }
    }
}

function getTagsNode(node) {
  tags = new Set([]);
  for (service in node['Service']) {
    for (tag in node['Service'][service]['Service']['Tags']) {
      tags.add(node['Service'][service]['Service']['Tags'][tag]);
    }
  }
  return Array.from(tags);
}

function getChecksNode(node) {
  checks = [];
  for (service in node['Service']) {
    for (check in node['Service'][service]['Checks']) {
      checks.push(node['Service'][service]['Checks'][check]);
    }
  }
  return checks;
}

function getGeneralNodeStatus(nodeService) {
  status='passing';
  for (var serviceKey in nodeService) {
    switch(nodeState(nodeService[serviceKey]['Checks'])) {
        case 'passing': break;
        case 'warning': status='warning'; break;
        case 'critical': return 'critical'; break;
    }
  }
  return status;
}

function updateStatusItem(statuses) {
  states = ['passing', 'warning', 'critical', 'total']
  for (state in states) {
    document.getElementById('service-status-' + states[state]).innerHTML = (statuses[states[state]] || 0);
  }
}

function updateFilterDisplay(filterStatus) {
  $('.progress-status').each(function() {
    var status = $(this).attr('status');
    if (filterStatus == null || filterStatus == status) {
      $(this).removeClass('progress-deactivated');
    } else {
      $(this).addClass('progress-deactivated');
    }
  })
  $('.service-status').each(function() {
    var status = $(this).attr('status');
    if (filterStatus == null || filterStatus == status) {
      $(this).removeClass('status-deactivated');
    } else {
      $(this).addClass('status-deactivated');
    }
  })

}
