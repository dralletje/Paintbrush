{
  // @ts-ignore
  // prettier-ignore
  const browser = /** @type {import("webextension-polyfill-ts").Browser} */ (globalThis.browser);

  let secret_id = "paintbrush-in-page-editor-asdasdasdasd";

  let URL_DEVELOPMENT = (path) => `http://localhost:3000/${path}`;
  let URL_PRODUCTION = (path) =>
    browser.runtime.getURL(`/in-page-editor-build/${path}`);

  let async = async (async) => async();

  let createElementFromHTML = (htmlString) => {
    let div = document.createElement("div");
    div.innerHTML = htmlString.trim();

    return div.firstChild;
  };

  let preexisting_conditions = document.querySelector(`#${secret_id}`);
  if (preexisting_conditions) {
    preexisting_conditions.remove();
  } else {
    async(async () => {
      // let { environment } = await browser.runtime.sendMessage({
      //   command: "get-environment",
      // });

      let { is_developer } = await browser.storage.local.get(["is_developer"]);

      let get_url = is_developer ? URL_DEVELOPMENT : URL_PRODUCTION;

      let injection = createElementFromHTML(`
        <div
          id="${secret_id}"
          style="
            position: fixed;
            right: 16px;
            bottom: 0;
            height: 60vh;
            min-height: 500px;
            max-height: 100vh;

            background-color: black;
            box-shadow: black 0px 0px 11px 0px, white 0px 0px 8px 0px;

            transform: translateX(calc(100% + 16px));
            transition: transform 0.5s;
            z-index: 99999;
          "
        >
          <iframe
            border="0"
            style="
              border: none;
              width: 400px;
              height: 100%;
            "
            src="${get_url("index.html")}"
          />
        </div>
      `);

      document.body.appendChild(injection);

      let contentWindow = injection.querySelector("iframe").contentWindow;

      window.addEventListener("message", (message) => {
        if (message.source !== contentWindow) return;

        if (message.data?.type === "css") {
          let styletag = document.querySelector(`[data-dral-styled]`);
          if (styletag == null) {
            styletag = document.createElement("style");
            styletag.dataset.dralStyled = true;
            document.head.appendChild(styletag);
          }
          styletag.innerHTML = message.data?.code;
        }

        if (message.data?.type === "ready") {
          console.log("READY!");
          // injection.style.display = "block";
          injection.style.transform = `translateX(0)`;
        }

        if (message.data?.type === "save") {
          let host = window.location.host;
          console.log("SAVED", message.data?.cells);
          browser.storage.local.set({ [host]: message.data?.cells });
        }

        if (message.data?.type === "load") {
          let host = window.location.host;
          browser.storage.local.get([host]).then(({ [host]: cells }) => {
            console.log("Retrieved", cells);
            contentWindow.postMessage({ type: "load", cells }, "*");
          });
        }

        if (message.data?.type === "toggle-horizontal-position") {
          if (injection.style.right !== "") {
            injection.style.right = "";
            injection.style.left = "16px";
          } else {
            injection.style.right = "16px";
            injection.style.left = "";
          }
        }

        console.log(`FROM IFRAME message:`, message);
      });
      console.log("Injected!");
    });
  }
}
