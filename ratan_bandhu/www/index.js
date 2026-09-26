/* =====================================================================
   Ratan Bandhu Fabrics — public website
   Phase 2: ERPNext Item integration

   Product  = ERPNext Item
   Catalog   = ERPNext Item Group
   Supplier  = ERPNext Supplier

   Only Items with:
       publish_on_website = 1
   are displayed on the public website.
   ===================================================================== */

(function () {
  "use strict";


  /* -----------------------------------------------------------------
     CONFIG
     ----------------------------------------------------------------- */

  var CONFIG = {
    waNumber: "910000000000",
    phoneDisplay: "+91 00000 00000",
    phoneDial: "+910000000000",
    email: "sales@example.com",
    company: "Ratan Bandhu Fabrics Pvt Ltd"
  };


  /* -----------------------------------------------------------------
     ERPNext DATA
     ----------------------------------------------------------------- */

  var CATALOGS = [];
  var PRODUCTS = [];


  /* -----------------------------------------------------------------
     LOAD PRODUCTS FROM ERPNext
     ----------------------------------------------------------------- */

  function loadWebsiteProducts() {

    fetch("/api/method/ratan_bandhu.api.get_published_items", {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "Accept": "application/json"
      }
    })

    .then(function (response) {

return response.text().then(function (text) {

  console.log("ERPNext API HTTP status:", response.status);
  console.log("ERPNext API raw response:", text);

  var data;

  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(
      "ERPNext returned non-JSON response: " + text
    );
  }

  if (!response.ok) {

    var message =
      data.exception ||
      data.exc ||
      data.message ||
      "Unknown ERPNext API error";

    throw new Error(
      "API request failed: " +
      response.status +
      " — " +
      message
    );

  }

  return data;

});
    })

    .then(function (response) {

      var items = response.message || [];

      PRODUCTS = items.map(function (item) {

        /*
         * Multiple product images (website_images -> Item Website Image).
         * Backward compatible with a single "image" field too.
         */

        var images = Array.isArray(item.images)
          ? item.images.filter(Boolean)
          : (item.image ? [item.image] : []);

        var mainImage =
          item.image ||
          (images.length ? images[0] : "") ||
          "";

        return {
          id: item.id || item.item_code || "",
          name: item.name || item.item_name || "",
          catalog: item.catalog || item.item_group || "",
          category: item.category || item.item_group || "",
          supplier: item.supplier || item.custom_from_supplier || "",
          stock_uom: item.stock_uom || "",
          rate: Number(item.rate || 0),
          desc: item.desc || item.custom_item_description || "",
          image: mainImage,
          images: images,

          /*
           * Fallback swatch when Item has no image.
           */
          pattern: "plain",
          palette: [
            "#f3f3f3",
            "#b5b5b5",
            "#777777"
          ]
        };

      });


      buildCatalogsFromProducts();

      buildCatalogSection();

      buildFilterSection();

      buildHeroWall();

      applyFilters();

    })

    .catch(function (error) {

      console.error(
        "Ratan Bandhu ERPNext product loading error:",
        error
      );

      PRODUCTS = [];
      CATALOGS = [];

      buildCatalogSection();
      buildFilterSection();
      buildHeroWall();
      applyFilters();

      toast(
        "Unable to load products"
      );

    });

  }


  /* -----------------------------------------------------------------
     BUILD CATALOGS FROM ITEM GROUP
     ----------------------------------------------------------------- */

  function buildCatalogsFromProducts() {

    var catalogMap = {};

    PRODUCTS.forEach(function (product) {

      if (!product.catalog) {
        return;
      }

      if (!catalogMap[product.catalog]) {

        catalogMap[product.catalog] = {

          id: product.catalog,

          name: product.catalog,

          desc:
            "Explore products available in this catalog.",

          pattern: "plain",

          palette: [
            "#f3f3f3",
            "#b5b5b5",
            "#777777"
          ]

        };

      }

    });


    CATALOGS = Object.keys(catalogMap).map(function (key) {

      return catalogMap[key];

    });

  }


  /* -----------------------------------------------------------------
     SWATCH RENDERING
     ----------------------------------------------------------------- */

  function motif(pattern, bg, fg, ac) {

    var s = "";
    var i;


    if (pattern === "stripe") {

      for (i = 0; i < 10; i++) {

        s +=
          '<rect x="' +
          (i * 40) +
          '" y="0" width="14" height="400" fill="' +
          fg +
          '" opacity=".9"/>';

        s +=
          '<rect x="' +
          (i * 40 + 20) +
          '" y="0" width="4" height="400" fill="' +
          ac +
          '" opacity=".7"/>';

      }

    }


    else if (pattern === "check") {

      for (i = 0; i < 9; i++) {

        s +=
          '<rect x="' +
          (i * 48) +
          '" y="0" width="16" height="400" fill="' +
          fg +
          '" opacity=".55"/>';

        s +=
          '<rect x="0" y="' +
          (i * 48) +
          '" width="400" height="16" fill="' +
          fg +
          '" opacity=".55"/>';

        s +=
          '<rect x="' +
          (i * 48 + 26) +
          '" y="0" width="3" height="400" fill="' +
          ac +
          '" opacity=".6"/>';

        s +=
          '<rect x="0" y="' +
          (i * 48 + 26) +
          '" width="400" height="3" fill="' +
          ac +
          '" opacity=".6"/>';

      }

    }


    else if (pattern === "butti") {

      for (i = 0; i < 64; i++) {

        var bx =
          (i % 8) * 50 +
          25 +
          ((Math.floor(i / 8) % 2) * 25);

        var by =
          Math.floor(i / 8) * 50 +
          25;

        s +=
          '<circle cx="' +
          bx +
          '" cy="' +
          by +
          '" r="6" fill="' +
          fg +
          '"/>';

        s +=
          '<circle cx="' +
          bx +
          '" cy="' +
          by +
          '" r="12" fill="none" stroke="' +
          ac +
          '" stroke-width="1.4" opacity=".55"/>';

      }

    }


    else if (pattern === "floral") {

      for (i = 0; i < 25; i++) {

        var fx =
          (i % 5) * 80 +
          40 +
          ((Math.floor(i / 5) % 2) * 40);

        var fy =
          Math.floor(i / 5) * 80 +
          40;

        s +=
          '<g transform="translate(' +
          fx +
          "," +
          fy +
          ') rotate(' +
          (i * 17 % 90) +
          ')">';

        for (var p = 0; p < 6; p++) {

          s +=
            '<ellipse cx="0" cy="-15" rx="7" ry="15" fill="' +
            fg +
            '" opacity=".85" transform="rotate(' +
            (p * 60) +
            ')"/>';

        }

        s +=
          '<circle cx="0" cy="0" r="6" fill="' +
          ac +
          '"/></g>';

      }

    }


    else if (pattern === "chevron") {

      for (i = 0; i < 14; i++) {

        s +=
          '<path d="M0 ' +
          (i * 32) +
          ' L50 ' +
          (i * 32 - 18) +
          ' L100 ' +
          (i * 32) +
          ' L150 ' +
          (i * 32 - 18) +
          ' L200 ' +
          (i * 32) +
          ' L250 ' +
          (i * 32 - 18) +
          ' L300 ' +
          (i * 32) +
          ' L350 ' +
          (i * 32 - 18) +
          ' L400 ' +
          (i * 32) +
          '" fill="none" stroke="' +
          (i % 2 ? ac : fg) +
          '" stroke-width="5" opacity=".8"/>';

      }

    }


    else if (pattern === "dobby") {

      for (i = 0; i < 100; i++) {

        var dx =
          (i % 10) * 40 + 12;

        var dy =
          Math.floor(i / 10) * 40 + 12;

        s +=
          '<rect x="' +
          dx +
          '" y="' +
          dy +
          '" width="16" height="16" rx="3" fill="' +
          fg +
          '" opacity=".45"/>';

        s +=
          '<rect x="' +
          (dx + 20) +
          '" y="' +
          (dy + 20) +
          '" width="8" height="8" rx="2" fill="' +
          ac +
          '" opacity=".4"/>';

      }

    }


    else {

      /*
       * Plain fallback
       */

      s +=
        '<rect x="0" y="0" width="400" height="400" fill="' +
        bg +
        '"/>';

    }


    return s;

  }


  function makeSwatch(pattern, palette, seed) {

    var bg = palette[0];
    var fg = palette[1];
    var ac = palette[2];

    var g = "g" + (seed || 0);

    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">' +

      '<defs>' +

      '<linearGradient id="' +
      g +
      '" x1="0" y1="0" x2="1" y2="1">' +

      '<stop offset="0" stop-color="#ffffff" stop-opacity=".34"/>' +

      '<stop offset=".55" stop-color="#ffffff" stop-opacity="0"/>' +

      '<stop offset="1" stop-color="#000000" stop-opacity=".1"/>' +

      '</linearGradient>' +

      '<pattern id="w' +
      g +
      '" width="6" height="6" patternUnits="userSpaceOnUse">' +

      '<rect width="6" height="6" fill="none"/>' +

      '<path d="M0 0h6M0 3h6" stroke="#000" stroke-width=".5" opacity=".07"/>' +

      '<path d="M0 0v6M3 0v6" stroke="#fff" stroke-width=".5" opacity=".16"/>' +

      '</pattern>' +

      '</defs>' +

      '<rect width="400" height="400" fill="' +
      bg +
      '"/>' +

      motif(pattern, bg, fg, ac) +

      '<rect width="400" height="400" fill="url(#w' +
      g +
      ')"/>' +

      '<rect width="400" height="400" fill="url(#' +
      g +
      ')"/>' +

      '</svg>';

    return 'url("data:image/svg+xml,' +
      encodeURIComponent(svg) +
      '")';

  }


  var swatchCache = {};


  function swatchFor(item, seed) {

    var key =
      item.id +
      "-" +
      seed;

    if (!swatchCache[key]) {

      swatchCache[key] =
        makeSwatch(
          item.pattern,
          item.palette,
          seed
        );

    }

    return swatchCache[key];

  }


  /* -----------------------------------------------------------------
     HELPERS
     ----------------------------------------------------------------- */

  var $ = function (sel, root) {

    return (
      root ||
      document
    ).querySelector(sel);

  };


  var $$ = function (sel, root) {

    return Array.prototype.slice.call(
      (
        root ||
        document
      ).querySelectorAll(sel)
    );

  };


  function money(n) {

    return "₹" +
      Number(n || 0).toLocaleString(
        "en-IN"
      );

  }


  /*
   * Rate display always uses the Stock UOM returned by ERPNext.
   * Never hardcode a unit (no "/m", no "per metre").
   */

  function rateDisplay(p) {

    var uom =
      p && p.stock_uom ?
        String(p.stock_uom).trim() :
        "";

    return money(p ? p.rate : 0) +
      (uom ? " " + uom : "");

  }


  function catalogById(id) {

    for (
      var i = 0;
      i < CATALOGS.length;
      i++
    ) {

      if (
        CATALOGS[i].id === id
      ) {

        return CATALOGS[i];

      }

    }

    return {
      name: id || ""
    };

  }


  function productById(id) {

    for (
      var i = 0;
      i < PRODUCTS.length;
      i++
    ) {

      if (
        PRODUCTS[i].id === id
      ) {

        return PRODUCTS[i];

      }

    }

    return null;

  }


  function countInCatalog(id) {

    return PRODUCTS.filter(
      function (p) {

        return p.catalog === id;

      }
    ).length;

  }


  function waLink(text) {

    return (
      "https://wa.me/" +
      CONFIG.waNumber +
      "?text=" +
      encodeURIComponent(text)
    );

  }


  var toastTimer;


  function toast(msg) {

    var t = $("#toast");

    if (!t) {
      return;
    }

    t.textContent = msg;

    t.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer =
      setTimeout(
        function () {

          t.classList.remove("show");

        },
        2200
      );

  }


  /* -----------------------------------------------------------------
     NAVBAR
     ----------------------------------------------------------------- */

  var nav = $("#nav");
  var navLinks = $("#nav-links");
  var burger = $("#hamburger");


  function closeMenu() {

    if (!navLinks || !burger) {
      return;
    }

    navLinks.classList.remove("open");

    burger.setAttribute(
      "aria-expanded",
      "false"
    );

    burger.setAttribute(
      "aria-label",
      "Open menu"
    );

  }


  if (burger) {

    burger.addEventListener(
      "click",
      function () {

        var open =
          navLinks.classList.toggle(
            "open"
          );

        burger.setAttribute(
          "aria-expanded",
          open ? "true" : "false"
        );

        burger.setAttribute(
          "aria-label",
          open ?
            "Close menu" :
            "Open menu"
        );

      }
    );

  }


  $$("#nav-links a").forEach(
    function (a) {

      a.addEventListener(
        "click",
        closeMenu
      );

    }
  );


  window.addEventListener(
    "scroll",
    function () {

      if (nav) {

        nav.classList.toggle(
          "scrolled",
          window.scrollY > 8
        );

      }

    },
    {
      passive: true
    }
  );


  /* -----------------------------------------------------------------
     SECTION HIGHLIGHT
     ----------------------------------------------------------------- */

  var spySections = [
    "top",
    "products",
    "catalogs",
    "about",
    "contact"
  ];


  if (
    "IntersectionObserver" in window
  ) {

    var spy =
      new IntersectionObserver(
        function (entries) {

          entries.forEach(
            function (e) {

              if (!e.isIntersecting) {
                return;
              }

              $$("[data-nav]").forEach(
                function (a) {

                  a.classList.toggle(
                    "active",
                    a.getAttribute("href") ===
                    "#" + e.target.id
                  );

                }
              );

            }
          );

        },
        {
          rootMargin:
            "-45% 0px -50% 0px"
        }
      );


    spySections.forEach(
      function (id) {

        var el =
          document.getElementById(id);

        if (el) {
          spy.observe(el);
        }

      }
    );

  }


  /* -----------------------------------------------------------------
     SEARCH ICON
     ----------------------------------------------------------------- */

  var navSearch =
    $("#nav-search");


  if (navSearch) {

    navSearch.addEventListener(
      "click",
      function () {

        closeMenu();

        document
          .getElementById("products")
          .scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

        setTimeout(
          function () {

            var search =
              $("#f-search");

            if (search) {
              search.focus();
            }

          },
          500
        );

      }
    );

  }


  /* -----------------------------------------------------------------
     HERO SWATCH WALL
     ----------------------------------------------------------------- */

  function buildHeroWall() {

    var wall =
      $("#swatch-wall");

    if (!wall) {
      return;
    }

    wall.innerHTML = "";

    if (!PRODUCTS.length) {
      return;
    }

    var picks =
      PRODUCTS.slice(0, 6);


    picks.forEach(
      function (p, i) {

        var d =
          document.createElement("div");

        d.className = "tile";


        /*
         * Use real Item image when available.
         */

        if (p.image) {

          d.style.backgroundImage =
            "url('" +
            p.image +
            "')";

        } else {

          d.style.backgroundImage =
            swatchFor(p, i);

        }


        wall.appendChild(d);

      }
    );

  }


  /* -----------------------------------------------------------------
     CATALOG CARDS
     ----------------------------------------------------------------- */

  function buildCatalogSection() {

    var grid =
      $("#catalog-grid");

    var footer =
      $("#footer-catalogs");


    if (!grid) {
      return;
    }


    grid.innerHTML = "";


    if (footer) {

      footer.innerHTML =
        "<h3>Catalogs</h3>";

    }


    CATALOGS.forEach(
      function (c, i) {

        var n =
          countInCatalog(c.id);


        var card =
          document.createElement(
            "article"
          );

        card.className =
          "catalog-card";


        var cover =
          document.createElement(
            "div"
          );

        cover.className =
          "catalog-cover";


        cover.style.backgroundImage =
          makeSwatch(
            c.pattern,
            c.palette,
            90 + i
          );


        cover.setAttribute(
          "data-count",
          n +
          (
            n === 1 ?
              " product" :
              " products"
          )
        );


        var body =
          document.createElement(
            "div"
          );

        body.className =
          "catalog-body";


        body.innerHTML =
          "<h3></h3>" +
          "<p></p>" +
          '<button class="btn btn-ghost btn-sm" type="button">' +
          "View catalog" +
          "</button>";


        $("h3", body).textContent =
          c.name;


        $("p", body).textContent =
          c.desc;


        $("button", body)
          .addEventListener(
            "click",
            function () {

              $("#f-catalog").value =
                c.id;

              $("#f-search").value =
                "";

              applyFilters();

              document
                .getElementById(
                  "products"
                )
                .scrollIntoView({
                  behavior: "smooth",
                  block: "start"
                });

            }
          );


        card.appendChild(cover);

        card.appendChild(body);

        grid.appendChild(card);


        if (footer) {

          var link =
            document.createElement(
              "a"
            );

          link.href =
            "#products";

          link.textContent =
            c.name;


          link.addEventListener(
            "click",
            function () {

              $("#f-catalog").value =
                c.id;

              applyFilters();

            }
          );


          footer.appendChild(link);

        }

      }
    );

  }


  /* -----------------------------------------------------------------
     FILTERS
     ----------------------------------------------------------------- */

  function fillSelect(
    sel,
    values,
    labelFn
  ) {

    if (!sel) {
      return;
    }


    values.forEach(
      function (v) {

        var o =
          document.createElement(
            "option"
          );

        o.value = v;

        o.textContent =
          labelFn ?
            labelFn(v) :
            v;

        sel.appendChild(o);

      }
    );

  }


  function buildFilterSection() {

    var categorySelect =
      $("#f-category");

    var supplierSelect =
      $("#f-supplier");

    var catalogSelect =
      $("#f-catalog");


    if (
      !categorySelect ||
      !supplierSelect ||
      !catalogSelect
    ) {

      return;

    }


    /*
     * Clear old dynamic options.
     */

    categorySelect.innerHTML =
      '<option value="">All categories</option>';

    supplierSelect.innerHTML =
      '<option value="">All suppliers</option>';

    catalogSelect.innerHTML =
      '<option value="">All catalogs</option>';


    var cats = [];
    var sups = [];


    PRODUCTS.forEach(
      function (p) {

        if (
          p.category &&
          cats.indexOf(p.category) < 0
        ) {

          cats.push(p.category);

        }


        if (
          p.supplier &&
          sups.indexOf(p.supplier) < 0
        ) {

          sups.push(p.supplier);

        }

      }
    );


    cats.sort();
    sups.sort();


    fillSelect(
      categorySelect,
      cats
    );


    fillSelect(
      supplierSelect,
      sups
    );


    fillSelect(
      catalogSelect,
      CATALOGS.map(
        function (c) {
          return c.id;
        }
      ),
      function (id) {

        return catalogById(id).name;

      }
    );

  }


  /* -----------------------------------------------------------------
     FILTER STATE
     ----------------------------------------------------------------- */

  var state = {
    q: "",
    category: "",
    catalog: "",
    supplier: ""
  };


  var selected = [];


  function matches(p) {

    if (
      state.category &&
      p.category !== state.category
    ) {

      return false;

    }


    if (
      state.catalog &&
      p.catalog !== state.catalog
    ) {

      return false;

    }


    if (
      state.supplier &&
      p.supplier !== state.supplier
    ) {

      return false;

    }


    if (state.q) {

      var catalogName =
        catalogById(
          p.catalog
        ).name || "";


      var hay =
        (
          p.name +
          " " +
          p.id +
          " " +
          p.category +
          " " +
          p.supplier +
          " " +
          catalogName +
          " " +
          p.desc
        ).toLowerCase();


      var terms =
        state.q
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);


      for (
        var i = 0;
        i < terms.length;
        i++
      ) {

        if (
          hay.indexOf(
            terms[i]
          ) < 0
        ) {

          return false;

        }

      }

    }


    return true;

  }


  function applyFilters() {

    var search =
      $("#f-search");

    var category =
      $("#f-category");

    var catalog =
      $("#f-catalog");

    var supplier =
      $("#f-supplier");


    if (
      !search ||
      !category ||
      !catalog ||
      !supplier
    ) {

      return;

    }


    state.q =
      search.value.trim();

    state.category =
      category.value;

    state.catalog =
      catalog.value;

    state.supplier =
      supplier.value;


    var list =
      PRODUCTS.filter(
        matches
      );


    renderProducts(list);


    var dirty =
      !!(
        state.q ||
        state.category ||
        state.catalog ||
        state.supplier
      );


    var clear =
      $("#f-clear");


    if (clear) {
      clear.hidden = !dirty;
    }


    var count =
      $("#result-count");


    if (count) {

      if (!list.length) {

        count.textContent = "";

      }

      else if (dirty) {

        count.textContent =
          "Showing " +
          list.length +
          " of " +
          PRODUCTS.length +
          " products";

      }

      else {

        count.textContent =
          PRODUCTS.length +
          " products across " +
          CATALOGS.length +
          " catalogs";

      }

    }


    var empty =
      $("#empty");

    var grid =
      $("#product-grid");


    if (empty) {
      empty.hidden =
        list.length > 0;
    }


    if (grid) {
      grid.hidden =
        list.length === 0;
    }

  }


  function clearFilters() {

    $("#f-search").value = "";

    $("#f-category").value = "";

    $("#f-catalog").value = "";

    $("#f-supplier").value = "";

    applyFilters();

  }


  var searchTimer;


  $("#f-search")
    .addEventListener(
      "input",
      function () {

        clearTimeout(
          searchTimer
        );

        searchTimer =
          setTimeout(
            applyFilters,
            160
          );

      }
    );


  [
    "#f-category",
    "#f-catalog",
    "#f-supplier"
  ].forEach(
    function (s) {

      $(s).addEventListener(
        "change",
        applyFilters
      );

    }
  );


  $("#f-clear")
    .addEventListener(
      "click",
      clearFilters
    );


  $("#empty-clear")
    .addEventListener(
      "click",
      clearFilters
    );


  /* -----------------------------------------------------------------
     PRODUCT CARDS
     ----------------------------------------------------------------- */

  function productCard(p, i) {

    var card =
      document.createElement(
        "article"
      );


    card.className =
      "product-card" +
      (
        isSelected(p.id) ?
          " selected" :
          ""
      );


    card.setAttribute(
      "data-id",
      p.id
    );


    var media =
      document.createElement(
        "button"
      );


    media.className =
      "product-media";

    media.type =
      "button";


    /*
     * Real Item image.
     * Fallback to generated swatch.
     */

    if (p.image) {

      media.style.backgroundImage =
        "url('" +
        p.image +
        "')";

    } else {

      media.style.backgroundImage =
        swatchFor(p, i);

    }


    media.setAttribute(
      "aria-label",
      "View details for " +
      p.name
    );


    media.addEventListener(
      "click",
      function () {

        openModal(
          p.id,
          i
        );

      }
    );


    var body =
      document.createElement(
        "div"
      );


    body.className =
      "product-body";


    body.innerHTML =
      '<p class="p-catalog"></p>' +
      "<h3></h3>" +
      '<p class="p-desc"></p>' +
      '<div class="p-meta">' +
      '<span class="p-rate"></span>' +
      '<span class="p-supplier"></span>' +
      "</div>";


    $(".p-catalog", body)
      .textContent =
      (
        catalogById(
          p.catalog
        ).name ||
        p.catalog
      ) +
      (
        p.id ?
          " · " + p.id :
          ""
      );


    $("h3", body)
      .textContent =
      p.name;


    $(".p-desc", body)
      .textContent =
      p.desc;


    /*
     * Rate shows rate + Stock UOM only.
     * Supplier no longer appears inside the rate.
     */

    $(".p-rate", body)
      .textContent =
      rateDisplay(p);


    $(".p-supplier", body)
      .textContent =
      p.supplier ?
        "Supplied by: " + p.supplier :
        "";


    var actions =
      document.createElement(
        "div"
      );


    actions.className =
      "product-actions";


    var selectBtn =
      document.createElement(
        "button"
      );


    selectBtn.className =
      "p-select";

    selectBtn.type =
      "button";


    selectBtn.textContent =
      isSelected(p.id) ?
        "Selected" :
        "Select product";


    selectBtn.addEventListener(
      "click",
      function () {

        toggleSelect(
          p.id
        );

      }
    );


    var waBtn =
      document.createElement(
        "a"
      );


    waBtn.className =
      "btn btn-wa";

    waBtn.rel =
      "noopener";

    waBtn.target =
      "_blank";


    waBtn.setAttribute(
      "aria-label",
      "Ask about " +
      p.name +
      " on WhatsApp"
    );


    waBtn.href =
      waLink(
        productMessage(p)
      );


    waBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
      '<path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.6-6c-.3-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.2.1-.2 0-.4 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3A2.9 2.9 0 0 0 6.7 8a5 5 0 0 0 1.1 2.7 11.4 11.4 0 0 0 4.3 3.8c1.6.6 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .1-1.2c0-.1-.2-.2-.4-.3Z"/>' +
      "</svg>";


    actions.appendChild(
      selectBtn
    );

    actions.appendChild(
      waBtn
    );


    card.appendChild(
      media
    );

    card.appendChild(
      body
    );

    card.appendChild(
      actions
    );


    return card;

  }


  function renderProducts(list) {

    var grid =
      $("#product-grid");


    if (!grid) {
      return;
    }


    grid.innerHTML =
      "";


    var frag =
      document.createDocumentFragment();


    list.forEach(
      function (p, i) {

        frag.appendChild(
          productCard(
            p,
            i
          )
        );

      }
    );


    grid.appendChild(
      frag
    );

  }


  /* -----------------------------------------------------------------
     WHATSAPP MESSAGES
     ----------------------------------------------------------------- */

  function productMessage(p) {

    var uom =
      p.stock_uom ?
        " " + p.stock_uom :
        "";

    return (
      "Hello " +
      CONFIG.company +
      ",\n\n" +

      "I would like details on:\n" +

      p.name +

      (
        p.id ?
          " (" +
          p.id +
          ")" :
          ""
      ) +

      "\n\n" +

      "Catalog: " +

      (
        catalogById(
          p.catalog
        ).name ||
        p.catalog ||
        ""
      ) +

      "\n" +

      (
        p.supplier ?
          "Supplier: " +
          p.supplier +
          "\n" :
          ""
      ) +

      "Rate: " +

      money(p.rate) +

      uom +

      "\n\n" +

      "Please share availability and your best rate."
    );

  }


  function selectionMessage() {

    var lines =
      selected.map(
        function (id, n) {

          var p =
            productById(id);


          if (!p) {
            return "";
          }


          var uom =
            p.stock_uom ?
              " " + p.stock_uom :
              "";


          var supplierPart =
            p.supplier ?
              " (Supplier: " +
              p.supplier +
              ")" :
              "";


          return (
            n + 1 +
            ". " +
            p.name +
            (
              p.id ?
                " (" +
                p.id +
                ")" :
                ""
            ) +
            " — " +
            money(p.rate) +
            uom +
            supplierPart
          );

        }
      );


    return (
      "Hello " +
      CONFIG.company +
      ",\n\n" +

      "I have shortlisted " +
      selected.length +
      " " +

      (
        selected.length === 1 ?
          "product" :
          "products"
      ) +

      " from your website:\n\n" +

      lines.join("\n") +

      "\n\nPlease confirm availability and quantity rates."
    );

  }


  /* -----------------------------------------------------------------
     SELECTION TRAY
     ----------------------------------------------------------------- */

  function isSelected(id) {

    return (
      selected.indexOf(id) > -1
    );

  }


  function toggleSelect(id) {

    var at =
      selected.indexOf(id);


    if (at > -1) {

      selected.splice(
        at,
        1
      );

      toast(
        "Removed from selection"
      );

    }

    else {

      selected.push(
        id
      );

      toast(
        "Added to selection"
      );

    }


    syncSelectionUI();

  }


  function syncSelectionUI() {

    $$(".product-card")
      .forEach(
        function (card) {

          var on =
            isSelected(
              card.getAttribute(
                "data-id"
              )
            );


          card.classList.toggle(
            "selected",
            on
          );


          var btn =
            $(".p-select", card);


          if (btn) {

            btn.textContent =
              on ?
                "Selected" :
                "Select product";

          }

        }
      );


    var open =
      $("#modal");


    if (
      open &&
      !open.hidden
    ) {

      var mid =
        open.getAttribute(
          "data-id"
        );


      $("#m-select")
        .textContent =
        isSelected(mid) ?
          "Remove from selection" :
          "Select product";

    }


    var tray =
      $("#tray");


    var n =
      selected.length;


    if (!tray) {
      return;
    }


    if (n === 0) {

      tray.classList.remove(
        "up"
      );

      document.body.classList.remove(
        "tray-open"
      );


      setTimeout(
        function () {

          if (!selected.length) {
            tray.hidden = true;
          }

        },
        260
      );


      return;

    }


    tray.hidden =
      false;


    requestAnimationFrame(
      function () {

        tray.classList.add(
          "up"
        );

        document.body.classList.add(
          "tray-open"
        );

      }
    );


    $("#tray-count")
      .textContent =
      n +
      (
        n === 1 ?
          " product selected" :
          " products selected"
      );


    var stack =
      $("#tray-stack");


    stack.innerHTML =
      "";


    selected
      .slice(-5)
      .forEach(
        function (id, i) {

          var p =
            productById(id);


          if (!p) {
            return;
          }


          var s =
            document.createElement(
              "span"
            );


          if (p.image) {

            s.style.backgroundImage =
              "url('" +
              p.image +
              "')";

          }

          else {

            s.style.backgroundImage =
              swatchFor(
                p,
                i
              );

          }


          stack.appendChild(
            s
          );

        }
      );


    $("#tray-wa")
      .href =
      waLink(
        selectionMessage()
      );

  }


  $("#tray-clear")
    .addEventListener(
      "click",
      function () {

        selected = [];

        syncSelectionUI();

        toast(
          "Selection cleared"
        );

      }
    );


  $("#tray-wa").target =
    "_blank";


$("#tray-continue")
  .addEventListener(
    "click",
    function () {

      if (!selected.length) {

        toast(
          "Please select at least one product"
        );

        return;
      }

      openDummyBillFlow();

    }
  );


  /*
   * Customer-facing wording for the tray continue action.
   * Set here in JS so we do not need to touch the HTML file.
   */

  (function relabelTrayContinue() {

    var btn =
      $("#tray-continue");

    if (
      btn &&
      btn.textContent.trim().toLowerCase() === "continue"
    ) {

      btn.textContent =
        "Proceed to Enquiry";

    }

  })();


  /* -----------------------------------------------------------------
     PRODUCT MODAL
     ----------------------------------------------------------------- */

  var modal =
    $("#modal");


  var lastFocus =
    null;


  /*
   * Builds/updates the modal image gallery.
   * - Main image uses #m-swatch (existing element, no HTML changes needed).
   * - Thumbnails are created dynamically as a sibling of #m-swatch.
   * - Falls back to the generated swatch when there are no real images.
   */

  function buildModalGallery(p, seed) {

    var main =
      $("#m-swatch");

    if (!main) {
      return;
    }


    var images =
      Array.isArray(p.images) && p.images.length ?
        p.images :
        (p.image ? [p.image] : []);


    function setMain(idx) {

      var src =
        images[idx];

      if (src) {

        main.style.backgroundImage =
          "url('" +
          src +
          "')";

      } else {

        main.style.backgroundImage =
          swatchFor(
            p,
            seed || 0
          );

      }

    }


    setMain(0);


    /*
     * Find existing thumbnail strip, or create one dynamically
     * right after the main image element.
     */

    var thumbs =
      document.getElementById("m-thumbs");


    if (!thumbs) {

      thumbs =
        document.createElement("div");

      thumbs.id =
        "m-thumbs";

      thumbs.className =
        "m-thumbs";

      thumbs.style.display =
        "flex";

      thumbs.style.flexWrap =
        "nowrap";

      thumbs.style.gap =
        "8px";

      thumbs.style.marginTop =
        "10px";

      thumbs.style.overflowX =
        "auto";

      thumbs.style.overflowY =
        "hidden";

      thumbs.style.WebkitOverflowScrolling =
        "touch";

      thumbs.style.paddingBottom =
        "4px";


      if (main.parentNode) {

        main.parentNode.insertBefore(
          thumbs,
          main.nextSibling
        );

      }

    }


    thumbs.innerHTML =
      "";


    /*
     * Only show thumbnail controls when there is more than one image.
     */

    if (images.length > 1) {

      thumbs.hidden =
        false;

      thumbs.style.display =
        "flex";


      images.forEach(
        function (src, i) {

          var t =
            document.createElement("button");

          t.type =
            "button";

          t.className =
            "m-thumb" +
            (
              i === 0 ?
                " active" :
                ""
            );

          t.style.flex =
            "0 0 auto";

          t.style.width =
            "56px";

          t.style.height =
            "56px";

          t.style.borderRadius =
            "8px";

          t.style.backgroundImage =
            "url('" +
            src +
            "')";

          t.style.backgroundSize =
            "cover";

          t.style.backgroundPosition =
            "center";

          t.style.cursor =
            "pointer";

          t.style.padding =
            "0";

          t.style.boxSizing =
            "border-box";

          t.style.border =
            i === 0 ?
              "2px solid #1a1a1a" :
              "2px solid transparent";

          t.style.opacity =
            i === 0 ?
              "1" :
              ".75";


          t.setAttribute(
            "aria-label",
            "View image " +
            (i + 1) +
            " of " +
            (images.length) +
            " for " +
            p.name
          );


          t.addEventListener(
            "click",
            function () {

              setMain(i);


              $$(".m-thumb", thumbs).forEach(
                function (el) {

                  el.classList.remove("active");

                  el.style.border =
                    "2px solid transparent";

                  el.style.opacity =
                    ".75";

                }
              );


              t.classList.add(
                "active"
              );

              t.style.border =
                "2px solid #1a1a1a";

              t.style.opacity =
                "1";

            }
          );


          thumbs.appendChild(
            t
          );

        }
      );

    } else {

      /*
       * Single image or no images — no thumbnail strip needed.
       */

      thumbs.hidden =
        true;

      thumbs.style.display =
        "none";

    }

  }


  function openModal(id, seed) {

    var p =
      productById(id);


    if (!p) {
      return;
    }


    lastFocus =
      document.activeElement;


    modal.setAttribute(
      "data-id",
      p.id
    );


    /*
     * Image / gallery (main image + thumbnails, or swatch fallback).
     */

    buildModalGallery(
      p,
      seed
    );


    $("#m-catalog")
      .textContent =
      (
        catalogById(
          p.catalog
        ).name ||
        p.catalog
      ) +
      (
        p.id ?
          " · " +
          p.id :
          ""
      );


    $("#m-name")
      .textContent =
      p.name;


    $("#m-supplier")
      .textContent =
      p.supplier ?
        "Supplied by: " + p.supplier :
        "";


    $("#m-rate")
      .textContent =
      rateDisplay(p);


    $("#m-desc")
      .textContent =
      p.desc;


    /*
     * Only show specs that actually exist / are actually
     * returned by the API. Demo fields such as Width, GSM
     * and MOQ are not part of the current API response and
     * are intentionally not shown.
     */

    var specs = [];


    if (p.category) {

      specs.push([
        "Category",
        p.category
      ]);

    }


    if (p.id) {

      specs.push([
        "Item Code",
        p.id
      ]);

    }


    var dl =
      $("#m-specs");


    dl.innerHTML =
      "";


    specs.forEach(
      function (row) {

        var d =
          document.createElement(
            "div"
          );


        var dt =
          document.createElement(
            "dt"
          );


        var dd =
          document.createElement(
            "dd"
          );


        dt.textContent =
          row[0];


        dd.textContent =
          row[1];


        d.appendChild(
          dt
        );


        d.appendChild(
          dd
        );


        dl.appendChild(
          d
        );

      }
    );


    var wa =
      $("#m-wa");


    wa.href =
      waLink(
        productMessage(p)
      );


    wa.target =
      "_blank";


    $("#m-select")
      .textContent =
      isSelected(p.id) ?
        "Remove from selection" :
        "Select product";


    modal.hidden =
      false;


    document.body.classList.add(
      "locked"
    );


    $(".modal-close", modal)
      .focus();

  }


  function closeModal() {

    modal.hidden =
      true;


    document.body.classList.remove(
      "locked"
    );


    if (lastFocus) {
      lastFocus.focus();
    }

  }


  $$("[data-close-modal]")
    .forEach(
      function (el) {

        el.addEventListener(
          "click",
          closeModal
        );

      }
    );


  $("#m-select")
    .addEventListener(
      "click",
      function () {

        toggleSelect(
          modal.getAttribute(
            "data-id"
          )
        );

      }
    );


  document.addEventListener(
    "keydown",
    function (e) {

      if (
        e.key !== "Escape"
      ) {
        return;
      }


      if (
        !modal.hidden
      ) {

        closeModal();

      }

      else {

        closeMenu();

      }

    }
  );


  /* -----------------------------------------------------------------
     MODAL FOCUS
     ----------------------------------------------------------------- */

  modal.addEventListener(
    "keydown",
    function (e) {

      if (
        e.key !== "Tab"
      ) {
        return;
      }


      var f =
        $$(
          'button, a[href], input, select, [tabindex]:not([tabindex="-1"])',
          modal
        )
        .filter(
          function (el) {

            return (
              el.offsetParent !== null
            );

          }
        );


      if (!f.length) {
        return;
      }


      var first =
        f[0];

      var last =
        f[f.length - 1];


      if (
        e.shiftKey &&
        document.activeElement === first
      ) {

        e.preventDefault();

        last.focus();

      }

      else if (
        !e.shiftKey &&
        document.activeElement === last
      ) {

        e.preventDefault();

        first.focus();

      }

    }
  );

  /* -----------------------------------------------------------------
   PRODUCT ENQUIRY FLOW
   (backend still uses the existing Saree Dummy Bill DocType and the
   existing /api/method/ratan_bandhu.api.* endpoints — only the
   customer-facing wording and UI have changed)
   ----------------------------------------------------------------- */

/*
 * One-time injected stylesheet for the enquiry dialog:
 * - removes number input spinner arrows (Chrome/Edge/Firefox)
 * - defines the responsive "table" grid used for customer info
 *   and the quantity/rate/amount rows
 */

function injectEnquiryStyles() {

  if (document.getElementById("enquiry-flow-styles")) {
    return;
  }

  var style =
    document.createElement("style");

  style.id =
    "enquiry-flow-styles";

  style.textContent =
    "input[type='number']::-webkit-inner-spin-button," +
    "input[type='number']::-webkit-outer-spin-button{" +
    "-webkit-appearance:none;margin:0;}" +

    "input[type='number']{" +
    "appearance:textfield;-moz-appearance:textfield;}" +

    ".enq-info-grid{" +
    "display:grid;grid-template-columns:1fr 1fr;gap:16px 28px;}" +

    "@media (max-width:640px){" +
    ".enq-info-grid{grid-template-columns:1fr;}}" +

    ".enq-info-label{" +
    "font-size:11px;text-transform:uppercase;letter-spacing:.08em;" +
    "color:#8a8a8a;margin-bottom:4px;font-weight:600;}" +

    ".enq-info-value{" +
    "font-size:14px;color:#1a1a1a;line-height:1.55;white-space:pre-line;}" +

    ".enq-verified-badge{" +
    "display:inline-flex;align-items:center;gap:6px;" +
    "font-size:12px;font-weight:600;color:#1d6b35;" +
    "background:#eef8f0;padding:6px 12px;border-radius:100px;" +
    "margin-bottom:16px;}" +

    ".enq-row{" +
    "display:grid;" +
    "grid-template-columns:2.1fr 1.2fr 1fr .8fr .9fr 1fr;" +
    "gap:12px;align-items:center;padding:14px 4px;" +
    "border-bottom:1px solid #ececec;}" +

    ".enq-row-head{" +
    "font-size:11px;text-transform:uppercase;letter-spacing:.08em;" +
    "color:#8a8a8a;font-weight:600;padding-bottom:8px;" +
    "border-bottom:1px solid #e0e0e0;}" +

    "@media (max-width:760px){" +
    ".enq-row{grid-template-columns:1fr 1fr;row-gap:10px;padding:16px 4px;}" +
    ".enq-row-head{display:none;}" +
    ".enq-cell[data-label]{position:relative;}" +
    ".enq-cell[data-label]::before{" +
    "content:attr(data-label);display:block;font-size:10px;" +
    "text-transform:uppercase;letter-spacing:.06em;color:#9a9a9a;" +
    "margin-bottom:3px;font-weight:600;}" +
    ".enq-cell-product{grid-column:1 / -1;}" +
    "}";

  document.head.appendChild(
    style
  );

}


function openDummyBillFlow() {

  if (!selected.length) {

    toast(
      "Please select at least one product"
    );

    return;
  }

  injectEnquiryStyles();

  var existing =
    document.getElementById(
      "dummy-bill-flow"
    );

  if (existing) {
    existing.remove();
  }

  var overlay =
    document.createElement("div");

  overlay.id =
    "dummy-bill-flow";

  overlay.style.position =
    "fixed";

  overlay.style.inset =
    "0";

  overlay.style.zIndex =
    "99999";

  overlay.style.background =
    "rgba(0,0,0,.45)";

  overlay.style.display =
    "flex";

  overlay.style.alignItems =
    "center";

  overlay.style.justifyContent =
    "center";

  overlay.style.padding =
    "20px";

  overlay.innerHTML = `
    <div
      class="dummy-bill-dialog"
      style="
        width:100%;
        max-width:780px;
        max-height:90vh;
        overflow:auto;
        background:#fff;
        border-radius:20px;
        padding:28px;
        box-shadow:0 25px 80px rgba(0,0,0,.2);
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:20px;
          margin-bottom:24px;
        "
      >

        <div>
          <div
            style="
              font-size:12px;
              text-transform:uppercase;
              letter-spacing:.12em;
              opacity:.55;
              margin-bottom:6px;
            "
          >
            Product Enquiry
          </div>

          <h2
            id="dummy-bill-title"
            style="
              margin:0;
              font-size:26px;
            "
          >
            Customer Information
          </h2>
        </div>

        <button
          type="button"
          id="dummy-bill-close"
          style="
            width:40px;
            height:40px;
            border:0;
            border-radius:50%;
            background:#f4f4f4;
            cursor:pointer;
            font-size:20px;
          "
        >
          ×
        </button>

      </div>


      <div
        id="dummy-bill-step-customer"
      >

        <p
          style="
            margin-top:0;
            color:#666;
          "
        >
          Enter either your Contact Number or GSTIN
          to verify your customer account.
        </p>


        <div
          style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:16px;
            margin-top:20px;
          "
        >

          <label>
            <span
              style="
                display:block;
                font-size:13px;
                font-weight:600;
                margin-bottom:7px;
              "
            >
              Contact Number
            </span>

            <input
              type="tel"
              id="dummy-contact-no"
              placeholder="Enter contact number"
              autocomplete="tel"
              style="
                width:100%;
                box-sizing:border-box;
                padding:13px 14px;
                border:1px solid #ddd;
                border-radius:10px;
                font-size:15px;
              "
            >
          </label>


          <label>
            <span
              style="
                display:block;
                font-size:13px;
                font-weight:600;
                margin-bottom:7px;
              "
            >
              GSTIN
            </span>

            <input
              type="text"
              id="dummy-gstin"
              placeholder="Enter GSTIN"
              autocomplete="off"
              style="
                width:100%;
                box-sizing:border-box;
                padding:13px 14px;
                border:1px solid #ddd;
                border-radius:10px;
                font-size:15px;
                text-transform:uppercase;
              "
            >
          </label>

        </div>


        <div
          id="dummy-customer-result"
          style="
            margin-top:16px;
          "
        ></div>


        <div
          id="dummy-customer-confirmed"
          style="
            margin-top:16px;
            display:none;
            padding:20px;
            border:1px solid #e5e5e5;
            border-radius:14px;
            background:#fafafa;
          "
        ></div>


        <button
          type="button"
          id="dummy-find-customer"
          style="
            width:100%;
            margin-top:20px;
            padding:14px 18px;
            border:0;
            border-radius:10px;
            background:#111;
            color:#fff;
            font-size:15px;
            font-weight:600;
            cursor:pointer;
          "
        >
          Verify Customer
        </button>

      </div>


      <div
        id="dummy-bill-step-quantity"
        hidden
      >

        <div
          style="
            margin-bottom:16px;
          "
        >

          <div
            style="
              font-size:13px;
              color:#777;
              margin-bottom:4px;
            "
          >
            Customer
          </div>

          <strong
            id="dummy-selected-customer"
          ></strong>

        </div>


        <p
          style="
            margin:0 0 18px;
            color:#666;
          "
        >
          Specify the quantity required for each selected product.
        </p>


        <div
          class="enq-row enq-row-head"
        >
          <div>Product</div>
          <div>Supplier</div>
          <div>Rate</div>
          <div>UOM</div>
          <div>Quantity</div>
          <div>Amount</div>
        </div>


        <div
          id="dummy-quantity-list"
        ></div>


        <div
          id="dummy-total"
          style="
            margin-top:20px;
            padding:16px;
            border-radius:12px;
            background:#f7f7f7;
            font-weight:600;
            display:flex;
            justify-content:space-between;
          "
        >
          <span>Total</span>
          <span id="dummy-total-value">
            ₹0
          </span>
        </div>


        <button
          type="button"
          id="dummy-create-bills"
          style="
            width:100%;
            margin-top:20px;
            padding:14px 18px;
            border:0;
            border-radius:10px;
            background:#111;
            color:#fff;
            font-size:15px;
            font-weight:600;
            cursor:pointer;
          "
        >
          Submit Enquiry
        </button>

      </div>


      <div
        id="dummy-bill-step-success"
        hidden
      >

        <div
          style="
            text-align:center;
            padding:30px 10px;
          "
        >

          <div
            style="
              width:64px;
              height:64px;
              border-radius:50%;
              background:#eef8f0;
              display:flex;
              align-items:center;
              justify-content:center;
              margin:0 auto 18px;
              font-size:30px;
            "
          >
            ✓
          </div>

          <h2
            style="
              margin:0 0 10px;
            "
          >
            Enquiry Submitted
          </h2>

          <p
            id="dummy-success-message"
            style="
              color:#666;
              margin:0;
            "
          ></p>

          <div
            id="dummy-created-bills"
            style="
              text-align:left;
              margin-top:24px;
            "
          ></div>

          <button
            type="button"
            id="dummy-finish"
            style="
              width:100%;
              margin-top:24px;
              padding:14px 18px;
              border:0;
              border-radius:10px;
              background:#111;
              color:#fff;
              font-size:15px;
              font-weight:600;
              cursor:pointer;
            "
          >
            Close
          </button>

        </div>

      </div>

    </div>
  `;

  document.body.appendChild(
    overlay
  );


  $("#dummy-bill-close")
    .addEventListener(
      "click",
      function () {

        overlay.remove();

      }
    );


  $("#dummy-find-customer")
    .addEventListener(
      "click",
      function () {

        findDummyBillCustomer();

      }
    );


  $("#dummy-create-bills")
    .addEventListener(
      "click",
      function () {

        createDummyBills();

      }
    );


  $("#dummy-finish")
    .addEventListener(
      "click",
      function () {

        overlay.remove();

        selected = [];

        syncSelectionUI();

      }
    );


  $("#dummy-contact-no")
    .addEventListener(
      "keydown",
      function (e) {

        if (e.key === "Enter") {

          findDummyBillCustomer();

        }

      }
    );


  $("#dummy-gstin")
    .addEventListener(
      "keydown",
      function (e) {

        if (e.key === "Enter") {

          findDummyBillCustomer();

        }

      }
    );

}


/* -----------------------------------------------------------------
   FIND / VERIFY CUSTOMER
   ----------------------------------------------------------------- */

/*
 * dummyBillCustomer holds the actual ERPNext Customer docname
 * (the value the backend needs to create the Saree Dummy Bill
 * records against). dummyBillCustomerDisplay holds the friendlier
 * customer_name shown to the visitor.
 */

var dummyBillCustomer = "";
var dummyBillCustomerDisplay = "";


/*
 * Normalises the lookup_customer response so this file keeps
 * working whether the backend returns:
 *   - the new structured shape:
 *       { success, customer: {...}, billing_address: {...}, shipping_address: {...} }
 *   - or the older simple shape:
 *       { success, customer: "Customer Name" }
 */

function normalizeCustomerResponse(response) {

  var raw =
    response && response.customer;

  var customer = {
    name: "",
    customer_name: "",
    gstin: "",
    contact_no: "",
    email: "",
    customer_id: ""
  };

  if (raw && typeof raw === "object") {

    customer.name =
      raw.name || raw.customer_id || raw.customer_name || "";

    customer.customer_name =
      raw.customer_name || raw.name || "";

    customer.gstin =
      raw.gstin || "";

    customer.contact_no =
      raw.contact_no || raw.mobile_no || raw.phone || "";

    customer.email =
      raw.email || raw.email_id || "";

    customer.customer_id =
      raw.customer_id || raw.name || "";

  } else if (typeof raw === "string") {

    customer.name =
      raw;

    customer.customer_name =
      raw;

    customer.customer_id =
      raw;

  }

  return {
    customer: customer,
    billing_address:
      response && response.billing_address ?
        response.billing_address :
        null,
    shipping_address:
      response && response.shipping_address ?
        response.shipping_address :
        null
  };

}


/*
 * Formats an ERPNext Address record into readable lines
 * for the customer-facing summary. Never exposes raw
 * ERPNext field names, and silently skips missing fields.
 */

function formatAddressLines(addr) {

  if (!addr) {
    return "";
  }

  var lines = [];

  if (addr.address_title) {
    lines.push(addr.address_title);
  }

  if (addr.address_line1) {
    lines.push(addr.address_line1);
  }

  if (addr.address_line2) {
    lines.push(addr.address_line2);
  }

  var cityState =
    [addr.city, addr.state]
      .filter(Boolean)
      .join(", ");

  if (addr.pincode) {

    cityState =
      cityState ?
        cityState + " - " + addr.pincode :
        addr.pincode;

  }

  if (cityState) {
    lines.push(cityState);
  }

  if (addr.country) {
    lines.push(addr.country);
  }

  return lines.join("\n");

}


/*
 * Builds the "Customer Information" confirmation block shown
 * after a successful verification. Only fields that actually
 * have a value are rendered.
 */

function buildCustomerInfoHtml(normalized) {

  var customer =
    normalized.customer;

  var items = [];

  if (customer.customer_name) {

    items.push([
      "Customer Name",
      customer.customer_name
    ]);

  }

  if (customer.customer_id) {

    items.push([
      "Customer ID",
      customer.customer_id
    ]);

  }

  if (customer.gstin) {

    items.push([
      "GSTIN",
      customer.gstin
    ]);

  }

  if (customer.contact_no) {

    items.push([
      "Contact Number",
      customer.contact_no
    ]);

  }

  if (customer.email) {

    items.push([
      "Email",
      customer.email
    ]);

  }

  var billingLines =
    formatAddressLines(
      normalized.billing_address
    );

  if (billingLines) {

    items.push([
      "Billing Address",
      billingLines
    ]);

  }

  var shippingLines =
    formatAddressLines(
      normalized.shipping_address
    );

  if (shippingLines) {

    items.push([
      "Shipping Address",
      shippingLines
    ]);

  }

  var html =
    '<div class="enq-verified-badge">✓ Customer verified</div>' +
    '<div class="enq-info-grid">';

  items.forEach(
    function (row) {

      html +=
        '<div class="enq-info-item">' +
        '<div class="enq-info-label">' +
        escapeDummyBillHtml(row[0]) +
        "</div>" +
        '<div class="enq-info-value">' +
        escapeDummyBillHtml(row[1]) +
        "</div>" +
        "</div>";

    }
  );

  html +=
    "</div>" +

    '<button ' +
    'type="button" ' +
    'id="dummy-continue-enquiry" ' +
    'style="' +
    'width:100%;' +
    'margin-top:22px;' +
    'padding:13px 18px;' +
    'border:1px solid #111;' +
    'border-radius:10px;' +
    'background:#fff;' +
    'color:#111;' +
    'font-size:15px;' +
    'font-weight:600;' +
    'cursor:pointer;' +
    '">' +
    "Continue to Enquiry" +
    "</button>";

  return html;

}


function findDummyBillCustomer() {

  var contact =
    (
      $("#dummy-contact-no").value ||
      ""
    ).trim();


  var gstin =
    (
      $("#dummy-gstin").value ||
      ""
    ).trim()
      .toUpperCase();


  var result =
    $("#dummy-customer-result");

  var confirmed =
    $("#dummy-customer-confirmed");


  confirmed.style.display =
    "none";

  confirmed.innerHTML =
    "";


  if (!contact && !gstin) {

    result.innerHTML =
      '<div style="color:#b42318;">' +
      "Please enter Contact Number or GSTIN." +
      "</div>";

    return;
  }


  var button =
    $("#dummy-find-customer");


  button.disabled =
    true;

  button.textContent =
    "Verifying...";


  result.innerHTML =
    '<div style="color:#666;">' +
    "Verifying customer..." +
    "</div>";


  var params =
    new URLSearchParams();


  if (contact) {

    params.set(
      "contact_no",
      contact
    );

  }


  if (gstin) {

    params.set(
      "gstin",
      gstin
    );

  }


  fetch(
    "/api/method/ratan_bandhu.api.lookup_customer?" +
    params.toString(),
    {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "Accept": "application/json"
      }
    }
  )

  .then(
    function (response) {

      return response.json();

    }
  )

  .then(
    function (data) {

      button.disabled =
        false;

      button.textContent =
        "Verify Customer";


      var response =
        data.message || data;


      if (
        !response ||
        !response.success ||
        !response.customer
      ) {

        dummyBillCustomer =
          "";

        dummyBillCustomerDisplay =
          "";

        result.innerHTML =
          '<div style="color:#b42318;">' +
          escapeDummyBillHtml(
            (response && response.message) ||
            "We couldn't find a customer matching the details provided. Please check the Contact Number or GSTIN and try again."
          ) +
          "</div>";

        return;
      }


      var normalized =
        normalizeCustomerResponse(
          response
        );


      dummyBillCustomer =
        normalized.customer.name;

      dummyBillCustomerDisplay =
        normalized.customer.customer_name ||
        normalized.customer.name;


      if (!dummyBillCustomer) {

        result.innerHTML =
          '<div style="color:#b42318;">' +
          "We couldn't find a customer matching the details provided. Please check the Contact Number or GSTIN and try again." +
          "</div>";

        return;
      }


      result.innerHTML =
        "";


      confirmed.style.display =
        "block";

      confirmed.innerHTML =
        buildCustomerInfoHtml(
          normalized
        );


      $("#dummy-continue-enquiry")
        .addEventListener(
          "click",
          function () {

            showDummyBillQuantityStep();

          }
        );

    }
  )

  .catch(
    function (error) {

      console.error(
        "Customer verification error:",
        error
      );


      button.disabled =
        false;

      button.textContent =
        "Verify Customer";


      result.innerHTML =
        '<div style="color:#b42318;">' +
        "Unable to verify customer. Please try again." +
        "</div>";

    }
  );

}


/* -----------------------------------------------------------------
   QUANTITY STEP ("Enquiry Requirements")
   ----------------------------------------------------------------- */

function showDummyBillQuantityStep() {

  $("#dummy-bill-step-customer")
    .hidden =
    true;


  $("#dummy-bill-step-quantity")
    .hidden =
    false;


  var titleEl =
    $("#dummy-bill-title");

  if (titleEl) {

    titleEl.textContent =
      "Enquiry Requirements";

  }


  $("#dummy-selected-customer")
    .textContent =
    dummyBillCustomerDisplay ||
    dummyBillCustomer;


  var list =
    $("#dummy-quantity-list");


  list.innerHTML =
    "";


  selected.forEach(
    function (id) {

      var p =
        productById(id);


      if (!p) {
        return;
      }


      var rate =
        Number(p.rate || 0);


      var uom =
        p.stock_uom ?
          escapeDummyBillHtml(p.stock_uom) :
          "—";


      var row =
        document.createElement(
          "div"
        );


      row.className =
        "enq-row";


      row.innerHTML =

        '<div class="enq-cell enq-cell-product" data-label="Product">' +
        "<strong>" +
        escapeDummyBillHtml(p.name) +
        "</strong>" +
        (
          p.id ?
            '<div style="font-size:12px;color:#888;margin-top:2px;">' +
            escapeDummyBillHtml(p.id) +
            "</div>" :
            ""
        ) +
        "</div>" +

        '<div class="enq-cell" data-label="Supplier">' +
        (
          p.supplier ?
            escapeDummyBillHtml(p.supplier) :
            "—"
        ) +
        "</div>" +

        '<div class="enq-cell" data-label="Rate">' +
        escapeDummyBillHtml(money(rate)) +
        "</div>" +

        '<div class="enq-cell" data-label="UOM">' +
        uom +
        "</div>" +

        '<div class="enq-cell" data-label="Quantity">' +
        '<input ' +
        'type="number" ' +
        'min="0.01" ' +
        'step="0.01" ' +
        'value="1" ' +
        'class="dummy-quantity-input" ' +
        'data-item-id="' +
        escapeDummyBillHtml(p.id) +
        '" ' +
        'style="' +
        'width:100%;' +
        'box-sizing:border-box;' +
        'padding:9px 10px;' +
        'border:1px solid #ddd;' +
        'border-radius:8px;' +
        'font-size:14px;' +
        '">' +
        "</div>" +

        '<div class="enq-cell" data-label="Amount">' +
        '<span class="dummy-row-amount">' +
        escapeDummyBillHtml(money(rate)) +
        "</span>" +
        "</div>";


      list.appendChild(
        row
      );

    }
  );


  $$(".dummy-quantity-input")
    .forEach(
      function (input) {

        input.addEventListener(
          "input",
          updateDummyBillTotals
        );

      }
    );


  updateDummyBillTotals();

}


/* -----------------------------------------------------------------
   UPDATE TOTALS
   ----------------------------------------------------------------- */

function updateDummyBillTotals() {

  var total =
    0;


  $$(".dummy-quantity-input")
    .forEach(
      function (input) {

        var id =
          input.getAttribute(
            "data-item-id"
          );


        var p =
          productById(id);


        if (!p) {
          return;
        }


        var quantity =
          Number(
            input.value || 0
          );


        var amount =
          Number(p.rate || 0) *
          quantity;


        var row =
          input.closest(
            ".enq-row"
          );


        if (row) {

          var amountEl =
            $(".dummy-row-amount", row);

          if (amountEl) {

            amountEl.textContent =
              money(amount);

          }

        }


        total +=
          amount;

      }
    );


  var totalEl =
    $("#dummy-total-value");


  if (totalEl) {

    totalEl.textContent =
      money(total);

  }

}


/* -----------------------------------------------------------------
   CSRF TOKEN FOR THE PUBLIC ENQUIRY POST
   ----------------------------------------------------------------- */

var csrfTokenPromise = null;


function knownCsrfToken() {

  var token =
    (
      window.frappe &&
      window.frappe.csrf_token
    ) || "";

  token =
    String(token).trim();


  /*
   * Frappe renders a Python None as the literal string "None"
   * for guest sessions. Treat that as "no token".
   */

  if (
    !token ||
    token === "None" ||
    token === "null" ||
    token === "undefined"
  ) {

    return "";

  }

  return token;

}


function getCsrfToken() {

  var token =
    knownCsrfToken();


  if (token) {

    return Promise.resolve(token);

  }


  if (csrfTokenPromise) {

    return csrfTokenPromise;

  }


  csrfTokenPromise =

    fetch(
      "/api/method/ratan_bandhu.api.get_website_csrf_token",
      {
        method: "GET",
        credentials: "same-origin",
        headers: {
          "Accept": "application/json"
        }
      }
    )

    .then(function (response) {

      return response.ok ?
        response.json() :
        null;

    })

    .then(function (data) {

      var fetched =
        String(
          (
            data &&
            data.message &&
            data.message.csrf_token
          ) || ""
        ).trim();


      if (
        fetched &&
        fetched !== "None"
      ) {

        window.frappe =
          window.frappe || {};

        window.frappe.csrf_token =
          fetched;

        return fetched;

      }

      return "";

    })

    .catch(function () {

      /*
       * Never block the enquiry on this lookup.
       * A guest does not need a token anyway.
       */

      return "";

    });


  return csrfTokenPromise;

}


/* -----------------------------------------------------------------
   SUBMIT ENQUIRY (creates one Saree Dummy Bill per product)
   ----------------------------------------------------------------- */

function createDummyBills() {

  if (!dummyBillCustomer) {

    toast(
      "Customer is required"
    );

    return;
  }


  var rows =
    [];


  var invalid =
    false;


  $$(".dummy-quantity-input")
    .forEach(
      function (input) {

        var itemCode =
          input.getAttribute(
            "data-item-id"
          );


        var quantity =
          Number(
            input.value || 0
          );


        if (
          !itemCode ||
          !quantity ||
          isNaN(quantity) ||
          quantity <= 0
        ) {

          invalid =
            true;

          return;

        }


        rows.push({
          item_code: itemCode,
          quantity: quantity
        });

      }
    );


  if (invalid) {

    toast(
      "Enter a valid quantity for every product"
    );

    return;
  }


  if (!rows.length) {

    toast(
      "No products selected"
    );

    return;
  }


  var button =
    $("#dummy-create-bills");


  button.disabled =
    true;

  button.textContent =
    "Submitting Enquiry...";


  getCsrfToken()

  .then(function (csrfToken) {

    var headers = {
      "Content-Type":
        "application/json",

      "Accept":
        "application/json"
    };


    if (csrfToken) {

      headers["X-Frappe-CSRF-Token"] =
        csrfToken;

    }


    return fetch(
      "/api/method/ratan_bandhu.api.create_saree_dummy_bills",
      {
        method: "POST",

        credentials: "same-origin",

        headers: headers,

        body:
          JSON.stringify({
            customer:
              dummyBillCustomer,

            items:
              rows
          })
      }
    );

  })

  .then(function (response) {

    return response.text().then(function (text) {

      var data = null;

      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Enquiry API non-JSON response:", text);
        throw new Error(
          "Server returned an invalid response (HTTP " +
          response.status +
          ")."
        );
      }

      console.log("Enquiry API HTTP status:", response.status);
      console.log("Enquiry API response:", data);

      if (!response.ok) {

        var message =
          (data && data.message && (
            data.message.message ||
            data.message.error ||
            data.message.exception
          )) ||
          (data && data.exception) ||
          (data && data.exc) ||
          "Unable to submit your enquiry.";

        throw new Error(
          "HTTP " + response.status + ": " + message
        );

      }

      return data;

    });

  })

  .then(function (data) {

    button.disabled =
      false;

    button.textContent =
      "Submit Enquiry";

    var response =
      data.message || data;

    if (!response || !response.success) {

      console.error(
        "Enquiry API returned failure:",
        data
      );

      throw new Error(
        (response && (
          response.message ||
          response.error
        )) ||
        "Unable to submit your enquiry."
      );

    }

    showDummyBillSuccess(
      response
    );

  })

  .catch(function (error) {

    console.error(
      "Enquiry submission error:",
      error
    );

    button.disabled =
      false;

    button.textContent =
      "Submit Enquiry";

    toast(
      error.message ||
      "Unable to submit your enquiry."
    );

  });

}


/* -----------------------------------------------------------------
   SUCCESS ("Enquiry Submitted")
   ----------------------------------------------------------------- */

function showDummyBillSuccess(
  response
) {

  $("#dummy-bill-step-quantity")
    .hidden =
    true;


  $("#dummy-bill-step-success")
    .hidden =
    false;


  var titleEl =
    $("#dummy-bill-title");

  if (titleEl) {

    titleEl.textContent =
      "Enquiry Submitted";

  }


  var bills =
    response.bills || [];

  var count =
    response.count ||
    bills.length;


  $("#dummy-success-message")
    .textContent =
    "Your enquiry has been submitted successfully" +
    (
      dummyBillCustomerDisplay ?
        " for " + dummyBillCustomerDisplay :
        ""
    ) +
    ".";


  var container =
    $("#dummy-created-bills");


  container.innerHTML =
    "";


  if (bills.length) {

    var heading =
      document.createElement(
        "div"
      );

    heading.style.fontSize =
      "13px";

    heading.style.fontWeight =
      "600";

    heading.style.color =
      "#777";

    heading.style.marginBottom =
      "10px";

    heading.style.textTransform =
      "uppercase";

    heading.style.letterSpacing =
      ".06em";

    heading.textContent =
      count === 1 ?
        "Enquiry Reference" :
        "Enquiry References";

    container.appendChild(
      heading
    );

  }


  bills.forEach(
    function (bill) {

      var row =
        document.createElement(
          "div"
        );


      row.style.padding =
        "14px";

      row.style.border =
        "1px solid #e5e5e5";

      row.style.borderRadius =
        "10px";

      row.style.marginBottom =
        "10px";


      row.innerHTML =
        "<strong>" +
        escapeDummyBillHtml(
          bill.name
        ) +
        "</strong>" +

        (
          bill.item || bill.quantity || bill.amount ?
            '<div style="' +
            'font-size:13px;' +
            'color:#666;' +
            'margin-top:5px;' +
            '">' +

            [
              bill.item ?
                escapeDummyBillHtml(bill.item) :
                "",

              bill.quantity != null ?
                "Qty: " +
                escapeDummyBillHtml(String(bill.quantity)) :
                "",

              bill.amount != null ?
                "Amount: " +
                escapeDummyBillHtml(money(bill.amount)) :
                ""

            ].filter(Boolean).join(" · ") +

            "</div>" :
            ""
        );


      container.appendChild(
        row
      );

    }
  );

}


/* -----------------------------------------------------------------
   TRACK YOUR ORDER FLOW
   -----------------------------------------------------------------
   Enter Dummy Bill ID + Contact Number OR GSTIN
         -> Verify
         -> Show all matching orders
         -> Filters: From Date | To Date | Status
         -> Professional order/status cards

   Backed by /api/method/ratan_bandhu.api.track_customer_orders.
   Verification happens server-side: the Bill ID must belong to a
   Customer whose Contact Number or GSTIN matches what was entered.
   ----------------------------------------------------------------- */

/*
 * One-time injected stylesheet for the track-order dialog.
 */

function injectTrackOrderStyles() {

  if (document.getElementById("track-order-styles")) {
    return;
  }

  var style =
    document.createElement("style");

  style.id =
    "track-order-styles";

  style.textContent =

    ".trk-filters{" +
    "display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;" +
    "margin:0 0 22px;padding:18px;background:#fafafa;" +
    "border:1px solid #ececec;border-radius:14px;}" +

    "@media (max-width:640px){" +
    ".trk-filters{grid-template-columns:1fr;}}" +

    ".trk-filters label{" +
    "display:block;font-size:11px;text-transform:uppercase;" +
    "letter-spacing:.06em;font-weight:600;color:#8a8a8a;" +
    "margin-bottom:6px;}" +

    ".trk-filters input,.trk-filters select{" +
    "width:100%;box-sizing:border-box;padding:10px 12px;" +
    "border:1px solid #ddd;border-radius:8px;font-size:14px;" +
    "font-family:inherit;background:#fff;}" +

    ".trk-summary{" +
    "font-size:13px;color:#888;margin:0 0 14px;}" +

    ".trk-grid{" +
    "display:grid;grid-template-columns:1fr 1fr;gap:14px;}" +

    "@media (max-width:680px){" +
    ".trk-grid{grid-template-columns:1fr;}}" +

    ".trk-card{" +
    "border:1px solid #e5e5e5;border-radius:14px;padding:18px;}" +

    ".trk-card-head{" +
    "display:flex;justify-content:space-between;align-items:flex-start;" +
    "gap:10px;margin-bottom:12px;}" +

    ".trk-card-id{" +
    "font-size:12px;color:#999;margin-bottom:3px;}" +

    ".trk-card-name{" +
    "font-size:15.5px;font-weight:600;color:#1a1a1a;}" +

    ".trk-status{" +
    "font-size:10.5px;font-weight:700;text-transform:uppercase;" +
    "letter-spacing:.05em;padding:5px 11px;border-radius:100px;" +
    "white-space:nowrap;background:#f0f0f0;color:#555;}" +

    ".trk-status-draft{background:#fdf3e3;color:#93690c;}" +
    ".trk-status-confirmed{background:#eaf1fa;color:#1b4f8f;}" +
    ".trk-status-dispatched{background:#eef4fb;color:#1d5a9c;}" +
    ".trk-status-delivered{background:#eef8f0;color:#1d6b35;}" +
    ".trk-status-completed{background:#eef8f0;color:#1d6b35;}" +
    ".trk-status-cancelled{background:#fbeaea;color:#a4262c;}" +

    ".trk-card-row{" +
    "display:flex;justify-content:space-between;gap:10px;" +
    "font-size:13.5px;color:#555;padding:4px 0;}" +

    ".trk-card-row span:last-child{color:#1a1a1a;font-weight:500;" +
    "text-align:right;}" +

    ".trk-empty{" +
    "text-align:center;padding:48px 12px;color:#888;font-size:14.5px;}" +

    ".trk-back{" +
    "background:none;border:0;padding:0;margin-bottom:16px;" +
    "font-size:13px;color:#666;cursor:pointer;text-decoration:underline;}";

  document.head.appendChild(
    style
  );

}


var trackOrderCustomerName = "";
var trackOrderAllResults = [];


function openTrackOrderFlow() {

  injectTrackOrderStyles();

  var existing =
    document.getElementById(
      "track-order-flow"
    );

  if (existing) {
    existing.remove();
  }

  var overlay =
    document.createElement("div");

  overlay.id =
    "track-order-flow";

  overlay.style.position =
    "fixed";

  overlay.style.inset =
    "0";

  overlay.style.zIndex =
    "99999";

  overlay.style.background =
    "rgba(0,0,0,.45)";

  overlay.style.display =
    "flex";

  overlay.style.alignItems =
    "center";

  overlay.style.justifyContent =
    "center";

  overlay.style.padding =
    "20px";

  overlay.innerHTML = `
    <div
      class="track-order-dialog"
      style="
        width:100%;
        max-width:860px;
        max-height:90vh;
        overflow:auto;
        background:#fff;
        border-radius:20px;
        padding:28px;
        box-shadow:0 25px 80px rgba(0,0,0,.2);
      "
    >

      <div
        style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:20px;
          margin-bottom:24px;
        "
      >

        <div>
          <div
            style="
              font-size:12px;
              text-transform:uppercase;
              letter-spacing:.12em;
              opacity:.55;
              margin-bottom:6px;
            "
          >
            Order Tracking
          </div>

          <h2
            id="track-order-title"
            style="
              margin:0;
              font-size:26px;
            "
          >
            Track Your Order
          </h2>
        </div>

        <button
          type="button"
          id="track-order-close"
          style="
            width:40px;
            height:40px;
            border:0;
            border-radius:50%;
            background:#f4f4f4;
            cursor:pointer;
            font-size:20px;
          "
        >
          ×
        </button>

      </div>


      <div id="track-order-step-verify">

        <p
          style="
            margin-top:0;
            color:#666;
          "
        >
          Enter your Order / Dummy Bill ID along with the Contact Number
          or GSTIN used for that order to view its status.
        </p>

        <label style="display:block;margin-top:20px;">
          <span
            style="
              display:block;
              font-size:13px;
              font-weight:600;
              margin-bottom:7px;
            "
          >
            Order / Dummy Bill ID
          </span>

          <input
            type="text"
            id="track-bill-id"
            placeholder="e.g. SDB-2026-00001"
            autocomplete="off"
            style="
              width:100%;
              box-sizing:border-box;
              padding:13px 14px;
              border:1px solid #ddd;
              border-radius:10px;
              font-size:15px;
            "
          >
        </label>

        <div
          style="
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:16px;
            margin-top:16px;
          "
        >

          <label>
            <span
              style="
                display:block;
                font-size:13px;
                font-weight:600;
                margin-bottom:7px;
              "
            >
              Contact Number
            </span>

            <input
              type="tel"
              id="track-contact-no"
              placeholder="Enter contact number"
              autocomplete="tel"
              style="
                width:100%;
                box-sizing:border-box;
                padding:13px 14px;
                border:1px solid #ddd;
                border-radius:10px;
                font-size:15px;
              "
            >
          </label>

          <label>
            <span
              style="
                display:block;
                font-size:13px;
                font-weight:600;
                margin-bottom:7px;
              "
            >
              GSTIN
            </span>

            <input
              type="text"
              id="track-gstin"
              placeholder="Enter GSTIN"
              autocomplete="off"
              style="
                width:100%;
                box-sizing:border-box;
                padding:13px 14px;
                border:1px solid #ddd;
                border-radius:10px;
                font-size:15px;
                text-transform:uppercase;
              "
            >
          </label>

        </div>

        <div
          id="track-order-result"
          style="margin-top:16px;"
        ></div>

        <button
          type="button"
          id="track-order-verify"
          style="
            width:100%;
            margin-top:20px;
            padding:14px 18px;
            border:0;
            border-radius:10px;
            background:#111;
            color:#fff;
            font-size:15px;
            font-weight:600;
            cursor:pointer;
          "
        >
          Verify &amp; Track
        </button>

      </div>


      <div id="track-order-step-results" hidden>

        <button
          type="button"
          class="trk-back"
          id="track-order-back"
        >
          ← Verify a different order
        </button>

        <p
          class="trk-summary"
          id="track-order-summary"
        ></p>

        <div class="trk-filters">

          <label>
            From date
            <input type="date" id="trk-from-date">
          </label>

          <label>
            To date
            <input type="date" id="trk-to-date">
          </label>

          <label>
            Status
            <select id="trk-status-filter">
              <option value="">All statuses</option>
            </select>
          </label>

        </div>

        <div
          class="trk-grid"
          id="track-order-cards"
        ></div>

      </div>

    </div>
  `;

  document.body.appendChild(
    overlay
  );

  $("#track-order-close")
    .addEventListener(
      "click",
      function () {

        overlay.remove();

      }
    );

  $("#track-order-verify")
    .addEventListener(
      "click",
      function () {

        verifyTrackOrder();

      }
    );

  $("#track-order-back")
    .addEventListener(
      "click",
      function () {

        $("#track-order-step-results").hidden = true;
        $("#track-order-step-customer");
        $("#track-order-step-verify").hidden = false;

        var titleEl = $("#track-order-title");

        if (titleEl) {
          titleEl.textContent = "Track Your Order";
        }

      }
    );

  [
    "#track-bill-id",
    "#track-contact-no",
    "#track-gstin"
  ].forEach(
    function (sel) {

      $(sel).addEventListener(
        "keydown",
        function (e) {

          if (e.key === "Enter") {
            verifyTrackOrder();
          }

        }
      );

    }
  );

  [
    "#trk-from-date",
    "#trk-to-date",
    "#trk-status-filter"
  ].forEach(
    function (sel) {

      $(sel).addEventListener(
        "change",
        renderTrackOrderCards
      );

    }
  );

}


function verifyTrackOrder() {

  var billId =
    (
      $("#track-bill-id").value ||
      ""
    ).trim();

  var contact =
    (
      $("#track-contact-no").value ||
      ""
    ).trim();

  var gstin =
    (
      $("#track-gstin").value ||
      ""
    ).trim()
      .toUpperCase();

  var result =
    $("#track-order-result");

  if (!billId) {

    result.innerHTML =
      '<div style="color:#b42318;">' +
      "Please enter your Order / Dummy Bill ID." +
      "</div>";

    return;
  }

  if (!contact && !gstin) {

    result.innerHTML =
      '<div style="color:#b42318;">' +
      "Please enter your Contact Number or GSTIN." +
      "</div>";

    return;
  }

  var button =
    $("#track-order-verify");

  button.disabled =
    true;

  button.textContent =
    "Verifying...";

  result.innerHTML =
    '<div style="color:#666;">' +
    "Verifying order..." +
    "</div>";

  var params =
    new URLSearchParams();

  params.set("bill_id", billId);

  if (contact) {
    params.set("contact_no", contact);
  }

  if (gstin) {
    params.set("gstin", gstin);
  }

  fetch(
    "/api/method/ratan_bandhu.api.track_customer_orders?" +
    params.toString(),
    {
      method: "GET",
      credentials: "same-origin",
      headers: {
        "Accept": "application/json"
      }
    }
  )

  .then(function (response) {

    return response.json();

  })

  .then(function (data) {

    button.disabled =
      false;

    button.textContent =
      "Verify & Track";

    var response =
      data.message || data;

    if (!response || !response.success) {

      result.innerHTML =
        '<div style="color:#b42318;">' +
        escapeDummyBillHtml(
          (response && response.message) ||
          "We couldn't verify that order. Please check the details and try again."
        ) +
        "</div>";

      return;
    }

    trackOrderCustomerName =
      response.customer_name ||
      response.customer ||
      "";

    trackOrderAllResults =
      Array.isArray(response.orders) ?
        response.orders :
        [];

    showTrackOrderResults();

  })

  .catch(function (error) {

    console.error(
      "Order tracking error:",
      error
    );

    button.disabled =
      false;

    button.textContent =
      "Verify & Track";

    result.innerHTML =
      '<div style="color:#b42318;">' +
      "Unable to verify your order right now. Please try again." +
      "</div>";

  });

}


function showTrackOrderResults() {

  $("#track-order-step-verify").hidden = true;
  $("#track-order-step-results").hidden = false;

  var titleEl = $("#track-order-title");

  if (titleEl) {
    titleEl.textContent = "Your Orders";
  }

  var summary = $("#track-order-summary");

  var n = trackOrderAllResults.length;

  if (summary) {

    summary.textContent =
      (
        trackOrderCustomerName ?
          trackOrderCustomerName + " · " :
          ""
      ) +
      n +
      (n === 1 ? " order found" : " orders found");

  }

  var statusSelect = $("#trk-status-filter");

  if (statusSelect) {

    var statuses = [];

    trackOrderAllResults.forEach(function (o) {

      if (o.status && statuses.indexOf(o.status) < 0) {
        statuses.push(o.status);
      }

    });

    statusSelect.innerHTML =
      '<option value="">All statuses</option>';

    statuses.forEach(function (s) {

      var opt = document.createElement("option");

      opt.value = s;
      opt.textContent = s;

      statusSelect.appendChild(opt);

    });

  }

  var fromDate = $("#trk-from-date");
  var toDate = $("#trk-to-date");

  if (fromDate) fromDate.value = "";
  if (toDate) toDate.value = "";

  renderTrackOrderCards();

}


function trackStatusClass(status) {

  var key =
    String(status || "")
      .trim()
      .toLowerCase();

  return "trk-status-" + (key || "draft").replace(/\s+/g, "-");

}


function renderTrackOrderCards() {

  var grid = $("#track-order-cards");

  if (!grid) {
    return;
  }

  var fromDate = ($("#trk-from-date").value || "").trim();
  var toDate = ($("#trk-to-date").value || "").trim();
  var status = ($("#trk-status-filter").value || "").trim();

  var list = trackOrderAllResults.filter(function (o) {

    if (status && o.status !== status) {
      return false;
    }

    if (fromDate && o.date && o.date < fromDate) {
      return false;
    }

    if (toDate && o.date && o.date > toDate) {
      return false;
    }

    return true;

  });

  grid.innerHTML = "";

  if (!list.length) {

    grid.innerHTML =
      '<div class="trk-empty">No orders match these filters.</div>';

    return;

  }

  list.forEach(function (o) {

    var card = document.createElement("div");

    card.className = "trk-card";

    card.innerHTML =

      '<div class="trk-card-head">' +
      '<div>' +
      '<div class="trk-card-id">' +
      escapeDummyBillHtml(o.name) +
      (o.date ? " · " + escapeDummyBillHtml(o.date) : "") +
      "</div>" +
      '<div class="trk-card-name">' +
      escapeDummyBillHtml(o.item_name || o.item_code || "") +
      "</div>" +
      "</div>" +
      '<span class="trk-status ' +
      trackStatusClass(o.status) +
      '">' +
      escapeDummyBillHtml(o.status || "Draft") +
      "</span>" +
      "</div>" +

      '<div class="trk-card-row"><span>Supplier</span><span>' +
      escapeDummyBillHtml(o.supplier || "—") +
      "</span></div>" +

      '<div class="trk-card-row"><span>Quantity</span><span>' +
      escapeDummyBillHtml(String(o.quantity != null ? o.quantity : "—")) +
      "</span></div>" +

      '<div class="trk-card-row"><span>Rate</span><span>' +
      escapeDummyBillHtml(money(o.rate)) +
      "</span></div>" +

      '<div class="trk-card-row"><span>Amount</span><span>' +
      escapeDummyBillHtml(money(o.amount)) +
      "</span></div>";

    grid.appendChild(card);

  });

}


/* -----------------------------------------------------------------
   SAFE HTML HELPER
   ----------------------------------------------------------------- */

function escapeDummyBillHtml(
  value
) {

  return String(
    value == null
      ? ""
      : value
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}

  /* -----------------------------------------------------------------
     CONTACT + WHATSAPP
     ----------------------------------------------------------------- */

  (function wireContact() {

    var general =
      waLink(
        "Hello " +
        CONFIG.company +
        ", I saw your website and would like to enquire about your fabrics."
      );


    $$("[data-wa='general']")
      .forEach(
        function (a) {

          a.href =
            general;

          a.target =
            "_blank";

          a.rel =
            "noopener";

        }
      );


    var phone =
      $("#contact-phone");


    if (phone) {

      phone.textContent =
        CONFIG.phoneDisplay;

      phone.href =
        "tel:" +
        CONFIG.phoneDial;

    }


    var mailHref =
      "mailto:" +
      CONFIG.email +
      "?subject=" +
      encodeURIComponent(
        "Fabric enquiry from your website"
      );


    var email =
      $("#contact-email");


    if (email) {

      email.textContent =
        CONFIG.email;

      email.href =
        mailHref;

    }


    var contactMail =
      $("#contact-mail");


    if (contactMail) {

      contactMail.href =
        mailHref;

    }


    $$("[data-wa='general']")
      .forEach(
        function (a) {

          if (
            a.textContent.trim() ===
            "+91 00000 00000"
          ) {

            a.textContent =
              CONFIG.phoneDisplay;

          }

        }
      );


    var year =
      $("#year");


    if (year) {

      year.textContent =
        new Date()
          .getFullYear();

    }

  })();


  /* -----------------------------------------------------------------
     TRACK ORDER — NAV / FOOTER WIRING
     ----------------------------------------------------------------- */

  (function wireTrackOrder() {

    var triggers =
      [
        "#nav-track-order",
        "#footer-track-order"
      ];

    triggers.forEach(function (sel) {

      var el = $(sel);

      if (!el) {
        return;
      }

      el.addEventListener("click", function (e) {

        e.preventDefault();

        closeMenu();

        openTrackOrderFlow();

      });

    });

  })();


  /* -----------------------------------------------------------------
     START
     ----------------------------------------------------------------- */

  loadWebsiteProducts();

})();