class ConsulServiceManager extends ConsulUIManager {
    constructor(resourceURL) {
        super(resourceURL);
        var flags = {};
        this.mainSelector = new ServiceMainSelector(
            $("#service-title"),
            $("#instances-list"),
            $("#instance-filter"),
            $("#instance-counter"),
            $("#max-display-selector"),
            "node_filter",
            "node_status_filter"
        );
        this.sideSelector = new ServiceSideSelector(
            this.mainSelector,
            flags,
            $("#service-filter"),
            $("#service-list"),
            $("#service-counter"),
            "filter",
            "service"
        );
        var obj = this;
        flags["showTags"] = new DisplayFlag(
            $("#showTagsInList").get(0),
            function () {
                obj.sideSelector.prepareData();
                obj.sideSelector.refreshList();
            }
        );
        flags["showConnectProxies"] = new DisplayFlag(
            $("#showProxiesInList").get(0),
            function () {
                obj.sideSelector.refreshList();
            }
        );
        this.fetchResource();
    }

    async initResource(data) {
        this.mainSelector.nodes = data["nodes"];
        this.sideSelector.data = data["services"];
        this.sideSelector.prepareData();
        this.sideSelector.refreshList();
    }
}

class ServiceSideSelector extends SideSelector {
    constructor(
        mainSelector,
        flags,
        filterElement,
        listElement,
        counterElement,
        URLLabelFilter,
        URLLabelSelected
    ) {
        super(
            filterElement,
            listElement,
            counterElement,
            URLLabelFilter,
            URLLabelSelected,
            true
        );
        this.mainSelector = mainSelector;
        this.flags = flags;
    }

    matchElement(serviceName, service, filter) {
        if (
            service["kind"] != undefined &&
            !this.flags["showConnectProxies"].state
        ) {
            return false;
        }

        if (service.name.match(filter)) {
            return true;
        }

        for (var i in service.tags) {
            if (service.tags[i].match(filter)) {
                return true;
            }
        }

        for (var status in service.status) {
            if (status.match(filter)) {
                return true;
            }
        }

        return false;
    }

    elementGenerator(serviceName, service) {
        var element = document.createElement("li");
        var CSSClass = "service-list-item list-group-item list-group-item-action";

        var obj = this;
        element.addEventListener("focus", function () {
            obj.onClickElement(this, serviceName);
        });
        element.addEventListener("click", function () {
            obj.onClickElement(this, serviceName);
        });

        element.setAttribute("value", serviceName);

        element.appendChild(this.generateStatuses(service));

        if (!!service["kind"]) {
            var kind = document.createElement("div");
            kind.setAttribute("class", "kind float-right");
            kind.appendChild(createBadge("badge-info kind", service["kind"]));
            element.appendChild(kind);
            CSSClass += " kind-" + service["kind"];
        }
        element.setAttribute("class", CSSClass);

        var serviceNameItem = document.createElement("div");
        serviceNameItem.setAttribute("class", "service-name");
        serviceNameItem.appendChild(document.createTextNode(serviceName));
        element.appendChild(serviceNameItem);

        if (this.flags["showTags"].state) {
            element.appendChild(this.generateServiceTags(service));
        }

        return element;
    }

    generateStatuses(service) {
        var serviceStatus = buildServiceStatus(service);
        var statuses = document.createElement("div");
        statuses.setAttribute("class", "statuses float-right");

        if (!!serviceStatus["passing"]) {
            statuses.appendChild(
                createBadge("badge-success passing", serviceStatus["passing"])
            );
        }

        if (!!serviceStatus["warning"]) {
            statuses.appendChild(
                createBadge("badge-warning warning", serviceStatus["warning"])
            );
        }

        if (!!serviceStatus["critical"]) {
            statuses.appendChild(
                createBadge("badge-danger critical", serviceStatus["critical"])
            );
        }

        statuses.appendChild(
            createBadge("badge-dark", serviceStatus["total"] || 0)
        );

        if (this.activateFavorite) {
            statuses.append(this.favorites.buildButton(service.name));
        }

        return statuses;
    }

    generateServiceTags(service) {
        var serviceTagsItem = document.createElement("div");
        serviceTagsItem.setAttribute("class", "service-tags");

        for (var i = 0; i < service.tags.length; i++) {
            serviceTagsItem.appendChild(
                createBadge(
                    "float-right badge-" + (i % 2 ? "secondary" : "info"),
                    service.tags[i]
                )
            );
        }
        return serviceTagsItem;
    }

    selectItem(element, service) {
        super.selectItem(element, service);
        this.mainSelector.initSelector(this.data[service]);
    }
}

class ServiceMainSelector extends MainSelector {
    constructor(
        titleElement,
        listElement,
        filterElement,
        counterElement,
        maxDisplayed,
        URLLabelFilter,
        URLLabelStatus
    ) {
        super(listElement, filterElement, counterElement, maxDisplayed, URLLabelFilter, URLLabelStatus);
        this.titleElement = titleElement;
        this.passingStatusBarElement = $("#service-progress-passing");
        this.warningStatusBarElement = $("#service-progress-warning");
        this.criticalStatusBarElement = $("#service-progress-critical");
        this.passingStatusButtonElement = $("#service-status-passing");
        this.warningStatusButtonElement = $("#service-status-warning");
        this.criticalStatusButtonElement = $("#service-status-critical");
        this.totalStatusButtonElement = $("#service-status-total");
        this.initStatusButtons();
        this.initStatusBar();
    }

    initStatusButtons() {
        var obj = this;
        this.passingStatusButtonElement
            .get(0)
            .addEventListener("click", function () {
                obj.onClickFilter(this, "passing");
            });
        this.warningStatusButtonElement
            .get(0)
            .addEventListener("click", function () {
                obj.onClickFilter(this, "warning");
            });
        this.criticalStatusButtonElement
            .get(0)
            .addEventListener("click", function () {
                obj.onClickFilter(this, "critical");
            });
        this.totalStatusButtonElement.get(0).addEventListener("click", function () {
            obj.onClickFilter(this, null);
        });
    }

    initStatusBar() {
        var obj = this;
        this.passingStatusBarElement.get(0).addEventListener("click", function () {
            obj.onClickFilter(this, "passing");
        });
        this.warningStatusBarElement.get(0).addEventListener("click", function () {
            obj.onClickFilter(this, "warning");
        });
        this.criticalStatusBarElement.get(0).addEventListener("click", function () {
            obj.onClickFilter(this, "critical");
        });
    }

    initSelector(service) {
        super.initSelector(service.instances);
        this.generateTitle(service.name);
    }

    updateStatusCounters() {
        updateStatusItem(this.selectorStatus);
        this.passingStatusBarElement.css(
            "width",
            ((this.selectorStatus["passing"] || 0) / this.selectorStatus["total"]) *
            100 +
            "%"
        );
        this.passingStatusBarElement.html(
            "passing (" + (this.selectorStatus["passing"] || 0) + ")"
        );
        this.warningStatusBarElement.css(
            "width",
            ((this.selectorStatus["warning"] || 0) / this.selectorStatus["total"]) *
            100 +
            "%"
        );
        this.warningStatusBarElement.html(
            "warning (" + (this.selectorStatus["warning"] || 0) + ")"
        );
        this.criticalStatusBarElement.css(
            "width",
            ((this.selectorStatus["critical"] || 0) / this.selectorStatus["total"]) *
            100 +
            "%"
        );
        this.criticalStatusBarElement.html(
            "critical (" + (this.selectorStatus["critical"] || 0) + ")"
        );
    }

    generateTitle(serviceName) {
        var titleText =
            serviceName +
            ' <a href="consul-timeline-ui.html?service=' +
            serviceName +
            '">timeline</a>';
        this.titleElement.html(titleText);
        resizeAll();
    }

    elementGenerator(instance) {
        var element = document.createElement("div");
        element.setAttribute("class", "list-group-item service-instance");
        var state = nodeState(instance.checks);
        element.appendChild(weightsGenerator(instance.weights, state));
        element.appendChild(serviceTitleGenerator(instance));
        var node_info = this.nodes[instance.name];
        if (node_info != null) {
            node_info = node_info.meta;
            element.appendChild(nodeMetaGenerator(node_info));
            element.appendChild(document.createElement("hr"));
        }
        if (instance.tags && instance.tags.length > 0) {
            element.appendChild(tagsGenerator(instance.tags));
            element.appendChild(document.createElement("hr"));
        }
        element.appendChild(serviceMetaGenerator(instance.sMeta));
        element.appendChild(connectGenerator(instance));
        element.appendChild(checksStatusGenerator(instance, instance.name));
        element.setAttribute("status", state);

        return element;
    }

    getStatus(instance) {
        return nodeState(instance["checks"]);
    }

    matchElement(instance, filter) {
        if (
            this.statusFilter != null &&
            nodeState(instance["checks"]) != this.statusFilter
        ) {
            return false;
        }

        if (instance.name.match(filter)) {
            return true;
        }

        if (instance.addr.match(filter)) {
            return true;
        }

        for (var i in instance.tags) {
            if (instance.tags[i].match(filter)) {
                return true;
            }
        }

        for (var key in instance.sMeta) {
            if (key.match(filter) || instance.sMeta[key].match(filter)) {
                return true;
            }
        }

        var node = this.nodes[instance.name];
        for (var key in node.meta) {
            if ((key + ":" + node.meta[key]).match(filter)) {
                return true;
            }
        }

        return false;
    }
}

$(window).resize(resizeAll);
resizeAll();