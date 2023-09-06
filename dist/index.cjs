'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

let Modulus = 65536;
const salt = '${ThatIsTheSaltInTheSoupAndItJustTastesWayTooMuchLikeSaltEvenThoughSaltIsImportantAndIsAlsoNeededByTheHumanBody}';
function nextRandom(X, modulus) {
    /* Methode: Lineare Kongruenz =>  X[i] = (a * X[i-1] + b) mod m    */
    /* Mit den gewählten Parametern ergibt sich eine maximale Periode, */
    /* welches unabhängig von gewählten Startwert ist(?).              */
    const y = (17 * X + 1) % modulus;
    return y;
}
function crypt_HGC(EinText, key, encrypt) {
    let out = "";
    let Sign, i, X = 255;
    Modulus = 65536;
    if (typeof key === 'string') {
        for (i = 0; i < key.length; i++)
            X = (X * key.charCodeAt(i)) % Modulus;
    }
    else {
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
        }
        else {
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
function encrypt(text, key) {
    key = typeof key === 'undefined' ? salt : key;
    return encodeURI(crypt_HGC(text, key, true));
}
function decrypt(chiffre, key) {
    key = typeof key === 'undefined' ? salt : key;
    return crypt_HGC(decodeURI(chiffre), key, false);
}
function promisifyRequest(request, crypt, key) {
    let cipher = "";
    return new Promise((resolve, reject) => {
        // @ts-ignore - file size hacks
        request.oncomplete = request.onsuccess = () => {
            const res = request.result;
            if (typeof res != 'undefined' && key === 'activeUser') {
                //console.log(`DEBUG - promisify (${key} | ${crypt}) res: ${JSON.stringify(res).substring(0, 100)}`);
                if (crypt === 'de') {
                    const str = decrypt(res).replaceAll("\\", "");
                    //console.log(`DEBUG - promisify (${crypt}) cipher-str: ${JSON.stringify(str).substring(0, 100)}`);
                    cipher = JSON.parse(str);
                    //console.log(`DEBUG - promisify (${crypt}) cipher: ${JSON.stringify(cipher).substring(0, 100)}`);
                }
            }
            if (cipher != "" && key === 'activeUser') {
                resolve(cipher);
            }
            else {
                resolve(res);
            }
        };
        // @ts-ignore - file size hacks
        request.onabort = request.onerror = () => reject(request.error);
    });
}
function createStore(dbName, storeName) {
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    const dbp = promisifyRequest(request, "", "");
    return (txMode, callback) => dbp.then((db) => callback(db.transaction(storeName, txMode).objectStore(storeName)));
}
let defaultGetStoreFunc;
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
function get(key, customStore = defaultGetStore()) {
    //console.log(`DEBUG - GET: ${JSON.stringify(key)}`);
    return customStore('readonly', (store) => promisifyRequest(store.get(key), "de", key));
}
/**
 * Set a value with a key.
 *
 * @param key
 * @param value
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function set(key, value, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        //console.log(`DEBUG - SET: ${JSON.stringify(key)} ==> ${JSON.stringify(value).substring(0, 100)}`);
        if (key === 'activeUser') {
            //console.log(`DEBUG - stored ${JSON.stringify(key)} encrypted...`);
            store.put(encrypt(JSON.stringify(value)), key);
        }
        else {
            store.put(value, key);
        }
        return promisifyRequest(store.transaction, "", "");
    });
}
/**
 * Set multiple values at once. This is faster than calling set() multiple times.
 * It's also atomic – if one of the pairs can't be added, none will be added.
 *
 * @param entries Array of entries, where each entry is an array of `[key, value]`.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function setMany(entries, customStore = defaultGetStore()) {
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
function getMany(keys, customStore = defaultGetStore()) {
    return customStore('readonly', (store) => Promise.all(keys.map((key) => promisifyRequest(store.get(key), "", ""))));
}
/**
 * Update a value. This lets you see the old value and update it as an atomic operation.
 *
 * @param key
 * @param updater A callback that takes the old value and returns a new value.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function update(key, updater, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => 
    // Need to create the promise manually.
    // If I try to chain promises, the transaction closes in browsers
    // that use a promise polyfill (IE10/11).
    new Promise((resolve, reject) => {
        store.get(key).onsuccess = function () {
            try {
                store.put(updater(this.result), key);
                resolve(promisifyRequest(store.transaction, "", ""));
            }
            catch (err) {
                reject(err);
            }
        };
    }));
}
/**
 * Delete a particular key from the store.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function del(key, customStore = defaultGetStore()) {
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
function delMany(keys, customStore = defaultGetStore()) {
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
function clear(customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.clear();
        return promisifyRequest(store.transaction, "", "");
    });
}
function eachCursor(store, callback) {
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
function keys(customStore = defaultGetStore()) {
    return customStore('readonly', (store) => {
        // Fast path for modern browsers
        if (store.getAllKeys) {
            return promisifyRequest(store.getAllKeys(), "", "");
        }
        const items = [];
        return eachCursor(store, (cursor) => items.push(cursor.key)).then(() => items);
    });
}
/**
 * Get all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function values(customStore = defaultGetStore()) {
    return customStore('readonly', (store) => {
        // Fast path for modern browsers
        if (store.getAll) {
            return promisifyRequest(store.getAll(), "", "");
        }
        const items = [];
        return eachCursor(store, (cursor) => items.push(cursor.value)).then(() => items);
    });
}
/**
 * Get all entries in the store. Each entry is an array of `[key, value]`.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
function entries(customStore = defaultGetStore()) {
    return customStore('readonly', (store) => {
        // Fast path for modern browsers
        // (although, hopefully we'll get a simpler path some day)
        if (store.getAll && store.getAllKeys) {
            return Promise.all([
                promisifyRequest(store.getAllKeys(), "", ""),
                promisifyRequest(store.getAll(), "", ""),
            ]).then(([keys, values]) => keys.map((key, i) => [key, values[i]]));
        }
        const items = [];
        return eachCursor(store, (cursor) => items.push([cursor.key, cursor.value])).then(() => items);
    });
}

exports.clear = clear;
exports.createStore = createStore;
exports.decrypt = decrypt;
exports.del = del;
exports.delMany = delMany;
exports.encrypt = encrypt;
exports.entries = entries;
exports.get = get;
exports.getMany = getMany;
exports.keys = keys;
exports.promisifyRequest = promisifyRequest;
exports.set = set;
exports.setMany = setMany;
exports.update = update;
exports.values = values;
