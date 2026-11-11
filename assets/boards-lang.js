(function () {
  function applyTitle() {
    var en = document.documentElement.lang === "en";
    var title = en ? document.body.dataset.titleEn : document.body.dataset.titleZh;
    if (title) document.title = title;
  }

  document.querySelectorAll("[data-set-lang]").forEach(function (button) {
    button.addEventListener("click", function () {
      var lang = button.getAttribute("data-set-lang") === "en" ? "en" : "zh-Hant";
      try {
        localStorage.setItem("plume-light-language", lang);
      } catch (error) {
        /* keep the visible language even if storage is blocked */
      }
      document.documentElement.lang = lang === "en" ? "en" : "zh-Hant";
      applyTitle();
    });
  });
  applyTitle();
})();
