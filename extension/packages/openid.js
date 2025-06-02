function base64urlEncode(bytes) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

class OpenidConfiguration {
  /**
   * @type {{
   *  issuer: string,
   *  authorization_endpoint: string,
   *  token_endpoint: string,
   *  registration_endpoint: string,
   *  introspection_endpoint: string,
   * }}
   */
  cached = null;
  constructor(/** @type {string} */ domain) {
    this.domain = domain;
  }
  async get() {
    if (this.cached) {
      return this.cached;
    }
    // prettier-ignore
    let response = await fetch(`${this.domain}/.well-known/openid-configuration`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch well-known configuration: ${response.status}`
      );
    }
    this.cached = await response.json();
    return this.cached;
  }
}

export class Openid {
  constructor(/** @type {string} */ url) {
    this.url = url;
    let domain = new URL(url).origin;
    this.openid_configuration = new OpenidConfiguration(domain);
  }

  async register(
    /** @type {{ client_name: string, redirect_uris: Array<string> }} */ options
  ) {
    let openid_configuration = await this.openid_configuration.get();
    let registration_response = await fetch(
      openid_configuration.registration_endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          redirect_uris: options.redirect_uris,
          client_name: options.client_name,
          grant_types: ["authorization_code"],
          response_types: ["code"],
        }),
      }
    );
    if (!registration_response.ok) {
      // prettier-ignore
      throw new Error(`Failed to register client: ${registration_response.status}`);
    }

    /**
     * @type {{
     * client_id: string,
     * client_secret: string,
     * registration_access_token: string,
     * }}
     */
    let registration_data = await registration_response.json();
    return registration_data;
  }

  async authorization_url(
    /** @type {{ client_id: string, redirect_uri: string, scope: Array<string> }} */ options
  ) {
    let openid_configuration = await this.openid_configuration.get();

    let code_verifier = base64urlEncode(
      crypto.getRandomValues(new Uint8Array(32))
    );
    let code_challenge = await crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(code_verifier))
      .then((hash) => {
        return base64urlEncode(new Uint8Array(hash));
      });

    let auth_url = new URL(openid_configuration.authorization_endpoint);
    auth_url.searchParams.set("client_id", options.client_id);
    auth_url.searchParams.set("response_type", "code");
    auth_url.searchParams.set("scope", options.scope.join(" "));
    // auth_url.searchParams.set("redirect_uri", options.redirect_uri);
    auth_url.searchParams.set("code_challenge", code_challenge);
    auth_url.searchParams.set("code_challenge_method", "S256");
    return {
      url: auth_url.toString(),
      code_verifier: code_verifier,
    };
  }

  async parse_redirect_url(/** @type {string} */ url) {
    let redirect_url = new URL(url);
    let code = redirect_url.searchParams.get("code");
    if (!code) {
      throw new Error(`No code found in redirect URL: ${url}`);
    }
    return { code };
  }

  async fetch_token(
    /** @type {{ client_id: string, client_secret: string, code: string, redirect_uri: string, code_verifier: string }} */ options
  ) {
    let openid_configuration = await this.openid_configuration.get();

    let searchparams = new URLSearchParams();
    searchparams.set("client_id", options.client_id);
    searchparams.set("client_secret", options.client_secret);
    searchparams.set("grant_type", "authorization_code");
    searchparams.set("code", options.code);
    searchparams.set("redirect_uri", options.redirect_uri);
    searchparams.set("code_verifier", options.code_verifier);

    let response = await fetch(openid_configuration.token_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: searchparams,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch token: ${response.status}`);
    }
    /**
     * @type {{
     *  access_token: string,
     *  token_type: string,
     *  expires_in: number,
     *  scope: string,
     * }}
     */
    let result = await response.json();
    return result;
  }

  /**
   * This doesn't yet work.. it currently always returns { active: false }
   */
  async introspect(
    /** @type {{ access_token: string, client_id: string, client_secret: string }} */ options
  ) {
    let openid_configuration = await this.openid_configuration.get();
    let response = await fetch(openid_configuration.introspection_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Authorization: `Bearer ${access_token}`,
      },
      body: new URLSearchParams({
        token: options.access_token,
        client_id: options.client_id,
        client_secret: options.client_secret,
      }),
    });
    if (!response.ok) {
      throw new Error(`Failed to introspect token: ${response.status}`);
    }
    /**
     * @type {{
     *  active: boolean,
     * }}
     */
    let result = await response.json();
    return result;
  }
}
