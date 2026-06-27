// Show the current app version as a chip next to the "Kube Inspector" title
// in the header. The version is injected at build time via a <meta> tag
// (see overrides/main.html + mkdocs_hooks.py on_config).
(function () {
  function init() {
    var meta = document.querySelector('meta[name="ki-app-version"]');
    var version = meta && meta.getAttribute('content');
    if (!version) return;

    var topic = document.querySelector('.md-header__title .md-header__topic');
    if (!topic || topic.querySelector('.ki-ver-chip')) return;

    var chip = document.createElement('span');
    chip.className = 'ki-ver-chip';
    chip.textContent = version;
    topic.appendChild(chip);
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
