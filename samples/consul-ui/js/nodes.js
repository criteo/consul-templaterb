class ConsulNodes {
  constructor(ressourceURL, refresh) {
    this.ressourceURL = ressourceURL;
    this.fetchRessource();
    this.instanceFilter = $("#instance-filter");
    var filter = new URL(location.href).searchParams.get('filter');
    if (filter!=null && filter!='') {
      this.instanceFilter.val(filter);
    };
    this.instanceFilter.keyup(debounce(this.filterInstances, 400));
    this.refresh = parseInt(refresh);
    this.filterStatus = null;
    this.maxDisplayed = 100;
    this.displayedCount = 0;
    this.servicesStatus = {};
    window.setTimeout(function(){
      if (filter!=null && filter!='') {
        consulNodes.instanceFilter.val(filter);
        console.log(this.instanceFilter.value)
        consulNodes.filterInstances();
      }
    }, 100);
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

  updateURL() {
    var newUrl = new URL(location.href);
    if (consulNodes.instanceFilter.val()!='') {
      newUrl.searchParams.set('filter', consulNodes.instanceFilter.val());
    } else {
      newUrl.searchParams.delete('filter')
    }
    window.history.pushState({},"",newUrl);
  }

  filterInstances() {
    updateFilterDisplay(consulNodes.filterStatus);
    consulNodes.updateURL();
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

  // taken from https://www.consul.io/docs/internals/coordinates.html#working-with-coordinates
  compute_dist(a, b) {
    var sumsq = 0.0
    for (var i = 0; i < a.Vec.length; i++) {
        var diff = a.Vec[i] - b.Vec[i]
        sumsq += diff * diff
    }
    var rtt = Math.sqrt(sumsq) + a.Height + b.Height

    // Apply the adjustment components, guarding against negatives.
    var adjusted = rtt + a.Adjustment + b.Adjustment
    if (adjusted > 0.0) {
        rtt = adjusted
    }

    // Go's times are natively nanoseconds, so we convert from seconds.
    const secondsToNanoseconds = 1.0e9
    return rtt
  }

  compute_all_distances(instances, node) {
    const asc = function(arr) { return arr.sort((a, b) => a - b); }
    // sample standard deviation
    const std = function (arr) {
      const mu = mean(arr);
      const diffArr = arr.map(a => (a - mu) ** 2);
      return Math.sqrt(sum(diffArr) / (arr.length - 1));
    };

    const quantile = function(sorted, q) {
      //const sorted = asc(arr);
      const pos = ((sorted.length) - 1) * q;
      //console.log("pos", pos, "for", q);
      const base = Math.floor(pos);
      const rest = pos - base;
      if ((sorted[base + 1] !== undefined)) {
          return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
      } else {
          return sorted[base];
      }
    };

    var sum = 0;
    var count = 0;
    var ret = {
      min: 3600,
      min_node: null,
      max: 0,
      max_node: null,
    };
    var all_values = [];
    var myCoords = instances[node]['Coord']
    if (myCoords == null) {
      console.log("Coords are not defined for ", node)
      return null;
    } else {
      for (var key in instances) {
        var instance = instances[key];
        if (key != node && instance != null && instance['Coord'] != null) {
          count++
          var coord = instance['Coord'];
          if (coord != null) {
            const rtt = this.compute_dist(myCoords, coord);
            all_values.push(rtt);
            if (rtt < ret.min) {
              ret.min = rtt;
              ret.min_node = key
            }
            if (rtt > ret.max) {
              ret.max = rtt;
              ret.max_node = key;
            }
            sum += rtt;
          }
        }
      }
    }
    all_values = all_values.sort();
    ret.avg = sum / count;
    ret.q50 = quantile(all_values, .50);
    ret.q90 = quantile(all_values, .90);
    ret.q99 = quantile(all_values, .99);
    ret.q999 = quantile(all_values, .999);
    ret.q9999 = quantile(all_values, .9999);
    return ret;
  }

  displayInstances(instances) {
    $("#instances-list").html("");

    // var serviceStatus = buildServiceStatus(service);
    this.displayedCount = 0;
    var nodesInfo = this;
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
      contentHead.appendChild(nodeMetaGenerator(instance['Node']['Meta']));
      content.appendChild(contentHead);
      var distances = document.createElement('div');
      var distancesRefresh = document.createElement("button");
      distancesRefresh.appendChild(document.createTextNode("Show/Hide Node Latency"));
      distancesRefresh.setAttribute("class", "distancesButton");
      distances.appendChild(distancesRefresh);
      var distancesContent = document.createElement("div");
      distances.appendChild(distancesContent);
      (function() {
        var nodeName = instance['Node']['Name'];
        var distancesContentToUpdate = distancesContent;
        var buttonToHide = $(distancesRefresh);
        $(distancesRefresh).click(function(){
          if (distancesContentToUpdate.children.length == 0){
            var x = nodesInfo.compute_all_distances(instances, nodeName);
            var dl = document.createElement(dl);
            dl.className = 'row';
            for (var i in x) {
              var dt = document.createElement("dt");
              dt.appendChild(document.createTextNode(i));
              dt.className = 'col-sm-4';
              dl.appendChild(dt);
              var dd = document.createElement("dd");
              dd.appendChild(document.createTextNode(x[i]));
              dd.className = 'col-sm-8';
              dl.appendChild(dd);
            }
            distancesContentToUpdate.appendChild(dl);
          } else {
            distancesContentToUpdate.innerHTML = '';
          }
        });
      })();
      content.appendChild(distances);
      //distances.appendChild()
      var nodesChecks = document.createElement('div');
      nodesChecks.setAttribute('class','nodes-checks');
      nodesChecks.appendChild(checksStatusGenerator(instance, instance['Node']['Name']));
      content.appendChild(nodesChecks);

      content.appendChild(servicesGenerator(instance['Service']));
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
