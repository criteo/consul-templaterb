class ConsulService {
  constructor(resourceURL, refresh) {
    this.resourceURL = resourceURL;
    this.fetchRessource();
    this.serviceList = $("#service-list");
    this.serviceFilter = $("#service-filter");
    this.serviceFilter.keyup(debounce(this.filterService, 250));
    this.instanceFilter = $("#instance-filter");
    this.instanceFilter.keyup(debounce(this.filterInstances, 250));
    this.refresh = parseInt(refresh);
    this.filterStatus = null;
    this.serviceFilterCounter = $("#service-counter");
    this.serviceFilterCount = 0;
    this.showProxiesInList = false;
    var cs = this
    this.loadFavorites();
    window.setTimeout(function(){
      cs.showTags($('#showTagsInList:checked').length > 0);
      cs.showProxies($('#showProxiesInList:checked').length > 0);
    }, 100);
  }

  showTags(enableTags) {
    var stylesheet = document.getElementById('css-states');
    stylesheet.textContent = '.service-tags { display: ' + (enableTags? 'block':'none') + '!important ;}';
  }

  showProxies(showProxies) {
    if (showProxies != this.showProxiesInList) {
      this.showProxiesInList = showProxies;
      console.log("showProxies:= "+this.showProxiesInList+", reloading list")
      this.reloadServiceList();
    }
  }

  async fetchRessource() {
    const response = await fetch(this.resourceURL);
    const result = await response.json();
    await this.initRessource(result);
  }

  async initRessource(data) {
    this.data = data;
    await this.reloadServiceList();
    console.log('Data generated at: ' + data['generated_at']);

    var urlParam = new URL(location.href).searchParams.get('service');

    if (urlParam) {
      var nodes = document.getElementById('service-list').childNodes;
      for (const node of nodes) {
        if($(node).find(".service-name").html() == urlParam) {
          var selectedElement = $(node)
          this.selectService(selectedElement);
          selectedElement.focus()
          break;
        }
      }
      this.serviceFilter.val(urlParam);
      this.filterService()
  } else {
      var servicePrefix = '#service_'
      if (location.hash.startsWith(servicePrefix)) {
        urlParam = location.hash.substr(servicePrefix.length)
      }
      this.selectService(document.getElementById('service-list').firstElementChild);
    }

    if(this.refresh > 0) {
      setTimeout(this.fetchRessource, this.refresh * 1000);
    }
  }

  async reloadServiceList() {
    this.serviceList.html('');
    this.serviceFilterCount = 0;

    if (!this.data || !this.data.services) {
      console.log("No data to display");
    } else {
      const services = Object.values(this.data.services).map((service, index) => ({ service, index }));
      const favorites = services.filter(({ service }) => this.favorites[service.name]);
      const others = services.filter(({ service }) => !this.favorites[service.name]);

      const appendServiceAsync = ({ service, index }) =>
        new Promise(resolve =>
          setTimeout(() => {
            this.appendService(service, index);
            resolve();
          }, 0)
        );

      await Promise.all([...favorites, ...others].map(appendServiceAsync));
    }

    this.serviceFilterCounter.html(this.serviceFilterCount);
    resizeWrapper('service-wrapper', 'service-list');
    this.filterService();
  }

  appendService(service, index) {
    var serviceName = service.name;
    var serviceStatus = buildServiceStatus(service);

    var listItem = document.createElement('li');
    listItem.setAttribute('onfocus','consulService.onClickServiceName(this)');
    listItem.setAttribute('onclick','consulService.onClickServiceName(this)');
    listItem.setAttribute('value', serviceName);
    listItem.setAttribute('data-fav', this.favorites[serviceName] ? 1 : 0);
    listItem.setAttribute('data-index', index);
    var listItemClass = 'serviceListItem list-group-item list-group-item-action';

    var statuses = document.createElement('div');
    statuses.setAttribute('class','statuses float-right');

    if (!!serviceStatus['passing']) {
      statuses.appendChild(createBadge('badge-success passing', serviceStatus['passing']));
      listItem.setAttribute('status', 'passing');
    }

    if (!!serviceStatus['warning']) {
      statuses.appendChild(createBadge('badge-warning warning', serviceStatus['warning']));
      listItem.setAttribute('status', 'warning');
    }

    if (!!serviceStatus['critical']) {
      statuses.appendChild(createBadge('badge-danger critical', serviceStatus['critical']));
      listItem.setAttribute('status', 'critical');
    }

    statuses.appendChild(createBadge('badge-dark', (serviceStatus['total'] || 0)));

    statuses.append(this.buildFavButton(serviceName));

    listItem.appendChild(statuses);
    if (!!service['kind']) {
      var kind = document.createElement('div');
      kind.setAttribute('class','kind float-right');
      kind.appendChild(createBadge('badge-info kind', service['kind']));
      listItem.appendChild(kind);
      listItemClass+= " kind-" + service['kind'];
    }
    listItem.setAttribute('class', listItemClass);

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

    this.serviceList.append(listItem);

    this.serviceFilterCount += 1;
  }

  filterService() {
    var filter;
    var serviceVal = consulService.serviceFilter.val();
    try {
      filter = new RegExp(serviceVal);
    } catch (e) {
      var safeReg = serviceVal.replace(/[-[\]{}()*+?.,\\^$|]/g, "\\$&")
      console.log("Failed to compile regexp for '" + serviceVal + "', using strict lookup due to: " + e);
      filter = new RegExp(safeReg);
    }
    consulService.serviceFilterCount = 0;
    var showProxiesInList = this.showProxiesInList;
    consulService.serviceList.children('.serviceListItem').each(function (){
      var ui = $(this);
      if(serviceMatcher(this, filter, showProxiesInList)) {
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
    updateFilterDisplay(consulService.filterStatus);
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
    this.selectedService = source.closest('li');
    $(this.selectedService).addClass('active');

    this.displayService(this.data.services[serviceName], this.data.nodes);
  }

  displayService(service, nodes) {
    var titleText = service['name'] + ' <a href="consul-timeline-ui.html?service=' + service['name'] + '">timeline</a>';
    $("#service-title").html(titleText);
    $("#instances-list").html("");

    var serviceStatus = buildServiceStatus(service);

    for (var key in service['instances']) {
      var instance = service['instances'][key];
      var serviceHtml = document.createElement('div');
      serviceHtml.setAttribute('class','list-group-item service-instance');
      var state = nodeState(instance.checks);
      serviceHtml.appendChild(weightsGenerator(instance.weights, state));
      serviceHtml.appendChild(serviceTitleGenerator(instance));
      var node_info = nodes[instance.name];
      if (node_info != null) {
        node_info = node_info.meta;
        serviceHtml.appendChild(nodeMetaGenerator(node_info));
        serviceHtml.appendChild(document.createElement('hr'));
      }
      if (instance.tags && instance.tags.length > 0) {
        serviceHtml.appendChild(tagsGenerator(instance.tags));
        serviceHtml.appendChild(document.createElement('hr'));
      }
      serviceHtml.appendChild(serviceMetaGenerator(instance.sMeta));
      serviceHtml.appendChild(connectGenerator(instance));
      serviceHtml.appendChild(checksStatusGenerator(instance, instance.name));
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
    this.filterInstances();
    $('pre code').each(function(i, block) {
      hljs.highlightBlock(block);
    });
  }

  loadFavorites() {
    const all = (localStorage.getItem('favorite_services') || '').split(',').filter(e => e != '');
    this.favorites = {}
    for (var i in all) {
      this.favorites[all[i]] = true;
    }
  }

  saveFavorites() {
    let str = "";
    for (var i in this.favorites) {
      if (!this.favorites[i]) {
        continue;
      }
      str == "" || (str += ",");
      str += i;
    }
    localStorage.setItem('favorite_services', str);
  }

  buildFavButton(serviceName) {
    const btn = document.createElement('button');
    btn.className = 'favorite';
    btn.setAttribute('title', 'Add/Remove from favorites');

    if (this.favorites[serviceName]) {
      btn.className += ' favorited';
    }

    $(btn).click(e => {
      this.toggleFav(serviceName, !this.favorites[serviceName]);
    });
    return btn;
  }

  toggleFav(serviceName, fav) {
    this.favorites[serviceName] = fav;

    let el = this.serviceList.find('[value="' + serviceName + '"]');
    if (!el.length) {
      return;
    }

    if (fav) {
      el.find('.favorite').addClass('favorited');
    } else {
      el.find('.favorite').removeClass('favorited');
    }
    el.attr('data-fav', fav ? 1 : 0);

    const elIdx = parseInt(el.attr('data-index'));

    let prev = fav ? null : this.serviceList.find('[data-fav="1"]').last();
    const others = this.serviceList.find('[data-fav="' + (fav ? 1 : 0) + '"]');
    for (var i = 0; i < others.length; i++) {
      const idx = parseInt($(others[i]).attr("data-index"));
      if (idx < elIdx) {
        prev = $(others[i]);
      } else if (idx > elIdx) {
        break;
      }
    };

    if (!prev || !prev.length) {
      this.serviceList.prepend(el);
    } else {
      prev.after(el);
    }

    // if favorited, scroll to element new position
    if (fav) {
      const container = $('#service-wrapper');
      const top = el.position().top;
      const scroll = container.scrollTop();
      container.scrollTop(scroll + el.offset().top - container.offset().top);
    }

    this.saveFavorites();
  }
}

$( window ).resize(resizeAll);
resizeAll();
