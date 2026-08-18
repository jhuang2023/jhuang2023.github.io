(function () {
  var egg = document.querySelector("[data-profile-easter-egg]");
  var pageLayer = egg && egg.closest(".page-layer");
  if (!egg || !pageLayer) {
    return;
  }

  var RELEASE_DELAY = 260; /* long enough that wheel notches read as one gesture */
  var PULL_EASING = 0.24;
  var RELEASE_EASING = 0.16;

  var pull = 0;
  var targetPull = 0;
  var releaseTimer = null;
  var springFrame = null;
  var isReleasing = false;
  var touchY = null;

  /*
    Drive the lift with inline transforms on the handful of blocks that move.
    Writing an inherited custom property instead would invalidate styles for
    every node under .page-layer on each frame, which is what made the pull
    feel steppy on long pages.
  */
  var liftTargets = Array.prototype.slice.call(
    pageLayer.querySelectorAll(
      ":scope > .header-contianer, :scope > main > .wrapper, :scope > main > .container, :scope > .footer-container"
    )
  );

  /* The pull tops out at half a viewport, so the motto can be dragged well
     above the fold and stays there while the reader keeps scrolling down. */
  function maxPull() {
    return Math.round(window.innerHeight * 0.5);
  }

  function remainingScroll() {
    var root = document.documentElement;
    return Math.max(0, root.scrollHeight - (window.scrollY + window.innerHeight));
  }

  function moveToBottom() {
    window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function render() {
    var lift = Math.round(pull * 100) / 100;
    var shift = lift ? "translate3d(0," + -lift + "px,0)" : "";

    for (var i = 0; i < liftTargets.length; i++) {
      liftTargets[i].style.transform = shift;
    }
    egg.style.transform = lift
      ? "translate3d(0,calc(100% - " + lift + "px),0)"
      : "";
  }

  function stopSpring() {
    if (springFrame !== null) {
      window.cancelAnimationFrame(springFrame);
      springFrame = null;
    }
  }

  function animatePull() {
    var difference = targetPull - pull;
    var easing = isReleasing ? RELEASE_EASING : PULL_EASING;

    pull += difference * easing;
    if (Math.abs(difference) < 0.15) {
      pull = targetPull;
      render();
      springFrame = null;
      return;
    }

    render();
    springFrame = window.requestAnimationFrame(animatePull);
  }

  function startPullAnimation() {
    if (springFrame === null) {
      springFrame = window.requestAnimationFrame(animatePull);
    }
  }

  function scheduleRelease() {
    if (releaseTimer !== null) {
      window.clearTimeout(releaseTimer);
    }
    releaseTimer = window.setTimeout(function () {
      releaseTimer = null;
      releasePull();
    }, RELEASE_DELAY);
  }

  function releasePull() {
    if (releaseTimer !== null) {
      window.clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    if (pull > 0 || targetPull > 0) {
      targetPull = 0;
      isReleasing = true;
      startPullAnimation();
    }
  }

  function addPull(amount) {
    stopSpring();
    isReleasing = false;

    /* Rubber band: each further pixel of over-scroll buys a little less lift,
       but the bottom of the strip stays reachable with a steady scroll. */
    var limit = maxPull();
    var resistance = 1 - 0.55 * Math.min(1, targetPull / limit);
    targetPull = Math.min(
      limit,
      targetPull + Math.max(0, amount) * 0.55 * resistance
    );
    startPullAnimation();
    scheduleRelease();
  }

  function onWheel(event) {
    if (event.deltaY > 0) {
      var remaining = remainingScroll();

      if (remaining > event.deltaY) {
        if (pull > 0) {
          releasePull();
        }
        return;
      }

      event.preventDefault();
      if (remaining > 0) {
        moveToBottom();
      }
      addPull(Math.max(0, event.deltaY - remaining));
    } else if (pull > 0) {
      releasePull();
    }
  }

  function onTouchStart(event) {
    if (event.touches.length === 1) {
      touchY = event.touches[0].clientY;
      if (pull > 0) {
        releasePull();
      }
    }
  }

  function onTouchMove(event) {
    if (touchY === null || event.touches.length !== 1) {
      return;
    }

    var currentY = event.touches[0].clientY;
    var delta = touchY - currentY;
    touchY = currentY;
    if (delta > 0) {
      var remaining = remainingScroll();

      if (remaining > delta) {
        if (pull > 0) {
          releasePull();
        }
        return;
      }

      event.preventDefault();
      if (remaining > 0) {
        moveToBottom();
      }
      addPull(Math.max(0, delta - remaining));
    } else if (pull > 0) {
      releasePull();
    }
  }

  function onTouchEnd() {
    touchY = null;
    scheduleRelease();
  }

  document.addEventListener("wheel", onWheel, { passive: false });
  document.addEventListener("touchstart", onTouchStart, { passive: true });
  document.addEventListener("touchmove", onTouchMove, { passive: false });
  document.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("resize", function () {
    var limit = maxPull();
    if (targetPull > limit) {
      targetPull = limit;
      startPullAnimation();
    }
  });
})();
