(function () {
  const root = document.querySelector("[data-preview-glide]");
  const track = document.querySelector("[data-preview-track]");
  const slides = Array.from(document.querySelectorAll("[data-preview-slide]"));
  const dots = Array.from(document.querySelectorAll("[data-preview-dot]"));
  const prev = document.querySelector("[data-preview-prev]");
  const next = document.querySelector("[data-preview-next]");
  const preview = document.querySelector(".profile-preview");
  const projectTimeline = document.querySelector("[data-project-timeline]");
  const projectShell = document.querySelector("[data-project-timeline-shell]");
  const projectScrollHint = document.querySelector("[data-project-scroll-hint]");

  if (!root || !track || !slides.length || !preview) {
    return;
  }

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const intervalMs = 10000;
  const projectsSlideIndex = slides.findIndex(function (slide) {
    return Boolean(slide.querySelector("[data-project-timeline]"));
  });

  let index = 0;
  let timer = null;
  let projectRaf = null;
  let projectStartTimer = null;
  let previewPaused = false;
  let projectHoldUntil = 0;
  const projectSpeed = 0.35;
  const projectHoldMs = 1600;

  function projectsSlideActive() {
    return projectsSlideIndex >= 0 && index === projectsSlideIndex;
  }

  function updateProjectScrollHint() {
    if (!projectTimeline || !projectShell || !projectScrollHint) {
      return;
    }

    const maxScroll = projectTimeline.scrollHeight - projectTimeline.clientHeight;
    const canScrollMore = maxScroll > 8 && projectTimeline.scrollTop < maxScroll - 8;
    const show = projectsSlideActive() && canScrollMore;

    projectShell.classList.toggle("is-hoverable", show);
    projectScrollHint.hidden = !show;
  }

  function stopProjectAutoScroll() {
    if (projectStartTimer) {
      window.clearTimeout(projectStartTimer);
      projectStartTimer = null;
    }
    if (projectRaf) {
      window.cancelAnimationFrame(projectRaf);
      projectRaf = null;
    }
  }

  function projectTick(now) {
    projectRaf = null;

    if (previewPaused || !projectsSlideActive() || !projectTimeline) {
      return;
    }

    const maxScroll = projectTimeline.scrollHeight - projectTimeline.clientHeight;
    if (maxScroll <= 2) {
      updateProjectScrollHint();
      projectRaf = window.requestAnimationFrame(projectTick);
      return;
    }

    if (now < projectHoldUntil) {
      projectRaf = window.requestAnimationFrame(projectTick);
      return;
    }

    projectTimeline.scrollTop += projectSpeed;
    updateProjectScrollHint();

    if (projectTimeline.scrollTop >= maxScroll - 0.5) {
      projectHoldUntil = now + projectHoldMs;
      projectTimeline.scrollTop = 0;
      updateProjectScrollHint();
    }

    projectRaf = window.requestAnimationFrame(projectTick);
  }

  function startProjectAutoScroll() {
    if (!projectTimeline || previewPaused || !projectsSlideActive()) {
      return;
    }

    stopProjectAutoScroll();
    updateProjectScrollHint();

    projectStartTimer = window.setTimeout(function () {
      projectStartTimer = null;
      if (previewPaused || !projectsSlideActive() || projectRaf) {
        return;
      }
      projectHoldUntil = 0;
      projectRaf = window.requestAnimationFrame(projectTick);
    }, 400);
  }

  function updateArrows() {
    if (prev) {
      const atStart = index <= 0;
      prev.hidden = atStart;
      prev.setAttribute("aria-hidden", atStart ? "true" : "false");
      prev.tabIndex = atStart ? -1 : 0;
    }
    if (next) {
      const atEnd = index >= slides.length - 1;
      next.hidden = atEnd;
      next.setAttribute("aria-hidden", atEnd ? "true" : "false");
      next.tabIndex = atEnd ? -1 : 0;
    }
  }

  function setSlide(nextIndex) {
    index = Math.max(0, Math.min(nextIndex, slides.length - 1));
    track.style.transform = "translateX(-" + index * 100 + "%)";

    slides.forEach(function (slide, i) {
      const active = i === index;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", active ? "false" : "true");
    });

    dots.forEach(function (dot, i) {
      const active = i === index;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-selected", active ? "true" : "false");
    });

    updateArrows();
    updateProjectScrollHint();

    stopProjectAutoScroll();
    if (projectsSlideActive()) {
      startProjectAutoScroll();
    } else if (projectTimeline) {
      projectTimeline.scrollTop = 0;
      updateProjectScrollHint();
    }
  }

  function stopCarousel() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function startCarousel() {
    if (previewPaused || reduceMotion || slides.length < 2) {
      return;
    }
    stopCarousel();
    timer = window.setInterval(function () {
      if (previewPaused) {
        stopCarousel();
        return;
      }
      setSlide(index >= slides.length - 1 ? 0 : index + 1);
    }, intervalMs);
  }

  function pausePreview() {
    previewPaused = true;
    stopCarousel();
    stopProjectAutoScroll();
  }

  function resumePreview() {
    previewPaused = false;
    startCarousel();
    startProjectAutoScroll();
  }

  function go(delta) {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= slides.length) {
      return;
    }
    setSlide(nextIndex);
    startCarousel();
  }

  dots.forEach(function (dot) {
    dot.addEventListener("click", function () {
      const nextIndex = Number(dot.getAttribute("data-preview-dot"));
      if (Number.isNaN(nextIndex)) {
        return;
      }
      setSlide(nextIndex);
      startCarousel();
    });
  });

  if (prev) {
    prev.addEventListener("click", function () {
      go(-1);
    });
  }

  if (next) {
    next.addEventListener("click", function () {
      go(1);
    });
  }

  if (projectTimeline) {
    projectTimeline.addEventListener("scroll", updateProjectScrollHint, { passive: true });
    window.addEventListener("resize", updateProjectScrollHint);
  }

  if (projectScrollHint && projectTimeline) {
    projectScrollHint.addEventListener("click", function () {
      projectTimeline.scrollBy({
        top: Math.max(120, Math.floor(projectTimeline.clientHeight * 0.45)),
        behavior: reduceMotion ? "auto" : "smooth",
      });
    });
  }

  preview.addEventListener("pointerenter", pausePreview);
  preview.addEventListener("pointerleave", resumePreview);
  preview.addEventListener("focusin", pausePreview);
  preview.addEventListener("focusout", function (event) {
    if (!preview.contains(event.relatedTarget)) {
      resumePreview();
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopCarousel();
      stopProjectAutoScroll();
    } else if (!previewPaused) {
      startCarousel();
      startProjectAutoScroll();
    }
  });

  setSlide(0);
  startCarousel();

  window.addEventListener("site-lang-change", function () {
    updateProjectScrollHint();
    if (projectsSlideActive()) {
      startProjectAutoScroll();
    }
  });
})();
