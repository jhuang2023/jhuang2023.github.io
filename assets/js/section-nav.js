(function () {
  var nav = document.querySelector(".section-nav");
  if (!nav) {
    return;
  }

  var ACTIVE = "is-active";
  var STORAGE_KEY = "section-nav-collapsed";
  var IDLE_DELAY = 1600;
  var RAIL_MAX_VIEWPORT_RATIO = 0.33; /* ~300px drawer: hand over to the compact carousel below ~900px windows */
  var WAKE_SECTIONS = 3; /* section boundaries crossed before the rail wakes */
  var WAKE_WINDOW = 3000; /* ms those crossings have to happen within */
  var LOCK_SETTLE = 180; /* ms of stillness after a click before the spy resumes */
  var LOCK_MAX = 1400;
  var toggle = document.getElementById("section-nav-toggle");
  var drawer = document.getElementById("section-nav-drawer");
  var body = document.body;
  var idleTimer = null;
  var pinnedOpen = false; /* user opened the rail on purpose; resets on reload */
  var lockedSection = null;
  var lockTimer = null;
  var lockDeadline = 0;
  var crossings = [];
  var spySection = null;
  var carouselFrame = null;

  function currentLang() {
    return document.documentElement.getAttribute("data-site-lang") === "zh"
      ? "zh"
      : "en";
  }

  function isDesktopNav() {
    return window.matchMedia("(min-width: 769px)").matches;
  }

  function isRailNav() {
    return isDesktopNav() && !body.classList.contains("section-nav-compact");
  }

  function isCollapsed() {
    return body.classList.contains("section-nav-collapsed");
  }

  function shouldUseCompactNav() {
    if (!isDesktopNav() || !drawer) {
      return true;
    }
    var drawerWidth = parseFloat(window.getComputedStyle(drawer).width) || 0;
    return drawerWidth / Math.max(window.innerWidth, 1) > RAIL_MAX_VIEWPORT_RATIO;
  }

  function syncResponsiveMode() {
    var compact = shouldUseCompactNav();
    body.classList.toggle("section-nav-compact", compact);
    nav.classList.toggle("is-compact", compact);

    if (compact) {
      clearIdleTimer();
      setIdle(false);
      body.classList.remove("section-nav-collapsed");
      nav.classList.remove("is-collapsed");
    }
  }

  function clearIdleTimer() {
    if (idleTimer !== null) {
      window.clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function setIdle(isIdle) {
    if (pinnedOpen || !isRailNav() || isCollapsed()) {
      isIdle = false;
    }
    nav.classList.toggle("is-idle", isIdle);
    refreshToggleLabel();
  }

  function scheduleIdleHide() {
    clearIdleTimer();
    if (pinnedOpen || !isRailNav() || isCollapsed()) {
      setIdle(false);
      return;
    }
    idleTimer = window.setTimeout(function () {
      setIdle(true);
    }, IDLE_DELAY);
  }

  function revealOnActivity() {
    if (pinnedOpen || !isRailNav() || isCollapsed()) {
      return;
    }
    setIdle(false);
    scheduleIdleHide();
  }

  function visibleProfile() {
    return document.querySelector(
      '.profile-lang[data-i18n="' + currentLang() + '"]'
    );
  }

  function visiblePanel() {
    return nav.querySelector('.section-nav-panel[data-i18n="' + currentLang() + '"]');
  }

  function mobilePanel(lang) {
    return nav.querySelector(
      '.section-nav-mobile > .section-nav-mobile-panel[data-i18n="' +
        lang +
        '"]'
    );
  }

  /* The rail reads as "hidden" both when pinned shut and when it auto-hid. */
  function refreshToggleLabel() {
    if (!toggle) {
      return;
    }
    var hidden = isCollapsed() || nav.classList.contains("is-idle");
    var lang = currentLang();
    var key = hidden
      ? lang === "zh"
        ? "data-label-expand-zh"
        : "data-label-expand-en"
      : lang === "zh"
        ? "data-label-collapse-zh"
        : "data-label-collapse-en";
    var label =
      toggle.getAttribute(key) ||
      (hidden ? "Expand navigation" : "Collapse navigation");
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
    toggle.setAttribute("aria-expanded", hidden ? "false" : "true");
  }

  function measureNavWidth() {
    if (!isDesktopNav() || !drawer) {
      return;
    }

    var panel = visiblePanel();
    var header = nav.querySelector(".section-nav-header");
    if (!panel) {
      return;
    }

    var probe = document.createElement("div");
    /* the clones must sit under a .section-nav ancestor, or none of the
       drawer typography applies and the measurement comes out tiny */
    probe.className = "section-nav";
    probe.style.cssText =
      "position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;width:max-content;";
    var panelClone = panel.cloneNode(true);
    panelClone.removeAttribute("data-i18n");
    panelClone.style.display = "block";
    /* Measure every row as if active: the active row is weight 500, a few px
       wider than 400, and the list is bound to the drawer width now, so an
       under-measured drawer would wrap whichever heading is highlighted. */
    panelClone.querySelectorAll(".section-nav-link").forEach(function (link) {
      link.classList.add(ACTIVE);
    });
    probe.appendChild(panelClone);
    if (header) {
      var headerClone = header.cloneNode(true);
      headerClone.querySelectorAll("[data-i18n]").forEach(function (el) {
        var show =
          el.getAttribute("data-i18n") === currentLang() ||
          !el.hasAttribute("data-i18n");
        if (!show && el.classList.contains("section-nav-label")) {
          el.style.display = "none";
        }
      });
      probe.insertBefore(headerClone, probe.firstChild);
    }
    document.body.appendChild(probe);

    var styles = window.getComputedStyle(drawer);
    var pad =
      (parseFloat(styles.paddingLeft) || 0) +
      (parseFloat(styles.paddingRight) || 0);
    /* The probe holds only header + panel, so add the progress gutter back. */
    var gutter = 0;
    var indexRow = nav.querySelector(".section-nav-index");
    if (indexRow) {
      var track = indexRow.querySelector(".section-nav-progress");
      var gap = parseFloat(window.getComputedStyle(indexRow).columnGap);
      gutter =
        (isNaN(gap) ? 0 : gap) +
        (track ? track.getBoundingClientRect().width : 0);
    }

    var width = Math.ceil(probe.scrollWidth + pad + gutter + 2);
    document.body.removeChild(probe);

    /* Plain px: html is 10px (Bootstrap 3), so "N * 16" rem maths lands wrong. */
    var min = 260;
    var max = Math.min(400, window.innerWidth * 0.42);
    width = Math.max(min, Math.min(max, width));

    body.style.setProperty("--section-nav-expanded-width", width + "px");
  }

  function setCollapsed(collapsed) {
    if (!collapsed) {
      measureNavWidth();
    }

    clearIdleTimer();
    body.classList.toggle("section-nav-collapsed", collapsed);
    nav.classList.toggle("is-collapsed", collapsed);
    setIdle(false);
    refreshToggleLabel();

    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    } catch (e) {
      /* ignore */
    }

    if (!collapsed) {
      scheduleIdleHide();
    }
  }

  function ensureLinkVisible(link) {
    if (!isDesktopNav()) {
      return;
    }

    var scroller = nav.querySelector(".section-nav-body") || nav;
    var top = link.offsetTop;
    var bottom = top + link.offsetHeight;
    var viewTop = scroller.scrollTop;
    var viewBottom = viewTop + scroller.clientHeight;
    if (top < viewTop + 8) {
      scroller.scrollTop = Math.max(0, top - 12);
    } else if (bottom > viewBottom - 8) {
      scroller.scrollTop = bottom - scroller.clientHeight + 12;
    }
  }

  function mobileSectionLinks() {
    return Array.prototype.slice.call(
      nav.querySelectorAll(
        '.section-nav-mobile > .section-nav-mobile-panel[data-i18n="' +
          currentLang() +
          '"] .section-nav-link'
      )
    );
  }

  /*
    Carousel slides scale with how close they are to the middle: `--nav-t`
    goes 0 (a full slide away) → 1 (centred), repainted every scroll frame so
    an item grows on its way in instead of popping once it snaps.
  */
  function paintCarousel(viewport) {
    if (!viewport || !viewport.clientWidth) {
      return;
    }
    var list = viewport.querySelector(".section-nav-list");
    if (!list) {
      return;
    }

    var center = viewport.scrollLeft + viewport.clientWidth / 2;
    Array.prototype.forEach.call(list.children, function (slide) {
      var width = slide.offsetWidth || 1;
      var distance = Math.abs(slide.offsetLeft + width / 2 - center) / width;
      var linear = Math.max(0, Math.min(1, 1 - distance));
      var eased = linear * linear * (3 - 2 * linear);
      slide.style.setProperty("--nav-t", eased.toFixed(3));
    });
  }

  function paintCarousels() {
    nav.querySelectorAll("[data-section-nav-mobile-viewport]").forEach(paintCarousel);
  }

  function schedulePaint() {
    if (carouselFrame !== null) {
      return;
    }
    carouselFrame = window.requestAnimationFrame(function () {
      carouselFrame = null;
      paintCarousels();
    });
  }

  function centerMobileSlide(index, behavior) {
    var panel = mobilePanel(currentLang());
    var viewport = panel
      ? panel.querySelector("[data-section-nav-mobile-viewport]")
      : null;
    var links = mobileSectionLinks();
    var slide = links[index] ? links[index].closest("li") : null;

    if (!viewport || !slide) {
      return;
    }

    var left =
      slide.offsetLeft - (viewport.clientWidth - slide.offsetWidth) / 2;
    var maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    viewport.scrollTo({
      left: Math.min(maxLeft, Math.max(0, left)),
      behavior: behavior || "auto"
    });
    schedulePaint();
  }

  function syncMobileCurrent(sectionId, shouldCenter) {
    if (!sectionId) {
      return;
    }

    var links = mobileSectionLinks();
    if (!links.length) {
      return;
    }

    var index = -1;
    var items = links.map(function (link, i) {
      var id = link.getAttribute("data-nav-section");
      var match = id === sectionId;
      link.classList.toggle(ACTIVE, match);
      if (match) {
        link.setAttribute("aria-current", "true");
        index = i;
      } else {
        link.removeAttribute("aria-current");
      }
      return {
        id: id,
        label: link.getAttribute("data-nav-label") || (link.textContent || "").trim()
      };
    });

    if (index < 0) {
      index = 0;
    }

    links.forEach(function (link, i) {
      link.closest("li").classList.toggle("is-active", i === index);
    });

    var mobileCount = nav.querySelector("[data-section-nav-mobile-count]");
    var mobileProgress = nav.querySelector(
      "[data-section-nav-mobile-progress-bar]"
    );
    var desktopCount = nav.querySelector("[data-section-nav-count]");
    var desktopProgress = nav.querySelector("[data-section-nav-progress-bar]");
    var position = index + 1;
    var total = items.length;
    var ratio = position / Math.max(total, 1);
    var formatted = function (value) {
      return String(value).padStart(2, "0");
    };

    if (mobileCount) {
      mobileCount.textContent = formatted(position) + " / " + formatted(total);
    }
    if (desktopCount) {
      desktopCount.textContent = formatted(position) + " / " + formatted(total);
    }
    if (mobileProgress) {
      mobileProgress.style.width = ratio * 100 + "%";
    }
    if (desktopProgress) {
      /* Desktop track is vertical, so progress grows downward. */
      desktopProgress.style.height = ratio * 100 + "%";
    }
    if (shouldCenter !== false) {
      centerMobileSlide(index, "smooth");
    }
  }

  function setActive(sectionId, fromCarousel) {
    var panel = visiblePanel();
    if (panel) {
      panel.querySelectorAll(".section-nav-link").forEach(function (link) {
        var match = link.getAttribute("data-nav-section") === sectionId;
        link.classList.toggle(ACTIVE, match);
        if (match) {
          link.setAttribute("aria-current", "true");
          ensureLinkVisible(link);
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }
    syncMobileCurrent(sectionId, !fromCarousel);
  }

  function sectionsInView() {
    var root = visibleProfile();
    if (!root) {
      return [];
    }
    return Array.prototype.slice.call(
      root.querySelectorAll("[data-section-id][id]")
    );
  }

  /* Sticky chrome sits over the top of the page in compact/mobile mode. */
  function scrollOffset() {
    if (isRailNav()) {
      return 20;
    }
    return Math.round((nav.getBoundingClientRect().height || 0) + 12);
  }

  function spyMarker() {
    return scrollOffset() + Math.min(120, window.innerHeight * 0.18);
  }

  function documentTop(el) {
    return el.getBoundingClientRect().top + window.scrollY;
  }

  function atPageBottom() {
    var doc = document.documentElement;
    return window.scrollY + window.innerHeight >= doc.scrollHeight - 4;
  }

  function updateFromScroll() {
    if (lockedSection) {
      return;
    }

    var sections = sectionsInView();
    if (!sections.length) {
      return;
    }

    var current;
    if (atPageBottom()) {
      /* The final section is usually too short to ever cross the marker. */
      current = sections[sections.length - 1];
    } else {
      var marker = window.scrollY + spyMarker();
      current = sections[0];
      for (var i = 0; i < sections.length; i++) {
        if (documentTop(sections[i]) - 4 <= marker) {
          current = sections[i];
        } else {
          break;
        }
      }
    }

    var sectionId = current.getAttribute("data-section-id");
    noteCrossing(sectionId);
    setActive(sectionId);
  }

  /*
    Waking the rail takes a deliberate sweep — WAKE_SECTIONS boundaries crossed
    inside WAKE_WINDOW — so ordinary reading never pops it open.
  */
  function noteCrossing(sectionId) {
    if (sectionId === spySection) {
      return;
    }

    var first = spySection === null;
    spySection = sectionId;
    if (first) {
      return;
    }

    var now = Date.now();
    crossings.push(now);
    while (crossings.length && now - crossings[0] > WAKE_WINDOW) {
      crossings.shift();
    }
    if (crossings.length >= WAKE_SECTIONS) {
      crossings.length = 0;
      revealOnActivity();
    }
  }

  function updateFromMobileCarousel(viewport) {
    if (lockedSection) {
      return;
    }

    var panel = viewport.closest(".section-nav-mobile-panel");
    var links = panel
      ? Array.prototype.slice.call(panel.querySelectorAll(".section-nav-link"))
      : [];
    if (!links.length) {
      return;
    }

    var center = viewport.scrollLeft + viewport.clientWidth / 2;
    var closest = links[0];
    var closestDistance = Infinity;

    links.forEach(function (link) {
      var slide = link.closest("li");
      var slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      var distance = Math.abs(slideCenter - center);
      if (distance < closestDistance) {
        closest = link;
        closestDistance = distance;
      }
    });

    var sectionId = closest.getAttribute("data-nav-section");
    if (sectionId) {
      setActive(sectionId, true);
    }
  }

  function initMobileCarousel() {
    nav.querySelectorAll("[data-section-nav-mobile-viewport]").forEach(function (viewport) {
      var scrollTimer = null;
      viewport.addEventListener(
        "scroll",
        function () {
          schedulePaint();
          window.clearTimeout(scrollTimer);
          scrollTimer = window.setTimeout(function () {
            updateFromMobileCarousel(viewport);
          }, 110);
        },
        { passive: true }
      );
    });
    paintCarousels();
  }

  /*
    A click owns the highlight until the page stops moving, otherwise the
    sections crossed on the way to the target keep stealing it back — that was
    the "click twice to select" bug.
  */
  function releaseLockSoon() {
    window.clearTimeout(lockTimer);
    lockTimer = window.setTimeout(function () {
      lockedSection = null;
    }, LOCK_SETTLE);
  }

  function lockActive(sectionId) {
    lockedSection = sectionId;
    lockDeadline = Date.now() + LOCK_MAX;
    releaseLockSoon();
  }

  function goToSection(href) {
    var target =
      href && href.charAt(0) === "#"
        ? document.getElementById(href.slice(1))
        : null;
    if (!target) {
      return false;
    }

    window.scrollTo({
      top: Math.max(0, documentTop(target) - scrollOffset()),
      behavior: "smooth"
    });
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", href);
    }
    return true;
  }

  function onClick(event) {
    var link = event.target.closest(".section-nav-link");
    if (!link || !nav.contains(link)) {
      return;
    }
    if (
      event.defaultPrevented ||
      event.button > 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    var href = link.getAttribute("href");
    var sectionId = link.getAttribute("data-nav-section");
    if (sectionId) {
      lockActive(sectionId);
      setActive(sectionId);
    }

    if (goToSection(href)) {
      event.preventDefault();
    }
    revealOnActivity();
  }

  function initCollapse() {
    if (!toggle) {
      return;
    }

    var stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }

    measureNavWidth();
    syncResponsiveMode();
    setCollapsed(stored === "1" && isRailNav());

    toggle.addEventListener("click", function () {
      if (!isDesktopNav()) {
        return;
      }

      if (!isCollapsed() && nav.classList.contains("is-idle")) {
        /* Waking the rail by hand pins it open for the rest of the visit. */
        pinnedOpen = true;
        clearIdleTimer();
        setIdle(false);
        toggle.blur();
        return;
      }

      pinnedOpen = isCollapsed();
      setCollapsed(!isCollapsed());
      toggle.blur();
    });
  }

  function onWindowScroll() {
    var now = Date.now();

    if (lockedSection) {
      if (now > lockDeadline) {
        lockedSection = null;
      } else {
        releaseLockSoon();
        return;
      }
    }

    updateFromScroll();
  }

  function init() {
    nav.addEventListener("click", onClick);
    window.addEventListener("scroll", onWindowScroll, { passive: true });
    nav.addEventListener("mouseenter", revealOnActivity);
    nav.addEventListener("focusin", revealOnActivity);
    nav.addEventListener("mouseleave", scheduleIdleHide);
    window.addEventListener("resize", function () {
      syncResponsiveMode();
      if (!isRailNav()) {
        clearIdleTimer();
        setIdle(false);
      }
      if (!isDesktopNav()) {
        body.classList.remove("section-nav-collapsed");
        nav.classList.remove("is-collapsed");
        body.style.removeProperty("--section-nav-expanded-width");
      } else if (!body.classList.contains("section-nav-compact")) {
        measureNavWidth();
      }
      crossings.length = 0;
      updateFromScroll();
      paintCarousels();
    });
    window.addEventListener("site-lang-change", function () {
      refreshToggleLabel();
      measureNavWidth();
      syncResponsiveMode();
      scheduleIdleHide();
      updateFromScroll();
      paintCarousels();
    });

    initMobileCarousel();
    initCollapse();
    updateFromScroll();

    /* Roboto lands after DOMContentLoaded; measured in the fallback font the
       drawer comes out ~2px narrow and the highlighted heading wraps. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (isRailNav()) {
          measureNavWidth();
        }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
