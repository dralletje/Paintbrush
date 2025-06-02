import { SolidFileHandle, SolidPod } from "../packages/solid-pod.js";
import { browser } from "../Vendor/Browser.js";

let async = async (async) => async();

browser.runtime.onStartup.addListener(async () => {});
browser.runtime.onInstalled.addListener(async () => {
  console.log("INSTALLED");

  let { access } = /** @type {any} */ (
    await browser.storage.local.get(["access"])
  );

  if (!access) {
    return;
  }

  let x = new SolidPod(access.pod_url, access.access_token);
  let paintbrush = await x.getDirectoryHandle("paintbrush");
  for await (let entry of paintbrush.values()) {
    try {
      if (entry.name.endsWith(".json") && entry instanceof SolidFileHandle) {
        let file = await entry.getFile();
        let fileContent = await file.text();
        await browser.storage.local.set({
          [`host-${file.name.replace(/\.json$/, "")}`]: JSON.parse(fileContent),
        });
        console.log(`${entry.name}:`, JSON.parse(fileContent));
      }
    } catch (error) {
      console.log(`${entry.name} error:`, error);
    }
  }
});

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get-css") {
    let host = request.host;
    return async(async () => {
      try {
        /** @type {{ access: { pod_url: string, access_token: string } | null }} */
        let { access } = /** @type {any} */ (
          await browser.storage.local.get(["access"])
        );

        if (!access) {
          return;
        }

        let x = new SolidPod(access.pod_url, access.access_token);
        let paintbrush = await x.getDirectoryHandle("paintbrush");
        let file = await paintbrush.getFileHandle(`${host}.json`);
        let css = await (await file.getFile()).text();
        return JSON.parse(css);
      } catch (error) {
        /// Most likely no file found
        return [];
      }
    });
  } else if (request.action === "put-css") {
    console.log("Putting css:", request);
    let host = request.host;
    let cells = request.cells;
    if (cells == null) {
      return Promise.resolve(null);
    }

    return async(async () => {
      /// Set the cells in local storage as well
      browser.storage.local.set({ [`host-${host}`]: cells });

      /** @type {{ access: { pod_url: string, access_token: string } | null }} */
      let { access } = /** @type {any} */ (
        await browser.storage.local.get(["access"])
      );

      if (!access) {
        return;
      }

      let x = new SolidPod(access.pod_url, access.access_token);
      let paintbrush = await x.getDirectoryHandle("paintbrush");
      let file = await paintbrush.getFileHandle(`${host}.json`, {
        create: true,
      });
      await file.write(
        new Blob([JSON.stringify(cells)], { type: "application/json" })
      );
      return null;
    });
  }
});
