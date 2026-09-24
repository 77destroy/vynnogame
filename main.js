(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll(".rail a[href^='#']"));
  var pairs = [];
  var seen = {};

  links.forEach(function (link) {
    var id = link.getAttribute("href").slice(1);
    var section = document.getElementById(id);
    if (!section || seen[id]) return;
    seen[id] = true;
    pairs.push({ id: id, section: section });
  });

  if (!pairs.length) return;

  var setCurrent = function (id) {
    links.forEach(function (link) {
      if (link.getAttribute("href") === "#" + id) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  };

  var pick = function () {
    var doc = document.documentElement;
    var nearBottom = window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
    if (nearBottom) {
      setCurrent(pairs[pairs.length - 1].id);
      return;
    }
    var marker = window.scrollY + window.innerHeight * 0.32;
    var current = pairs[0].id;
    pairs.forEach(function (pair) {
      var top = pair.section.getBoundingClientRect().top + window.scrollY;
      if (top <= marker) current = pair.id;
    });
    setCurrent(current);
  };

  var scheduled = false;
  var onScroll = function () {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      pick();
    });
  };

  pick();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
})();
