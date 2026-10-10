(function () {
  const buttons = document.querySelectorAll("nav button");
  const pages = document.querySelectorAll(".page");

  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      pages.forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.page).classList.add("active");
    });
  });
})();