class ConsulNodes {
  constructor(ressourceURL, refresh) {
    this.ressourceURL = ressourceURL;
    this.fetchRessource();
    this.instanceFilter = $("#instance-filter");
    this.instanceFilter.keyup(function (e) {
      clearTimeout(consulNodes.timeout);
      consulNodes.timeout = setTimeout(consulNodes.filterInstances, 400);
    });
    this.refresh = parseInt(refresh);
    this.filterStatus = null;
    this.maxDisplayed = 100;
    this.displayedCount = 0;
    this.servicesStatus = {};
  }

  fetchRessource() {
    $.ajax({url: this.ressourceURL, cache: false, dataType: "json", sourceObject: this, success: function(result){
      consulNodes.initRessource(result);
    }});
  }

  initRessource(data) {
    this.data = data;
    this.displayInstances(this.data['nodes']);
    console.log('Data generated at: ' + data['generated_at']);
  }

  onClickFilter(source) {
    var status = $(source).attr('status');
    this.filterStatus = (this.filterStatus == status) ? null : status;
    this.filterInstances();
  }

  filterInstances() {
    updateFilterDisplay(consulNodes.filterStatus);
    consulNodes.displayedCount = 0;
    consulNodes.servicesStatus = {};
    var filter = new RegExp(consulNodes.instanceFilter.val());
    $('#instances-list').children('div').each(function() {
      var status = $(this).attr('status');
      var limitNotReached = (consulNodes.displayedCount < consulNodes.maxDisplayed);

      if(nodeMatcher(this, filter)) {
        if (consulNodes.filterStatus == null || consulNodes.filterStatus == status) {
          if (limitNotReached) {
            $(this).removeClass('d-none');
            $(this).addClass('d-flex');
            consulNodes.displayedCount++;
          }
          var state = this.getAttribute('status');
          consulNodes.servicesStatus[state] = (consulNodes.servicesStatus[state] || 0) + 1;
          consulNodes.servicesStatus['total'] = (consulNodes.servicesStatus['total'] || 0) + 1;
          updateStatusItem(consulNodes.servicesStatus);
        } else {
          $(this).removeClass('d-flex');
          $(this).addClass('d-none');
        }
      } else {
        $(this).removeClass('d-flex');
        $(this).addClass('d-none');
      }
    })
  }

  displayInstances(instances) {
    $("#instances-list").html("");

    // var serviceStatus = buildServiceStatus(service);
    this.displayedCount = 0;

    for (var key in instances) {
      var instance = instances[key];

      var instanceHtml = document.createElement('div');
      if(this.displayedCount > this.maxDisplayed) {
        instanceHtml.setAttribute('class','list-group-item d-none');
      } else {
        instanceHtml.setAttribute('class','list-group-item');
      }

      var sidebar = document.createElement('div');
      sidebar.setAttribute('class','status-sidebar');
      var state = getGeneralNodeStatus(instance['Service']);
      switch(state) {
          case 'passing': sidebar.classList.add('bg-success'); break;
          case 'warning': sidebar.classList.add('bg-warning'); break;
          case 'critical': sidebar.classList.add('bg-danger'); break;
      }
      this.servicesStatus[state] = (this.servicesStatus[state] || 0) + 1;
      this.servicesStatus['total'] = (this.servicesStatus['total'] || 0) + 1;

      var content = document.createElement('div');
      content.setAttribute('class','instance-content');
      var contentHead = document.createElement('div');
      contentHead.setAttribute('class','instance-content-header');
      contentHead.appendChild(nodeNameGenator(instance['Node']['Name'],instance['Node']['Address']));
      contentHead.appendChild(nodeAddressGenator(instance['Node']['Address']));
      contentHead.appendChild(nodeMetaGenator(instance['Node']['Meta']));
      content.appendChild(contentHead);
      content.appendChild(servicesGenerator(instance['Service'], instance['Node']['Name'], instance['Node']['Address']));
      content.appendChild(tagsGenerator(getTagsNode(instance)));

      instanceHtml.setAttribute('status', state);
      instanceHtml.appendChild(sidebar)
      instanceHtml.appendChild(content)

      $("#instances-list").append(instanceHtml);

      this.displayedCount++;
    }

    resizeInstances();
    $('#instances-list .list-group-item').resize(resizeInstances);
    this.filterInstances();
  }
}

$( window ).resize(resizeInstances);
resizeInstances();
