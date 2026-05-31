import { Openid } from "../packages/openid.js";
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

let cached_sign_up = async (/** @type {string} */ pod_url) => {
  /** @type {{ access: { pod_url: string, access_token: string, client_id: string, client_secret: string } | null }} */
  let { access } = /** @type {any} */ (
    await browser.storage.local.get(["access"])
  );
  let openid = new Openid(pod_url);

  console.log("#1.1");
  if (access && access.pod_url === pod_url) {
    let openid = new Openid(pod_url);
    try {
      console.log(`access:`, access);
      console.log("#1.2");
      let pod = new SolidPod(pod_url, access.access_token);
      console.log("#1.3");
      await pod.getDirectoryHandle("paintbrush");
      console.log("#1.4");
      return {
        pod_url: access.pod_url,
        access_token: access.access_token,
      };
    } catch (error) {
      console.log("No longer authenticated, reauthenticating...");

      let redirect_url = browser.identity.getRedirectURL();
      let auth_url = await openid.authorization_url({
        client_id: access.client_id,
        redirect_uri: access.client_secret,
        scope: ["openid", "profile", "email"],
        // response_type: "code",
      });

      console.log(`auth_url:`, auth_url);

      let x = await browser.identity.launchWebAuthFlow({
        url: auth_url.url,
        // @ts-ignore
        // redirect_uri: redirect_url,
        interactive: false,
      });

      console.log(`x:`, x);

      let { code } = await openid.parse_redirect_url(x);
      console.log(`code:`, code);

      let data = await openid.fetch_token({
        client_secret: access.client_secret,
        client_id: access.client_id,
        code: code,
        code_verifier: auth_url.code_verifier,
        redirect_uri: redirect_url,
      });

      console.log(`data:`, data);
      await browser.storage.local.set({
        access: {
          pod_url: pod_url,
          access_token: data.access_token,
          client_id: access.client_id,
          client_secret: access.client_secret,
        },
      });
      return {
        access_token: data.access_token,
        pod_url: pod_url,
      };
    }
  } else {
    console.log("#2");
    let redirect_url = browser.identity.getRedirectURL();

    let { client_id, client_secret } = await openid.register({
      redirect_uris: [redirect_url],
      client_name: "Paintbrush Extension",
    });

    console.log(`client_id:`, client_id);

    try {
      let auth_url = await openid.authorization_url({
        client_id: client_id,
        redirect_uri: redirect_url,
        scope: ["openid", "profile", "email"],
        // response_type: "code",
      });

      console.log(`auth_url:`, auth_url);

      let x = await browser.identity.launchWebAuthFlow({
        url: auth_url.url,
        // @ts-ignore
        // redirect_uri: redirect_url,
        interactive: true,
      });

      console.log(`x:`, x);

      let { code } = await openid.parse_redirect_url(x);
      console.log(`code:`, code);
      let data = await openid.fetch_token({
        client_secret: client_secret,
        client_id: client_id,
        code: code,
        code_verifier: auth_url.code_verifier,
        redirect_uri: redirect_url,
      });
      console.log(`data:`, data);

      await browser.storage.local.set({
        access: {
          pod_url: pod_url,
          access_token: data.access_token,
          client_id: client_id,
          client_secret: client_secret,
        },
      });
      return {
        access_token: data.access_token,
        pod_url: pod_url,
      };
    } catch (error) {
      console.log(`error:`, error);
      throw error;
    }
  }
};

/**
 * @typedef MessageSender
 * @type {import("webextension-polyfill-ts").Runtime.MessageSender}
 */

let actions = {
  "get-css": async (
    /** @type {any | undefined} */ request,
    /** @type {MessageSender} */ sender
  ) => {
    let host = request.host;
    try {
      /** @type {{ access: { pod_url: string, access_token: string } | null }} */
      let { access } = /** @type {any} */ (
        await browser.storage.local.get(["access"])
      );

      if (!access) {
        console.warn("No access found, returning empty array");
        return;
      }

      let x = new SolidPod(access.pod_url, access.access_token);
      let paintbrush = await x.getDirectoryHandle("paintbrush");
      let file = await paintbrush.getFileHandle(`${host}.json`);
      let css = await (await file.getFile()).text();
      console.log("Got CSS for host:", host, css);
      return JSON.parse(css);
    } catch (error) {
      console.error("Error getting CSS:", error);
      /// Most likely no file found
      return [];
    }
  },
  "put-css": async (
    /** @type {any | undefined} */ request,
    /** @type {MessageSender} */ sender
  ) => {
    console.log("Putting css:", request);
    let host = request.host;
    let cells = request.cells;
    if (cells == null) {
      return null;
    }

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
  },

  "sign-in": async (
    /** @type {any | undefined} */ request,
    /** @type {MessageSender} */ sender
  ) => {
    let pod_url = request.pod_url;
    if (!pod_url) {
      throw new Error("No pod URL provided");
    }
    return await cached_sign_up(pod_url);
  },
};

browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  let handler = actions[request.action];
  if (handler) {
    return handler(request, sender);
  }
});
