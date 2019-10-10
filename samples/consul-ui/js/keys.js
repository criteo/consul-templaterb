class ConsulKeysManager extends ConsulUIManager {
    constructor(resourceURL) {
        super(resourceURL);
        this.codeDisplayer = new CodeDisplayer(
            $("#kv-data"),
            $("#kv-title"),
        )
        this.sideSelector = new KeySideSelector(
            this.codeDisplayer,
            $("#keys-filter"),
            $("#keys-list"),
            $("#keys-counter"),
            "filter",
            "key"
        );
        this.fetchResource();
    }

    async initResource(data) {
        this.sideSelector.data = data["kv"];
        this.sideSelector.prepareData();
        this.sideSelector.refreshList();
    }
}

class KeySideSelector extends SideSelector {
    constructor(
        codeDisplayer,
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
            false
        );
        this.codeDisplayer = codeDisplayer
    }

    matchElement(key, keyData, filter) {
        return key.match(filter);
    }

    elementGenerator(key, data) {
        var element = document.createElement("li");

        var CSSClass = "service-list-item list-group-item list-group-item-action";

        var obj = this;
        element.addEventListener("focus", function () {
            obj.onClickElement(this, key);
        });
        element.addEventListener("click", function () {
            obj.onClickElement(this, key);
        });

        element.setAttribute("value", key);

        element.setAttribute("class", CSSClass);

        var nameItem = document.createElement("div");
        nameItem.setAttribute("class", "service-name");
        nameItem.appendChild(document.createTextNode(key));
        element.appendChild(nameItem);

        return element;
    }

    selectItem(element, key) {
        super.selectItem(element, key);
        if (this.data[key] != null) {
            var dataToDisplay = atob(this.data[key]);
        } else {
            var dataToDisplay = 'NO DATA';
        }
        this.codeDisplayer.displayData(key, dataToDisplay);
    }
}


$(window).resize(resizeData);
resizeData();