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

(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reveals = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  } else {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });

    reveals.forEach(function (el) { observer.observe(el); });
  }

  if (reduce) return;

  Array.prototype.forEach.call(document.querySelectorAll(".toc li"), function (row) {
    row.addEventListener("pointermove", function (event) {
      if (event.pointerType === "touch") return;
      var box = row.getBoundingClientRect();
      var x = (event.clientX - box.left) / box.width - 0.5;
      var y = (event.clientY - box.top) / box.height - 0.5;
      row.style.transform = "translate3d(" + (x * 22).toFixed(2) + "px, " + (y * 14 - 7).toFixed(2) + "px, 0)";
    });
    row.addEventListener("pointerleave", function () {
      row.style.transform = "";
    });
  });
})();
