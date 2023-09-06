let Modulus: number = 65536;
const salt: string = '${ThatIsTheSaltInTheSoupAndItJustTastesWayTooMuchLikeSaltEvenThoughSaltIsImportantAndIsAlsoNeededByTheHumanBody}';

function nextRandom(X: number, modulus: number): number {
  /* Methode: Lineare Kongruenz =>  X[i] = (a * X[i-1] + b) mod m    */
  /* Mit den gewählten Parametern ergibt sich eine maximale Periode, */
  /* welches unabhängig von gewählten Startwert ist(?).              */
  const y: number = (17 * X + 1) % modulus;
  return y;
}

function crypt_HGC(EinText: string, key: string | number, encrypt: boolean): string {
  let out: string = "";
  let Sign: number, i: number, X: number = 255;
  Modulus = 65536;

  if (typeof key === 'string') {
    for (i = 0; i < key.length; i++)
      X = (X * key.charCodeAt(i)) % Modulus;
  } else {
    key = Number(key);
    if (isNaN(key))
      key = 3333;
    else if (key < 0)
      key = key * -1;
  }

  i = 0;
  while (i < EinText.length) {
    X = nextRandom(X, Modulus);
    Sign = EinText.charCodeAt(i) ^ ((X >> 8) & 255);

    if (typeof key === 'string') {
      Sign = Sign ^ key.charCodeAt(i % key.length);
    } else {
      Sign = Sign ^ key;
    }

    if (encrypt)
      X = X ^ Sign;
    else
      X = X ^ EinText.charCodeAt(i);

    out = out + String.fromCharCode(Sign);
    i++;
  }

  return out;
}

function encrypt(text: string, key?: string | number): string {
  key = typeof key === 'undefined' ? salt : key;
  return encodeURI(crypt_HGC(text, key, true));
}

function decrypt(chiffre: string, key?: string | number): string {
  key = typeof key === 'undefined' ? salt : key;
  return crypt_HGC(decodeURI(chiffre), key, false);
}

function promisifyRequest<T = string>(request: IDBRequest<T> | IDBTransaction, crypt: string, key: IDBValidKey): Promise<T> {
  let cipher: any = "";

  return new Promise<T>((resolve, reject) => {
    // @ts-ignore - file size hacks
    request.oncomplete = request.onsuccess = () => { const res = request.result;

      if (typeof res != 'undefined' && key === 'activeUser') {
        console.log(`DEBUG - promisify (${key} | ${crypt}) res: ${JSON.stringify(res).substring(0, 100)}`);

        if (crypt === 'encrypt') {
          cipher = encrypt(JSON.stringify(res));
          console.log(`DEBUG - promisify (${crypt}) cipher: ${JSON.stringify(cipher).substring(0, 100)}`);
        } else if (crypt === 'decrypt') {
          cipher = JSON.parse(decrypt(res).replaceAll("\\", ""));
          console.log(`DEBUG - promisify (${crypt}) cipher: ${JSON.stringify(cipher).substring(0, 100)}`);
        }
      }

      if (cipher != "" && key === 'activeUser') {
        resolve(cipher);
      } else {
        resolve(res);
      }
    };

    // @ts-ignore - file size hacks
    request.onabort = request.onerror = () => reject(request.error);
  });
}


function createStore(dbName: string, storeName: string) {
  const request = indexedDB.open(dbName);
  request.onupgradeneeded = () => request.result.createObjectStore(storeName);
  const dbp = promisifyRequest(request, "", "");
  
  return (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) =>
    dbp.then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}

let defaultGetStoreFunc: ((txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>);

function defaultGetStore() {
  if (!defaultGetStoreFunc) {
    defaultGetStoreFunc = createStore('keyval-store', 'keyval');
  }
  return defaultGetStoreFunc;
}

/**
 * Get a value by its key.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function get(key: IDBValidKey, customStore = defaultGetStore()): Promise<any> {
  return customStore('readonly', (store) => promisifyRequest(store.get(key), "decrypt", key));
}

/**
 * Set a value with a key.
 *
 * @param key
 * @param value
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function set(key: IDBValidKey, value: any, customStore = defaultGetStore()): Promise<void> {
  return customStore('readwrite', (store) => {
    store.put(value, key);
    return promisifyRequest(store.transaction, "encrypt", key);
  });
}

/**
 * Set multiple values at once. This is faster than calling set() multiple times.
 * It's also atomic – if one of the pairs can't be added, none will be added.
 *
 * @param entries Array of entries, where each entry is an array of `[key, value]`.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function setMany(entries: [IDBValidKey, any][], customStore = defaultGetStore()): Promise<void> {
  return customStore('readwrite', (store) => {
    entries.forEach((entry) => store.put(entry[1], entry[0]));
    return promisifyRequest(store.transaction, "", "");
  });
}

/**
 * Get multiple values by their keys
 *
 * @param keys
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function getMany(keys: IDBValidKey[], customStore = defaultGetStore()): Promise<any[]> {
  return customStore('readonly', (store) =>
    Promise.all(keys.map((key) => promisifyRequest(store.get(key), "", "")))
  );
}

/**
 * Update a value. This lets you see the old value and update it as an atomic operation.
 *
 * @param key
 * @param updater A callback that takes the old value and returns a new value.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function update(key: IDBValidKey, updater: (oldValue: any) => any, customStore = defaultGetStore()): Promise<void> {
  return customStore('readwrite', (store) =>
    // Need to create the promise manually.
    // If I try to chain promises, the transaction closes in browsers
    // that use a promise polyfill (IE10/11).
    new Promise<void>((resolve, reject) => {
      store.get(key).onsuccess = function () {
        try {
          store.put(updater(this.result), key);
          resolve(promisifyRequest(store.transaction, "", ""));
        } catch (err) {
          reject(err);
        }
      };
    })
  );
}

/**
 * Delete a particular key from the store.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function del(key: IDBValidKey, customStore = defaultGetStore()): Promise<void> {
  return customStore('readwrite', (store) => {
    store.delete(key);
    return promisifyRequest(store.transaction, "", "");
  });
}

/**
 * Delete multiple keys at once.
 *
 * @param keys List of keys to delete.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function delMany(keys: IDBValidKey[], customStore = defaultGetStore()): Promise<void> {
  return customStore('readwrite', (store) => {
    keys.forEach((key) => store.delete(key));
    return promisifyRequest(store.transaction, "", "");
  });
}

/**
 * Clear all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function clear(customStore = defaultGetStore()): Promise<void> {
  return customStore('readwrite', (store) => {
    store.clear();
    return promisifyRequest(store.transaction, "", "");
  });
}

function eachCursor(store: IDBObjectStore, callback: (cursor: IDBCursorWithValue) => void): Promise<void> {
  store.openCursor().onsuccess = function () {
    if (!this.result)
      return;
    callback(this.result);
    this.result.continue();
  };
  return promisifyRequest(store.transaction, "", "");
}

/**
 * Get all keys in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function keys(customStore = defaultGetStore()): Promise<IDBValidKey[]> {
  return customStore('readonly', (store) => {
    // Fast path for modern browsers
    if (store.getAllKeys) {
      return promisifyRequest(store.getAllKeys(), "", "");
    }
    const items: IDBValidKey[] = [];
    return eachCursor(store, (cursor) => items.push(cursor.key)).then(() => items);
  });
}

/**
 * Get all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function values(customStore = defaultGetStore()): Promise<any[]> {
  return customStore('readonly', (store) => {
    // Fast path for modern browsers
    if (store.getAll) {
      return promisifyRequest(store.getAll(), "", "");
    }
    const items: any[] = [];
    return eachCursor(store, (cursor) => items.push(cursor.value)).then(() => items);
  });
}

/**
 * Get all entries in the store. Each entry is an array of `[key, value]`.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function entries(customStore = defaultGetStore()): Promise<[IDBValidKey, any][]> {
  return customStore('readonly', (store) => {
    // Fast path for modern browsers
    // (although, hopefully we'll get a simpler path some day)
    if (store.getAll && store.getAllKeys) {
      return Promise.all([
        promisifyRequest(store.getAllKeys(), "", ""),
        promisifyRequest(store.getAll(), "", ""),
      ]).then(([keys, values]) => keys.map((key, i) => [key, values[i]]));
    }
    const items: [IDBValidKey, any][] = [];
    return eachCursor(store, (cursor) => items.push([cursor.key, cursor.value])).then(() => items);
  });
}

export {
  clear,
  createStore,
  decrypt,
  del,
  delMany,
  encrypt,
  entries,
  get,
  getMany,
  keys,
  promisifyRequest,
  set,
  setMany,
  update,
  values
};
