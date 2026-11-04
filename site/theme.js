// Sets data-theme before first paint: 'light', 'dark' or 'system' (the default). Load as a classic script in <head>.
// A button with data-theme-toggle flips between light and dark and remembers the choice.
(function () {
  var KEY = 'ds-theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function read() { try { return localStorage.getItem(KEY) || 'system'; } catch (e) { return 'system'; } }
  function apply(choice) {
    var dark = choice === 'dark' || (choice === 'system' && media && media.matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.style.colorScheme = dark ? 'dark' : 'light';
  }
  apply(read());
  if (media && media.addEventListener) media.addEventListener('change', function () { if (read() === 'system') apply('system'); });
  window.dsTheme = {
    get: read,
    set: function (choice) {
      try { if (choice === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, choice); } catch (e) {}
      apply(choice);
    },
    toggle: function () { this.set(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }
  };
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.querySelector('[data-theme-toggle]');
    if (b) b.addEventListener('click', function () { window.dsTheme.toggle(); });
    document.querySelectorAll('details.nav-menu').forEach(function (m) {
      m.addEventListener('click', function (e) { if (e.target.closest('a')) m.open = false; });
      document.addEventListener('click', function (e) { if (m.open && !m.contains(e.target)) m.open = false; });
      m.addEventListener('keydown', function (e) { if (e.key === 'Escape' && m.open) { m.open = false; m.querySelector('summary').focus(); } });
    });
  });
})();
