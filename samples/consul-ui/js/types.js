class ConsulUIManager {
    constructor(resourceURL) {
        this.resourceURL = resourceURL;
    }

    async fetchResource() {
        const response = await fetch(this.resourceURL);
        const result = await response.json();
        this.data = result;
        await this.initResource(result);
    }

    async initResource(data) {}
}

class SideSelector {
    constructor(
        filterElement,
        listElement,
        counterElement,
        URLLabelFilter,
        URLLabelSelected,
        activateFavorite
    ) {
        this.filterElement = filterElement;
        this.listElement = listElement;
        this.counterElement = counterElement;
        this.elements = {}
        this.filterElement.keyup(debounce(this.updateFilter.bind(this), 250));

        this.URLLabelFilter = URLLabelFilter;
        this.URLLabelSelected = URLLabelSelected;

        this.selectedItem = new URL(location.href).searchParams.get(
            URLLabelSelected
        );
        this.filterValue = new URL(location.href).searchParams.get(URLLabelFilter);
        if (this.filterValue == null) {
            this.filterValue = "";
        }
        this.filterElement.val(this.filterValue);
        this.activateFavorite = activateFavorite;
        if (this.activateFavorite) {
            this.favorites = new Favorites("favorite_services");
        }
        this.showProxies = false;
    }

    prepareData() {
        for (var key in this.data) {
            this.elements[key] = this.elementGenerator(key, this.data[key]);
        }
    }

    updateFilter() {
        this.filterValue = this.filterElement.val();
        updateURL(this.URLLabelFilter, this.filterValue);
        this.refreshList();
    }

    refreshList() {
        this.listElement.html("");
        try {
            var filter = new RegExp(this.filterValue);
        } catch (e) {
            var safeReg = this.filterValue.replace(/[-[\]{}()*+?.,\\^$|]/g, "\\$&");
            console.log(
                "Failed to compile regexp for '" +
                this.filterValue +
                "', using strict lookup due to: " +
                e
            );
            var filter = new RegExp(safeReg);
        }
        var selectItem = null;
        var selectElement = null;
        var elementTotal = 0;

        if (this.activateFavorite) {
            var favList = this.favorites.getAsArray();
            var favDict = this.favorites.favorites;
            for (var i in favList) {
                if (favList[i] in this.data) {
                    if (this.matchElement(favList[i], this.data[favList[i]], filter)) {
                        if (selectItem == null || this.selectedItem == favList[i]) {
                            selectItem = favList[i];
                            selectElement = this.elements[favList[i]];
                        }
                        elementTotal++;
                        this.listElement.append(this.elements[favList[i]]);
                    }
                }
            }
        } else {
            var favDict = {};
        }

        for (var key in this.data) {
            if (!(key in favDict) && this.matchElement(key, this.data[key], filter)) {
                if (selectItem == null || this.selectedItem == key) {
                    selectItem = key;
                    selectElement = this.elements[key];
                }
                this.listElement.append(this.elements[key]);
                elementTotal++;
            }
        }
        this.elementTotal = elementTotal;
        this.counterElement.html(this.elementTotal);
        selectElement.scrollIntoView();
        this.selectItem(selectElement, selectItem);
    }

    onClickElement(source, selected) {
        this.selectItem(source, selected);
    }

    selectItem(element, item) {
        if (this.selectedElem != null) {
            this.selectedElem.classList.remove("active");
        }
        this.selectedElem = element;
        this.selectedElem.classList.add("active");

        this.selectedItem = item;

        updateURL(this.URLLabelSelected, item);
    }
}

class MainSelector {
    constructor(listElement, filterElement, counterElement, maxDisplayElement, URLLabelFilter, URLLabelStatus) {
        this.listElement = listElement;
        this.filterElement = filterElement;
        this.filterElement.keyup(debounce(this.updateFilter.bind(this), 250));
        this.selectorStatus = {}
        this.counterElement = counterElement;
        this.maxDisplayElement = maxDisplayElement;
        this.maxDisplayElement.get(0).addEventListener("change", this.maxDisplaySelection.bind(this));
        this.URLLabelFilter = URLLabelFilter
        this.URLLabelStatus = URLLabelStatus

        this.filterValue = new URL(location.href).searchParams.get(URLLabelFilter);
        if (this.filterValue == null) {
            this.filterValue = "";
        }
        this.filterElement.val(this.filterValue)

        this.statusFilter = new URL(location.href).searchParams.get(URLLabelStatus);
        updateFilterDisplay(this.statusFilter);
        console.log(this.statusFilter)

        this.maxDisplayed = this.maxDisplayElement.val();
    }

    initSelector(data) {
        this.data = data;
        for (var key in this.data) {
            this.data[key]["element"] = this.elementGenerator(this.data[key]);
        }
        this.refreshList();
    }

    maxDisplaySelection() {
        this.maxDisplayed = this.maxDisplayElement.val();
        this.refreshList();
    }

    refreshList() {
        this.listElement.html("");
        try {
            var filter = new RegExp(this.filterValue);
        } catch (e) {
            var safeReg = this.filterValue.replace(/[-[\]{}()*+?.,\\^$|]/g, "\\$&");
            console.log(
                "Failed to compile regexp for '" +
                this.filterValue +
                "', using strict lookup due to: " +
                e
            );
            var filter = new RegExp(safeReg);
        }

        this.selectorStatus = {}
        var displayedCounter = 0
        for (var key in this.data) {
            if (this.matchElement(this.data[key], filter)) {
                if (this.maxDisplayed == "all" ||  displayedCounter < this.maxDisplayed) {
                    this.listElement.append(this.data[key]["element"]);
                    displayedCounter++
                }

                var state = this.getStatus(this.data[key]);
                this.selectorStatus[state] = (this.selectorStatus[state] || 0) + 1;
                this.selectorStatus['total'] = (this.selectorStatus['total'] || 0) + 1;
            }
        }
        this.counterElement.html(displayedCounter);
        this.updateStatusCounters();
    }

    onClickFilter(source, status) {
        if (this.statusFilter == status) {
            this.statusFilter = null;
        } else {
            this.statusFilter = status;
        }

        updateURL(this.URLLabelStatus, this.statusFilter);
        updateFilterDisplay(this.statusFilter);
        this.refreshList();
    }

    updateFilter() {
        console.log(this.filterValue)
        this.filterValue = this.filterElement.val();
        updateURL(this.URLLabelFilter, this.filterValue);
        this.refreshList();
    }
}

class CodeDisplayer {
    constructor(codeElement, titleElement) {
        this.codeElement = codeElement
        this.titleElement = titleElement
    }

    displayData(key, code) {
        this.titleElement.html(key);
        this.codeElement.text(code);
        this.codeElement.removeClass();

        $('pre code').each(function(i, block) {
            hljs.highlightBlock(block);
        });
        resizeWrapper('data-wrapper', 'kv-data');
    }
}

class DisplayFlag {
    constructor(element, callback) {
        this.state = element.checked;
        this.callback = callback;
        this.element = element;

        var obj = this;
        element.addEventListener("click", function() {
            obj.onClickElement();
        });
    }

    onClickElement() {
        this.state = this.element.checked;
        this.callback();
    }
}

class Favorites {
    constructor(favoriteKey) {
        this.key = favoriteKey;
        const all = (localStorage.getItem(this.key) || "")
            .split(",")
            .filter(e => e != "");
        this.favorites = {};
        for (var i in all) {
            this.favorites[all[i]] = true;
        }
    }

    saveFavorites() {
        let fav = [];
        for (var i in this.favorites) {
            if (!this.favorites[i]) {
                continue;
            }
            fav.push(i);
        }
        localStorage.setItem(this.key, fav.join());
    }

    getAsArray() {
        return Object.keys(this.favorites);
    }

    buildButton(serviceName) {
        const btn = document.createElement("button");
        btn.className = "favorite";
        btn.setAttribute("title", "Add/Remove from favorites");

        if (this.favorites[serviceName]) {
            btn.className += " favorited";
        }

        var obj = this;
        btn.addEventListener("click", function() {
            obj.toggleFav(this, serviceName);
        });

        return btn;
    }

    toggleFav(source, serviceName) {
        if (serviceName in this.favorites) {
            delete this.favorites[serviceName];
            source.classList.remove("favorited");
        } else {
            this.favorites[serviceName] = true;
            source.classList.add("favorited");
        }
        this.saveFavorites();
    }
}