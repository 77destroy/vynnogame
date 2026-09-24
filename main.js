(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll(".rail a[href^='#']"));
  var pairs = links.map(function (link) {
    var id = link.getAttribute("href").slice(1);
    var section = document.getElementById(id);
    return section ? { link: link, section: section } : null;
  }).filter(Boolean);

  if (!pairs.length || !("IntersectionObserver" in window)) {
    return;
  }

  var setCurrent = function (id) {
    pairs.forEach(function (pair) {
      if (pair.section.id === id) {
        pair.link.setAttribute("aria-current", "true");
      } else {
        pair.link.removeAttribute("aria-current");
      }
    });
  };

  var observer = new IntersectionObserver(function (entries) {
    var visible = entries.filter(function (entry) {
      return entry.isIntersecting;
    });
    if (!visible.length) {
      return;
    }
    visible.sort(function (a, b) {
      return b.intersectionRatio - a.intersectionRatio;
    });
    setCurrent(visible[0].target.id);
  }, {
    rootMargin: "-30% 0px -45% 0px",
    threshold: [0.1, 0.25, 0.5, 0.75]
  });

  pairs.forEach(function (pair) {
    observer.observe(pair.section);
  });
})();
