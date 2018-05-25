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
