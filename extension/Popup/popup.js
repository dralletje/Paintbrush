import { browser } from "../Vendor/Browser.js";
import { Openid } from "../packages/openid.js";
import { SolidPod } from "../packages/solid-pod.js";

document
  .querySelector("#open-editor-button")
  .addEventListener("click", async () => {
    let [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });

    let x = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["/Contentscripts/editor-in-page.js"],
    });
    window.close();
  });

let dev_button = document.querySelector("#developer-button");

let render_dev_button = () => {
  browser.storage.local.get(["is_developer"]).then(({ is_developer }) => {
    dev_button.textContent = is_developer
      ? "Disable Developer Mode"
      : "Enable Developer Mode";
    dev_button.style.color = is_developer ? "#27d5ff" : "inherit";
  });
};

dev_button.addEventListener("click", async () => {
  let { is_developer } = await browser.storage.local.get(["is_developer"]);
  await browser.storage.local.set({ is_developer: !is_developer });
  render_dev_button();
});

render_dev_button();

// document
//   .querySelector("#options-button")
//   .addEventListener("click", async () => {
//     // let [current_tab] = await browser.tabs.query({
//     //   active: true,
//     //   currentWindow: true,
//     // });

//     // browser.tabs.create({
//     //   url: "options/index.html",
//     //   active: true,
//     // });

//     window.close();
//   });

let async = async (async) => async();

let sign_up_button = document.querySelector("#sign-up");
async(async () => {
  let POD_URL = "https://dral.solidcommunity.net/";

  let { access } = /** @type {any} */ (
    await browser.storage.local.get(["access"])
  );

  if (!access) {
    sign_up_button.textContent = "Sign In";
  } else {
    try {
      let openid = new Openid(POD_URL);
      let pod = new SolidPod(POD_URL, access.access_token);

      await pod.getDirectoryHandle("paintbrush");
      sign_up_button.textContent = "Sync";
    } catch (error) {
      /// Not authenticated for some reason
      sign_up_button.textContent = "Reauthenticate";
    }
  }
});

console.log("POPUP");

sign_up_button.addEventListener("click", async () => {
  console.log("#1");
  try {
    let WEBID_URL = "https://solidcommunity.net/profile/card#me";
    let POD_URL = "https://dral.solidcommunity.net/";

    // let data = await cached_sign_up(POD_URL);

    // console.log(`data:`, data);

    let x = await browser.runtime.sendMessage({
      action: "sign-in",
      pod_url: POD_URL,
    });
    console.log(`x:`, x);

    /// Get all storage keys
    // let storage_keys = await browser.storage.local.get();

    // console.log(`storage_keys:`, storage_keys);

    // let pod = new SolidPod(POD_URL, data.access_token);
    // let folder = await pod.getDirectoryHandle("paintbrush", { create: true });

    // for (let key in storage_keys) {
    //   console.log(`key:`, key);
    //   let value = storage_keys[key];
    //   console.log(`value:`, value);

    //   let file = await folder.getFileHandle(`${key}.json`, { create: true });
    //   await file.write(
    //     new File([JSON.stringify(value)], `${key}.json`, {
    //       type: "application/json",
    //     })
    //   );
    // }

    // await browser.storage.local.set({ is_developer: !is_developer });

    window.close();
  } catch (error) {
    console.error("Error during sign up:", error);
  }
});
