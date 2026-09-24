(() => {
  const items = document.querySelectorAll(".work-list li");
  if (items.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.25 }
    );
    items.forEach((el, i) => {
      el.style.transitionDelay = `${i * 0.12}s`;
      io.observe(el);
    });
  } else {
    items.forEach((el) => el.classList.add("is-in"));
  }

  const form = document.querySelector(".contact-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      form.classList.add("is-sent");
      const btn = form.querySelector(".btn-primary");
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = "Отправлено";
        btn.disabled = true;
        setTimeout(() => {
          btn.textContent = prev;
          btn.disabled = false;
          form.classList.remove("is-sent");
          form.reset();
        }, 2200);
      }
    });
  }
})();
