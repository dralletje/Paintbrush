import { browser } from "../Vendor/Browser.js";

// let myStyleHashesString =
//   "'sha256-x+i+3ZnRP8ueHrf5twXz59kIq9e0Mc6peRLTpH4Em3A='";

let myStyleHashesString = "'nonce-1234567890abcdefg'";

browser.webRequest.onHeadersReceived.addListener(
  function (details) {
    let cspHeaderFoundAndModified = false;
    console.log(`details:`, details);
    for (let i = 0; i < details.responseHeaders.length; i++) {
      const header = details.responseHeaders[i];

      console.log(`header.name.toLowerCase():`, header.name.toLowerCase());
      if (header.name.toLowerCase() === "content-security-policy") {
        let cspValue = header.value;

        // Attempt to add hashes to an existing style-src directive
        if (cspValue.includes("style-src")) {
          // This is a simple regex; complex CSPs might need more robust parsing.
          // It appends the hashes to the first style-src directive found.
          console.log(`cspValue:`, cspValue);
          let new_value = cspValue.replace(
            /style-src\s+([^;]+)/,
            `style-src $1 ${myStyleHashesString}`
          );

          console.log(`new_value:`, new_value);
          header.value = new_value;
        } else {
          // If no style-src, append it. This assumes default-src might be in play
          // or that you want style-src to be explicitly set.
          // Ensure there's a semicolon if adding to an existing policy, or handle if it's the first directive.
          // if (cspValue.trim() !== "" && !cspValue.trim().endsWith(";")) {
          //   cspValue += ";";
          // }
          // header.value = `${cspValue} style-src ${myStyleHashesString}`;
        }
        cspHeaderFoundAndModified = true;
        break; // Modify only the first CSP header found. Adjust if multiple CSP headers need handling.
      }
    }

    // If no CSP header was found, add a new one with the style hashes.
    // This will create a CSP that *only* allows these styles and anything else implied by a missing default-src.
    // This might be too restrictive if the page relied on having no CSP or a very loose one.
    if (!cspHeaderFoundAndModified && details.responseHeaders) {
      details.responseHeaders.push({
        name: "Content-Security-Policy",
        value: `style-src ${myStyleHashesString}`, // Or default-src 'none'; style-src ${myStyleHashesString}
      });
    }
    return { responseHeaders: details.responseHeaders };
  },
  { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
  ["blocking", "responseHeaders"]
);
