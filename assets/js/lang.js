(function () {
  var STORAGE_KEY = "site-lang";
  var EN = "en";
  var ZH = "zh";

  function normalizeLang(lang) {
    return lang === ZH ? ZH : EN;
  }

  function siteRoot() {
    var base = document.documentElement.getAttribute("data-site-base");
    if (base == null || base === "") {
      return "";
    }
    return String(base).replace(/\/+$/, "") || "";
  }

  function getStoredLang() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === EN || stored === ZH) {
        return stored;
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  function getPathLang() {
    var root = siteRoot();
    var path = window.location.pathname || "/";
    if (root && path.indexOf(root) === 0) {
      path = path.slice(root.length) || "/";
    }
    var match = path.match(/^\/(en|zh)(?:\/|$)/);
    return match ? match[1] : null;
  }

  function isRootPath() {
    var root = siteRoot();
    var path = (window.location.pathname || "/").replace(/\/+$/, "") || "/";
    var rootPath = (root || "/").replace(/\/+$/, "") || "/";
    return path === rootPath;
  }

  function profileUrl(lang, slug) {
    var root = siteRoot();
    return (root || "") + "/" + normalizeLang(lang) + "/" + slug + "/";
  }

  function updateProfileLinks(lang) {
    var next = normalizeLang(lang);
    document.querySelectorAll("[data-profile-slug]").forEach(function (link) {
      var slug = link.getAttribute("data-profile-slug");
      if (!slug) {
        return;
      }
      link.setAttribute("href", profileUrl(next, slug));
    });
  }

  function applyLang(lang) {
    var next = normalizeLang(lang);
    document.documentElement.setAttribute("lang", next);
    document.documentElement.setAttribute("data-site-lang", next);

    var toggle = document.getElementById("lang-toggle");
    if (toggle) {
      var toZh = toggle.getAttribute("data-label-to-zh") || "切换到中文";
      var toEn = toggle.getAttribute("data-label-to-en") || "Switch to English";
      var label = next === ZH ? toEn : toZh;
      toggle.setAttribute("aria-label", label);
      toggle.setAttribute("title", label);
    }

    document.querySelectorAll("[data-print-action]").forEach(function (el) {
      var printLabel =
        next === ZH
          ? el.getAttribute("data-label-zh")
          : el.getAttribute("data-label-en");
      if (printLabel) {
        el.setAttribute("aria-label", printLabel);
        el.setAttribute("title", printLabel);
      }
    });

    if (isRootPath()) {
      updateProfileLinks(next);
    }

    try {
      window.dispatchEvent(
        new CustomEvent("site-lang-change", { detail: { lang: next } })
      );
    } catch (e) {
      /* ignore */
    }
  }

  function setLang(lang) {
    var next = normalizeLang(lang);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* ignore */
    }
    applyLang(next);
  }

  function init() {
    var pathLang = getPathLang();
    var initial = pathLang || getStoredLang() || EN;

    if (pathLang) {
      try {
        localStorage.setItem(STORAGE_KEY, pathLang);
      } catch (e) {
        /* ignore */
      }
    }

    applyLang(initial);

    var toggle = document.getElementById("lang-toggle");
    if (toggle && isRootPath()) {
      toggle.addEventListener("click", function () {
        var current =
          document.documentElement.getAttribute("data-site-lang") || EN;
        setLang(current === ZH ? EN : ZH);
        toggle.blur();
      });
    } else if (toggle) {
      toggle.hidden = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
