// Changelog timeline interactivity: click a version to expand/collapse its
// details, and drive the center line's "progress" fill as the page scrolls.
// The reveal-on-scroll animation is handled separately by reveal.js (.ki-reveal).
(function () {
  var REDUCE = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initToggle() {
    var heads = document.querySelectorAll('.ki-cl-head');
    heads.forEach(function (head) {
      head.addEventListener('click', function () {
        var item = head.closest('.ki-cl-item');
        if (!item) return;
        var open = item.classList.toggle('is-open');
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }

  function initProgress() {
    var line = document.querySelector('.ki-cl-timeline');
    if (!line) return;
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll('.ki-cl-item')
    );

    function update() {
      var rect = line.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      // How far the viewport's mid-line has travelled through the timeline.
      var mid = vh * 0.5;
      var progress = (mid - rect.top) / Math.max(rect.height, 1);
      progress = Math.max(0, Math.min(1, progress));
      line.style.setProperty('--ki-cl-progress', progress.toFixed(4));

      // Light up nodes the progress line has passed.
      nodes.forEach(function (item) {
        var node = item.querySelector('.ki-cl-node');
        if (!node) return;
        var nrect = node.getBoundingClientRect();
        if (nrect.top + nrect.height / 2 <= mid) {
          item.classList.add('is-passed');
        } else {
          item.classList.remove('is-passed');
        }
      });
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        update();
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  function init() {
    if (!document.querySelector('.ki-cl-timeline')) return;
    initToggle();
    if (!REDUCE) initProgress();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
