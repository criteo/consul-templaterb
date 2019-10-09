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
      var obj = this;
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
  
      this.maxDisplayedElements = 500;
    }
  
    prepareData() {
      for (var key in this.data) {
        this.data[key]["element"] = this.elementGenerator(this.data[key]);
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
      var elementDisplayed = 0;
      var elementTotal = 0;
  
      if (this.activateFavorite) {
        var favList = this.favorites.getAsArray();
        var favDict = this.favorites.favorites;
        for (var i in favList) {
          if (favList[i] in this.data) {
            if (this.matchElement(this.data[favList[i]], filter)) {
              if (selectItem == null || this.selectedItem == favList[i]) {
                selectItem = favList[i];
                selectElement = this.data[favList[i]]["element"];
              }
              elementDisplayed++;
              elementTotal++;
              this.listElement.append(this.data[favList[i]]["element"]);
            }
          }
        }
      } else {
        var favDict = {};
      }
  
      for (var key in this.data) {
        if (!(key in favDict) && this.matchElement(this.data[key], filter)) {
          if (selectItem == null || this.selectedItem == key) {
            selectItem = key;
            selectElement = this.data[key]["element"];
            elementDisplayed++;
          }
          if (elementTotal < this.maxDisplayedElements) {
            this.listElement.append(this.data[key]["element"]);
            elementDisplayed++;
          }
          elementTotal++;
        }
      }
      this.elementTotal = elementTotal;
      selectElement.scrollIntoView();
      this.selectItem(selectElement, selectItem);
      this.counterElement.html(this.elementTotal);
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
    constructor(listElement, filterElement) {
      this.listElement = listElement;
      this.filterValue = "";
      this.filterElement = filterElement;
      this.filterElement.keyup(debounce(this.updateFilter.bind(this), 250));
    }
  
    initSelector(data) {
      this.data = data;
      for (var key in this.data) {
        this.data[key]["element"] = this.elementGenerator(this.data[key]);
      }
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
  
      for (var key in this.data) {
        if (this.matchElement(this.data[key], filter)) {
          this.listElement.append(this.data[key]["element"]);
        }
      }
    }
  
    updateFilter() {
      this.filterValue = this.filterElement.val();
      this.refreshList();
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
  