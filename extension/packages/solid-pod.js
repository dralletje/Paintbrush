let create_folder = async (
  /** @type {{ url: string, token: string }} */ options
) => {
  if (!options.url.endsWith("/")) {
    throw new Error("URL must end with a slash");
  }

  let response = await fetch(options.url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/ld+json",
      Authorization: `Bearer ${options.token}`,
      Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"',
    },
    body: JSON.stringify({
      "@context": {
        ldp: "http://www.w3.org/ns/ldp#",
      },
      "@id": "",
      "@type": ["ldp:BasicContainer", "ldp:Container"],
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Failed to create folder: ${response.status}: ${await response.text()}`
    );
  }
};

let head_folder = async (
  /** @type {{ url: string, token: string }} */ options
) => {
  let response = await fetch(options.url, {
    method: "HEAD",
    headers: {
      Authorization: `Bearer ${options.token}`,
    },
  });

  if (response.status === 404) {
    return false; // Folder does not exist
  } else if (!response.ok) {
    throw new Error(`Failed to check folder: ${response.status}`);
  } else {
    return true;
  }
};

let delete_folder = async (
  /** @type {{ url: string, token: string }} */ options
) => {
  let response = await fetch(options.url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${options.token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to delete folder: ${response.status}`);
  }
};

let upload_file = async (
  /** @type {{ url: string, token: string, file: File }} */ options
) => {
  let response = await fetch(options.url, {
    method: "PUT",
    headers: {
      "Content-Type": options.file.type,
      Authorization: `Bearer ${options.token}`,
      Link: '<http://www.w3.org/ns/ldp#Resource>; rel="type"',
    },
    body: options.file,
  });
  if (!response.ok) {
    throw new Error(
      `Failed to upload file: ${response.status}: ${await response.text()}`
    );
  }
};

/**
 * @implements {FileSystemFileHandle}
 */
export class SolidFileHandle {
  kind = /** @type {"file"} */ ("file");

  constructor(/** @type {string} */ url, /** @type {string} */ token) {
    this.url = url;
    this.token = token;
  }

  async isSameEntry(/** @type {FileSystemHandle} */ other) {
    if (!(other instanceof SolidFileHandle)) {
      return false;
    }
    return this.url === other.url && this.token === other.token;
  }

  async getFile() {
    let response = await fetch(this.url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status}`);
    }
    let blob = await response.blob();
    return new File([blob], this.name, { type: blob.type });
  }

  /** @returns {Promise<FileSystemWritableFileStream>} */
  async createWritable() {
    throw new Error("Not implemented");
  }

  /**
   * NON STANDARD
   */
  async write(/** @type {Blob} */ blob) {
    await upload_file({
      url: this.url,
      token: this.token,
      file: new File([blob], this.name, { type: blob.type }),
    });
  }

  get name() {
    return new URL(this.url).pathname.split("/").pop();
  }
}

/**
 * @returns {AsyncGenerator<[string, SolidFileHandle | SolidPod], void, unknown>}
 */
async function* solidpod_iterator(
  /** @type {string} */ url,
  /** @type {string} */ token
) {
  if (!url.endsWith("/")) {
    throw new Error("URL must end with a slash");
  }

  let response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/ld+json",
    },
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch directory: ${response.status}`);
  }
  let data = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Expected an array of entries");
  }
  for (let entry of data) {
    let relative = entry["@id"].slice(url.length);
    if (relative === "") {
      // Skip the directory itself
      continue;
    }

    if (
      entry["@type"] &&
      entry["@type"].includes("http://www.w3.org/ns/ldp#Resource")
    ) {
      // It's a file
      yield [
        relative,
        new SolidFileHandle(new URL(entry["@id"], url).href, token),
      ];
    } else if (
      entry["@type"] &&
      entry["@type"].includes("http://www.w3.org/ns/ldp#BasicContainer")
    ) {
      // It's a directory
      yield [relative, new SolidPod(new URL(entry["@id"], url).href, token)];
    } else {
      yield [
        relative,
        new SolidFileHandle(new URL(entry["@id"], url).href, token),
      ];
      // throw new Error(`Unknown entry type: ${JSON.stringify(entry)}`);
    }
  }
}

/**
 * @implements {FileSystemDirectoryHandle}
 */
export class SolidPod {
  kind = /** @type {"directory"} */ ("directory");

  constructor(/** @type {string} */ url, /** @type {string} */ token) {
    if (!url.endsWith("/")) {
      throw new Error("URL must end with a slash");
    }
    this.url = url;
    this.token = token;
  }

  [Symbol.asyncIterator]() {
    return solidpod_iterator(this.url, this.token);
  }
  entries() {
    return solidpod_iterator(this.url, this.token);
  }
  async *values() {
    for await (let [name, handle] of solidpod_iterator(this.url, this.token)) {
      yield handle;
    }
  }
  async *keys() {
    for await (let [name, handle] of solidpod_iterator(this.url, this.token)) {
      yield name;
    }
  }

  async isSameEntry(/** @type {FileSystemHandle} */ other) {
    if (!(other instanceof SolidPod)) {
      return false;
    }
    return this.url === other.url && this.token === other.token;
  }

  async getDirectoryHandle(
    /** @type {string} */ name,
    /** @type {{ create: boolean }} */ options = { create: false }
  ) {
    if (name.includes("/")) {
      throw new Error("Name must not contain slashes");
    }

    let fullUrl = `${this.url}${name}/`;

    let head = await head_folder({
      url: fullUrl,
      token: this.token,
    });

    if (!head && options.create) {
      await create_folder({ url: fullUrl, token: this.token });
      return new SolidPod(fullUrl, this.token);
    } else if (!head) {
      /// TODO Should be DOMException("NotFoundError")
      throw new Error(`Folder does not exist: ${fullUrl}`);
    } else {
      return new SolidPod(fullUrl, this.token);
    }
  }

  async getFileHandle(
    /** @type {string} */ name,
    /** @type {FileSystemGetFileOptions} */ options = { create: false }
  ) {
    if (name.includes("/")) {
      throw new Error("Name must not contain slashes");
    }

    let head = await head_folder({
      url: `${this.url}${name}`,
      token: this.token,
    });

    if (!head && options.create) {
      /// Should `touch` the file as well to be consistent with the directory handle?
      return new SolidFileHandle(`${this.url}${name}`, this.token);
    } else if (!head) {
      /// TODO Should be DOMException("NotFoundError")
      throw new Error(`File does not exist: ${this.url}${name}`);
    } else {
      return new SolidFileHandle(`${this.url}${name}`, this.token);
    }
  }

  get name() {
    return new URL(this.url).pathname.replace(/\/$/, "");
  }

  async removeEntry(
    /** @type {string} */ name,
    /** @type {{ recursive: boolean }} */ options = { recursive: false }
  ) {
    throw new Error("Not implemented");
  }

  /** @returns {any} */
  resolve(/** @type {FileSystemHandle} */ handle) {
    throw new Error("Not implemented");
  }
}
