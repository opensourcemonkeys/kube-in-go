// Sponsor pill in the header, immediately left of the GitHub repo link — and
// in the drawer on small screens, where Material moves the repo link too
// (it hides .md-header__source below 60em and shows .md-nav__source instead).
//
// Injected from JS rather than a template override on purpose: Material's
// partials/header.html has no Jinja block to hook into, so adding the link
// there would mean vendoring the whole partial into overrides/ — and CI
// installs mkdocs-material unpinned, so that copy would silently drift on the
// next release. Same approach as version-chip.js.
//
// The URL comes from a <meta> tag written at build time from
// mkdocs.yml `extra.sponsor_url` (see overrides/main.html), so the link lives
// in exactly one place.
(function () {
  // Octicon "heart" (outline) — matches the GitHub Sponsors button.
  var HEART =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" aria-hidden="true">' +
    '<path fill="currentColor" d="M8 14.25l.345.666a.75.75 0 0 1-.69 0l-.008-.004-.018-.01a7.152 7.152 0 0 1-.31-.17 22.055 22.055 0 0 1-3.434-2.414C2.045 10.731 0 8.35 0 5.5 0 2.836 2.086 1 4.25 1 5.797 1 7.153 1.802 8 3.02 8.847 1.802 10.203 1 11.75 1 13.914 1 16 2.836 16 5.5c0 2.85-2.045 5.231-3.885 6.818a22.066 22.066 0 0 1-3.744 2.584l-.018.01-.006.003h-.002zM4.25 2.5c-1.336 0-2.75 1.164-2.75 3 0 2.15 1.58 4.144 3.365 5.682A20.58 20.58 0 0 0 8 13.393a20.58 20.58 0 0 0 3.135-2.211C12.92 9.644 14.5 7.65 14.5 5.5c0-1.836-1.414-3-2.75-3-1.373 0-2.609.986-3.029 2.456a.75.75 0 0 1-1.442 0C6.859 3.486 5.623 2.5 4.25 2.5z"/>' +
    '</svg>';

  function meta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el && el.getAttribute('content');
  }

  function build(url, label, variant) {
    var a = document.createElement('a');
    a.className = 'ki-sponsor ki-sponsor--' + variant;
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.title = 'Sponsor Kube Inspector';

    var icon = document.createElement('span');
    icon.className = 'ki-sponsor__icon';
    icon.innerHTML = HEART;

    var text = document.createElement('span');
    text.className = 'ki-sponsor__label';
    text.textContent = label;

    a.appendChild(icon);
    a.appendChild(text);
    return a;
  }

  function init() {
    var url = meta('ki-sponsor-url');
    if (!url) return;
    var label = meta('ki-sponsor-label') || 'Sponsor';

    // Header (>= 60em): sit just before the GitHub pill.
    var header = document.querySelector('.md-header__inner');
    if (header && !header.querySelector('.ki-sponsor')) {
      var source = header.querySelector('.md-header__source');
      var pill = build(url, label, 'header');
      if (source) header.insertBefore(pill, source);
      else header.appendChild(pill);
    }

    // Drawer (< 60em): below the repo link Material puts there.
    var navSource = document.querySelector('.md-nav--primary .md-nav__source');
    if (navSource && !navSource.querySelector('.ki-sponsor')) {
      navSource.appendChild(build(url, label, 'drawer'));
    }
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
