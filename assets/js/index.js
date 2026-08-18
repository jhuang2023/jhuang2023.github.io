(function () {
  var STORAGE_KEY = "site-theme";
  var DARK = "dark";
  var LIGHT = "light";

  function getStoredTheme() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === DARK || stored === LIGHT) {
        return stored;
      }
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  function getPreferredTheme() {
    var stored = getStoredTheme();
    if (stored) {
      return stored;
    }
    // Default: light background
    return LIGHT;
  }

  function isDarkTheme() {
    if (document.body.classList.contains("theme-light")) {
      return false;
    }
    if (document.body.classList.contains("dark")) {
      return true;
    }
    // Default is light when neither class is set yet
    return false;
  }

  function applyTheme(theme) {
    var isDark = theme === DARK;
    document.body.classList.toggle("dark", isDark);
    document.body.classList.toggle("theme-light", !isDark);
    document.documentElement.setAttribute("data-theme", theme);

    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.setAttribute(
        "aria-label",
        isDark ? "Switch to light theme" : "Switch to dark theme"
      );
      toggle.setAttribute(
        "title",
        isDark ? "Switch to light theme" : "Switch to dark theme"
      );
    }
  }

  function setTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      /* ignore */
    }
    applyTheme(theme);
  }

  function init() {
    applyTheme(getPreferredTheme());

    var toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        setTheme(isDarkTheme() ? LIGHT : DARK);
        // Prevent sticky focus styles after a mouse click.
        toggle.blur();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
