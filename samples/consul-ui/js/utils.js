function buildServiceStatus(service) {
    var serviceStatus = {};
    for (var key in service['instances']) {
        var instance = service['instances'][key];
        var state = nodeState(instance.checks);

        serviceStatus[state] = (serviceStatus[state] || 0) + 1;
        serviceStatus['total'] = (serviceStatus['total'] || 0) + 1;
    }
    service["status"] = serviceStatus
    return serviceStatus;
}

var timeouts = {};

function debounce(name, func, wait) {
    return function() {
      var context = this,
          args = arguments;
      var later = function () {
          timeouts[name] = null;
          func.apply(context, args);
      };
      if (timeouts[name] != null) {
        //console.log("Clearing timeout", name);
        clearTimeout(timeouts[name]);
      }
      timeouts[name] = setTimeout(later, wait);
    };
};

function padDateUnit(x) {
    return x > 9 ? x : '0' + x;
}

function formatDate(date) {
    return padDateUnit(date.getUTCMonth() + 1) + "/" + padDateUnit(date.getUTCDate()) + " " + padDateUnit(date.getUTCHours()) + ':' + padDateUnit(date.getUTCMinutes()) + ':' + padDateUnit(date.getUTCSeconds()) + " UTC";
}

function indexOfTimelineEvent(e) {
    if (e == null) {
        return 'k/0000000000/0000/0000';
    }
    return 'k/' + e.idx.toString().padStart(10, '0') + '/' + e.service + '/' + e.instance;
}

function nodeState(checks) {
    status = 'passing';
    for (var checkKey in checks) {
        switch (checks[checkKey]['status']) {
        case 'passing':
            break;
        case 'warning':
            status = 'warning';
            break;
        case 'critical':
            return 'critical';
            break;
        }
    }
    return status;
}

supported_protocols = ['https', 'http', 'sftp', 'ftp', 'ssh', 'telnet']

function serviceTitleGenerator(instance, serviceName, node_info) {
    var protocol = null;
    for (i in supported_protocols) {
        var protoc = supported_protocols[i]
        if (instance.tags.includes(protoc)) {
            protocol = protoc + '://';
            break;
        }
    }

    var htmlTitle = document.createElement('h5');

    htmlTitle.setAttribute('class', 'instance-name');
    var instanceLink = document.createElement('a');
    var appendPort = "";
    if (instance.port > 0) {
        appendPort = ':' + instance.port;
    }
    if (protocol != null) {
        instanceLink.setAttribute('href', protocol + instance.addr + appendPort);
        instanceLink.setAttribute('target', '_blank');
    }

    var nodemeta = (node_info != null) ? node_info.meta : null; 
    instanceLink.appendChild(createNodeDisplayElement(instance.name, nodemeta, instance?.sMeta?.fqdn));
    instanceLink.appendChild(document.createTextNode(appendPort));

    const nodeInfo = document.createElement('a');
    nodeInfo.appendChild(document.createTextNode('\u24D8'));
    nodeInfo.setAttribute('title', 'Click to see details of Node: ' + instance.name +
        '\nAddress: ' + instance.addr +
        '\nService ID: ' + instance.id +
        '\nService Port: ' + instance.port);
    nodeInfo.setAttribute('href', 'consul-nodes-ui.html?node_filter=^' + encodeURIComponent(instance.name) + '$');
    htmlTitle.appendChild(nodeInfo);
    htmlTitle.appendChild(document.createTextNode(' '));
    htmlTitle.appendChild(instanceLink);
    htmlTitle.appendChild(document.createTextNode(' '));
    htmlTitle.appendChild(document.createTextNode(instance.addr));

    return htmlTitle;
}

function nodeNameGenator(node) {
    var protocol = 'ssh://'

    var htmlTitle = document.createElement('h5');

    var instanceLink = document.createElement('a');
    instanceLink.setAttribute('class', 'instance-name');
    if (protocol != null) {
        instanceLink.setAttribute('href', protocol + node['Address']);
        instanceLink.setAttribute('target', '_blank');
    }
    instanceLink.appendChild(createNodeDisplayElement(node['Name'], node['Meta']));
    htmlTitle.appendChild(instanceLink);

    return htmlTitle;
}

function nodeAddressGenator(nodeaddr) {
    var htmlAddress = document.createElement('h5');
    htmlAddress.className = 'instance-addr lookup';
    htmlAddress.appendChild(document.createTextNode(nodeaddr));
    return htmlAddress;
}

function tagsGenerator(instanceTags) {
    var tags = document.createElement('div');

    tags.className = 'instance-tags';
    tags.setAttribute('title', 'Tags of Service');
    for (var tagKey in instanceTags) {
        var tag = document.createElement('span');
        tag.setAttribute('class', 'badge badge-secondary mx-1 lookup');
        tag.appendChild(document.createTextNode(instanceTags[tagKey]));
        tags.appendChild(tag);
    }
    return tags;
}

function connectGenerator(instance) {
    var connectItem = document.createElement('div');
    var connectValue = instance['connect']
    if (connectValue != null && connectValue["Proxy"]) {
        connectItem.setAttribute('class', 'connect-enabled');
        var badge = document.createElement("span");
        badge.setAttribute("class", "badge badge-primary");
        badge.appendChild(document.createTextNode("Consul Connect Enabled"));
        connectItem.appendChild(badge);
        var content = document.createElement("pre");
        content.setAttribute("class", "connect-data");
        var code = document.createElement("code");
        code.setAttribute("class", "connect-source");
        code.appendChild(document.createTextNode(JSON.stringify(connectValue)));
        content.appendChild(code);
        connectItem.appendChild(content);
        return connectItem;
    } else {
        connectItem.setAttribute('class', 'connect-disabled');
    }
    return connectItem
}

function serviceMetaGenerator(instance, serviceName) {
    var instanceMeta = instance.sMeta;
    var top = document.createElement('div');
    top.className = 'instance-meta';
    if (instanceMeta) {
        var container = document.createElement('dl');
        top.appendChild(container);
        container.className = 'row';
        for (var meta in instanceMeta) {
            var metaH = document.createElement('dt');
            metaH.className = 'col-sm-4 lookup';
            metaH.appendChild(document.createTextNode(meta));
            container.appendChild(metaH);
            var metaVH = document.createElement('dd');
            metaVH.className = 'col-sm-8 lookup';
            metaVH.appendChild(serviceMetaDecorator(instance, meta, instanceMeta[meta], serviceName));
            container.appendChild(metaVH);
        }
    }
    return top;
}

function weightsGenerator(instanceWeights, instanceStatus) {
    var weights = document.createElement('div');
    if (instanceWeights != null) {
        weights.setAttribute('class', 'weights weight-passing badge badge-' + toCSSClass(instanceStatus));
        weights.appendChild(document.createTextNode("Weights: ")); {
            var passing = document.createElement("span");
            passing.setAttribute("class", "weight-passing badge badge-success");
            passing.appendChild(document.createTextNode(instanceWeights['Passing']));
            passing.setAttribute('title', "DNS Weight when in warning state")
            weights.appendChild(passing);
        }
        weights.appendChild(document.createTextNode(' ')); {
            var warning = document.createElement("span");
            warning.setAttribute("class", "weight-warning badge badge-warning");
            warning.setAttribute('title', "DNS Weight when in warning state")
            warning.appendChild(document.createTextNode(instanceWeights['Warning']));
            weights.appendChild(warning);
        }
        return weights;
    } else {
        weights.setAttribute('class', 'weights-absent');
    }
    return weights
}

function toCSSClass(state) {
    switch (state) {
    case 'passing':
        return 'success';
    case 'critical':
        return 'danger';
    }
    return state;
}

function servicesGenerator(instanceServices, node) {
    var servicesTop = document.createElement('div');
    servicesTop.className = 'instance-services';
    const card = document.createElement('div');
    card.setAttribute('class', 'card');
    const servicesCard = document.createElement('div');
    servicesCard.setAttribute('class', 'card-body');
    const title = document.createElement('h5');
    title.appendChild(document.createTextNode('Services'));
    title.setAttribute('class', 'card-title')
    servicesCard.appendChild(title);
    const services = document.createElement('div');
    servicesCard.appendChild(services);
    for (var serviceKey in instanceServices) {
        const serviceGrp = document.createElement('span');
        serviceGrp.setAttribute('class', 'btn btn-sm');
        serviceGrp.classList.add('btn-outline-' + toCSSClass(nodeState(instanceServices[serviceKey]['Checks'])))
        const service = document.createElement('a');
        serviceGrp.appendChild(service);
        const serviceName = instanceServices[serviceKey]['Service']['Service'];
        service.setAttribute('class', 'serviceLink');
        service.setAttribute('href', 'consul-services-ui.html?service=' + encodeURIComponent(serviceName) + '&node_filter=^' + encodeURIComponent(node['Node']['Name'])+'$');
        service.appendChild(document.createTextNode(serviceName));
        var servicePort = instanceServices[serviceKey]['Service']['Port'];
        if (servicePort) {
            // Add unbreakable space
            serviceGrp.appendChild(document.createTextNode('\u00A0'));
            const servicePortElem = document.createElement('a');
            servicePortElem.setAttribute('class', 'serviceTargetPort');
            const nodeAddr = instanceServices[serviceKey]['Service']['Address'];
            servicePortElem.setAttribute('href', 'http://' + nodeAddr + ':' + servicePort);
            servicePortElem.appendChild(document.createTextNode(':' + servicePort));
            serviceGrp.appendChild(servicePortElem);
        }
        services.appendChild(serviceGrp);
    }
    servicesTop.appendChild(servicesCard);
    return servicesTop;
}

function checksStatusGenerator(instance, prefix) {
    var instanceChecks = instance.checks;
    var checks = document.createElement('div');
    checks.className = 'checks';
    checks.setAttribute('title', 'Checks of Node/Service')

    for (var checkKey in instanceChecks) {
        var checkInstance = instanceChecks[checkKey];
        var checkId = prefix + '::' + checkInstance.checkid;
        var btn = 'btn-' + toCSSClass(instanceChecks[checkKey]['status'])
        var check = document.createElement('div');

        var btnCheck = document.createElement('button');
        btnCheck.setAttribute('class', 'btn ' + btn + ' btn-sm m-1');
        btnCheck.setAttribute('type', 'button');
        btnCheck.setAttribute('data-toggle', 'collapse');
        btnCheck.setAttribute('data-target', '#' + checkId);
        btnCheck.setAttribute('aria-expanded', 'false');
        btnCheck.setAttribute('title', checkInstance.checkid);

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

function serviceMatcher(service, regex, showProxiesInList) {
    if (service.getElementsByClassName('service-name')[0].innerHTML.match(regex)) {
        if (!showProxiesInList && service.classList.contains('kind-connect-proxy')) {
            return false;
        }
        return true;
    }
    var tags = service.getElementsByClassName('service-tags')[0].getElementsByClassName('badge');

    for (var i = 0; i < tags.length; i++) {
        if (tags[i].innerHTML.match(regex)) {
            return true;
        }
    }

    var sstatus = service.getAttribute('status')
    if (sstatus && sstatus.match(regex)) {
        return true;
    }

    return false;
}

function keyMatcher(service, regex) {
    if (service.getElementsByClassName('key-name')[0].innerHTML.match(regex)) {
        return true;
    }
}

function hasMatches(instance, regex) {
    var toLookup = instance.getElementsByClassName('lookup');
    for (var i = 0; i < toLookup.length; i++) {
        if (toLookup[i].innerHTML.match(regex)) {
            return true;
        }
    }
    return false;
}

function instanceMatcher(instance, regex) {
    if (instance.getElementsByClassName('instance-name')[0].innerHTML.match(regex)) {
        return true;
    }

    return hasMatches(instance, regex);
}

function nodeMatcher(instance, regex) {
    instanceMatcher(instance, regex);
    if (instance.getElementsByClassName('instance-name')[0].innerHTML.match(regex)) {
        return true;
    }

    return hasMatches(instance, regex);
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
    status = 'passing';

    for (var serviceKey in nodeService) {
        if (nodeService[serviceKey] != null && "Checks" in nodeService[serviceKey]) {
            switch (nodeState(nodeService[serviceKey]['Checks']))  {
            case 'passing':
                break;
            case 'warning':
                status = 'warning';
                break;
            case 'critical':
                return 'critical';
                break;
            }
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
    $('.progress-status').each(function () {
        var status = $(this).attr('status');
        if (filterStatus == null || filterStatus == status) {
            $(this).removeClass('progress-deactivated');
        } else {
            $(this).addClass('progress-deactivated');
        }
    })
    $('.service-status').each(function () {
        var status = $(this).attr('status');
        if (filterStatus == null || filterStatus == status) {
            $(this).removeClass('status-deactivated');
        } else {
            $(this).addClass('status-deactivated');
        }
    })

}

function updateURL(arg, value) {
    var newUrl = new URL(location.href);
    if (value == "" || value == null) {
        newUrl.searchParams.delete(arg);
    } else {
        newUrl.searchParams.set(arg, value);
    }

    window.history.pushState({}, "", newUrl);
}
