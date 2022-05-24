(async () => {
  let host = window.location.host;
  let { [host]: css } = await browser.storage.local.get([host]);

  if (css == null) {
    return;
  }

  let style = document.createElement("style");
  // style.innerHTML = css.replace(/(?:!important)? *;(\n|$)/gm, " !important;$1");
  style.innerHTML = Array.isArray(css)
    ? css.map((x) => x.code).join("\n\n")
    : css;
  style.dataset.dralStyled = true;
  document.head.appendChild(style);
})();
