class ConsulNodesManager extends ConsulUIManager {
    constructor(resourceURL) {
        super(resourceURL);
        this.mainSelector = new NodeMainSelector(
            $("#instances-list"),
            $("#instance-filter"),
            $("#instance-counter"),
            $("#max-display-selector"),
            "node_filter",
            "node_status_filter"
        );
        this.fetchResource();
    }

    async initResource(data) {
        this.mainSelector.initSelector(data["nodes"]);
    }

    async clean() {
        this.mainSelector.initSelector({});
    }
}

class NodeMainSelector extends MainSelector {
    constructor(listElement, filterElement, counterElement, maxDisplayed, URLLabelFilter, URLLabelStatus) {
        super(listElement, filterElement, counterElement, maxDisplayed, URLLabelFilter, URLLabelStatus);
        this.passingStatusButtonElement = $("#service-status-passing");
        this.warningStatusButtonElement = $("#service-status-warning");
        this.criticalStatusButtonElement = $("#service-status-critical");
        this.totalStatusButtonElement = $("#service-status-total");
        this.initStatusButtons();
    }

    initStatusButtons() {
        var obj = this;
        this.passingStatusButtonElement.get(0).addEventListener("click", function () {
            obj.onClickFilter(this, "passing");
        });
        this.warningStatusButtonElement.get(0).addEventListener("click", function () {
            obj.onClickFilter(this, "warning");
        });
        this.criticalStatusButtonElement.get(0).addEventListener("click", function () {
            obj.onClickFilter(this, "critical");
        });
        this.totalStatusButtonElement.get(0).addEventListener("click", function () {
            obj.onClickFilter(this, null);
        });
    }

    elementGenerator(node) {
        var element = document.createElement('div');
        element.setAttribute('class', 'list-group-item');

        var sidebar = document.createElement('div');
        sidebar.setAttribute('class', 'status-sidebar');

        var state = getGeneralNodeStatus(node['Service']);
        switch (state)  {
        case 'passing':
            sidebar.classList.add('bg-success');
            break;
        case 'warning':
            sidebar.classList.add('bg-warning');
            break;
        case 'critical':
            sidebar.classList.add('bg-danger');
            break;
        }

        var content = document.createElement('div');
        content.setAttribute('class', 'instance-content');
        var contentHead = document.createElement('div');
        contentHead.setAttribute('class', 'instance-content-header');
        contentHead.appendChild(nodeNameGenator(node['Node']['Name'], node['Node']['Address']));
        contentHead.appendChild(nodeAddressGenator(node['Node']['Address']));
        contentHead.appendChild(nodeMetaGenerator(node['Node']['Meta']));
        content.appendChild(contentHead);
        var distances = document.createElement('div');
        var distancesRefresh = document.createElement("button");
        distancesRefresh.appendChild(document.createTextNode("Show/Hide Node Latency"));
        distancesRefresh.setAttribute("class", "distancesButton");
        distances.appendChild(distancesRefresh);
        var distancesContent = document.createElement("div");
        distances.appendChild(distancesContent);

        var distancesContentToUpdate = distancesContent;
        var obj = this
        distancesRefresh.addEventListener("click", function () {
            if (distancesContentToUpdate.children.length == 0) {
                var x = obj.compute_all_distances(node['Node']['Name']);
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
        content.appendChild(distances);
        var nodesChecks = document.createElement('div');
        nodesChecks.setAttribute('class', 'nodes-checks');
        nodesChecks.appendChild(checksStatusGenerator(node, node['Node']['Name']));
        content.appendChild(nodesChecks);

        content.appendChild(servicesGenerator(node['Service'], node));
        content.appendChild(tagsGenerator(getTagsNode(node)));

        sidebar.setAttribute('status', state);
        element.appendChild(sidebar)
        element.appendChild(content)
        return element
    }

    updateStatusCounters() {
        updateStatusItem(this.selectorStatus);
    }

    getStatus(node) {
        return getGeneralNodeStatus(node.Service)
    }

    matchElement(node, filter) {
        if (
            this.statusFilter != null &&
            this.getStatus(node) != this.statusFilter
        ) {
            return false;
        }

        if (node.Node.Name.match(filter)) {
            return true;
        }

        if (node.Node.Address.match(filter)) {
            return true;
        }

        var tags = getTagsNode(node)
        for (var i in tags) {
            if (tags[i].match(filter)) {
                return true;
            }
        }

        for (var key in node.Node.Meta) {
            if ((key + ":" + node.Node.Meta[key]).match(filter)) {
                return true;
            }
        }

        return false;
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

    compute_all_distances(node) {
        const asc = function (arr) {
                return arr.sort((a, b) => a - b);
            }
            // sample standard deviation
        const std = function (arr) {
            const mu = mean(arr);
            const diffArr = arr.map(a => (a - mu) ** 2);
            return Math.sqrt(sum(diffArr) / (arr.length - 1));
        };

        const quantile = function (sorted, q) {
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
        var myCoords = this.data[node]['Coord']
        if (myCoords == null) {
            console.log("Coords are not defined for ", node)
            return null;
        } else {
            for (var key in this.data) {
                var instance = this.data[key];
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

}

$(window).resize(resizeInstances);
resizeInstances();
