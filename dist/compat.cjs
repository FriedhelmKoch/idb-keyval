'use strict';

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"]; if (_i == null) return; var _arr = []; var _n = true; var _d = false; var _s, _e; try { for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

Object.defineProperty(exports, '__esModule', {
  value: true
});
var Modulus = 65536;
var salt = '${ThatIsTheSaltInTheSoupAndItJustTastesWayTooMuchLikeSaltEvenThoughSaltIsImportantAndIsAlsoNeededByTheHumanBody}';

function nextRandom(X, modulus) {
  /* Methode: Lineare Kongruenz =>  X[i] = (a * X[i-1] + b) mod m    */

  /* Mit den gewählten Parametern ergibt sich eine maximale Periode, */

  /* welches unabhängig von gewählten Startwert ist(?).              */
  var y = (17 * X + 1) % modulus;
  return y;
}

function crypt_HGC(EinText, key, encrypt) {
  var out = "";
  var Sign,
      i,
      X = 255;
  Modulus = 65536;

  if (typeof key === 'string') {
    for (i = 0; i < key.length; i++) {
      X = X * key.charCodeAt(i) % Modulus;
    }
  } else {
    key = Number(key);
    if (isNaN(key)) key = 3333;else if (key < 0) key = key * -1;
  }

  i = 0;

  while (i < EinText.length) {
    X = nextRandom(X, Modulus);
    Sign = EinText.charCodeAt(i) ^ X >> 8 & 255;

    if (typeof key === 'string') {
      Sign = Sign ^ key.charCodeAt(i % key.length);
    } else {
      Sign = Sign ^ key;
    }

    if (encrypt) X = X ^ Sign;else X = X ^ EinText.charCodeAt(i);
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
  var cipher = "";
  return new Promise(function (resolve, reject) {
    // @ts-ignore - file size hacks
    request.oncomplete = request.onsuccess = function () {
      var res = request.result;

      if (typeof res != 'undefined' && key === 'activeUser') {
        console.log("DEBUG - promisify (".concat(key, " | ").concat(crypt, ") res: ").concat(JSON.stringify(res).substring(0, 100)));

        if (crypt === 'de') {
          var str = decrypt(res).replaceAll("\\", "");
          console.log("DEBUG - promisify (".concat(crypt, ") cipher-str: ").concat(JSON.stringify(str).substring(0, 100)));
          cipher = JSON.parse(str);
          console.log("DEBUG - promisify (".concat(crypt, ") cipher: ").concat(JSON.stringify(cipher).substring(0, 100)));
        }
      }

      if (cipher != "" && key === 'activeUser') {
        resolve(cipher);
      } else {
        resolve(res);
      }
    }; // @ts-ignore - file size hacks


    request.onabort = request.onerror = function () {
      return reject(request.error);
    };
  });
}

function createStore(dbName, storeName) {
  var request = indexedDB.open(dbName);

  request.onupgradeneeded = function () {
    return request.result.createObjectStore(storeName);
  };

  var dbp = promisifyRequest(request, "", "");
  return function (txMode, callback) {
    return dbp.then(function (db) {
      return callback(db.transaction(storeName, txMode).objectStore(storeName));
    });
  };
}

var defaultGetStoreFunc;

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


function get(key) {
  var customStore = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultGetStore();
  console.log("DEBUG - GET: ".concat(JSON.stringify(key)));
  return customStore('readonly', function (store) {
    return promisifyRequest(store.get(key), "de", key);
  });
}
/**
 * Set a value with a key.
 *
 * @param key
 * @param value
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */


function set(key, value) {
  var customStore = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : defaultGetStore();
  return customStore('readwrite', function (store) {
    console.log("DEBUG - SET: ".concat(JSON.stringify(key), " ==> ").concat(JSON.stringify(value).substring(0, 100)));

    if (key === 'activeUser') {
      store.put(encrypt(JSON.stringify(value)), key);
    }

    store.put(value, key);
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


function setMany(entries) {
  var customStore = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultGetStore();
  return customStore('readwrite', function (store) {
    entries.forEach(function (entry) {
      return store.put(entry[1], entry[0]);
    });
    return promisifyRequest(store.transaction, "", "");
  });
}
/**
 * Get multiple values by their keys
 *
 * @param keys
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */


function getMany(keys) {
  var customStore = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultGetStore();
  return customStore('readonly', function (store) {
    return Promise.all(keys.map(function (key) {
      return promisifyRequest(store.get(key), "", "");
    }));
  });
}
/**
 * Update a value. This lets you see the old value and update it as an atomic operation.
 *
 * @param key
 * @param updater A callback that takes the old value and returns a new value.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */


function update(key, updater) {
  var customStore = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : defaultGetStore();
  return customStore('readwrite', function (store) {
    return (// Need to create the promise manually.
      // If I try to chain promises, the transaction closes in browsers
      // that use a promise polyfill (IE10/11).
      new Promise(function (resolve, reject) {
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
  });
}
/**
 * Delete a particular key from the store.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */


function del(key) {
  var customStore = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultGetStore();
  return customStore('readwrite', function (store) {
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


function delMany(keys) {
  var customStore = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultGetStore();
  return customStore('readwrite', function (store) {
    keys.forEach(function (key) {
      return store.delete(key);
    });
    return promisifyRequest(store.transaction, "", "");
  });
}
/**
 * Clear all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */


function clear() {
  var customStore = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultGetStore();
  return customStore('readwrite', function (store) {
    store.clear();
    return promisifyRequest(store.transaction, "", "");
  });
}

function eachCursor(store, callback) {
  store.openCursor().onsuccess = function () {
    if (!this.result) return;
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


function keys() {
  var customStore = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultGetStore();
  return customStore('readonly', function (store) {
    // Fast path for modern browsers
    if (store.getAllKeys) {
      return promisifyRequest(store.getAllKeys(), "", "");
    }

    var items = [];
    return eachCursor(store, function (cursor) {
      return items.push(cursor.key);
    }).then(function () {
      return items;
    });
  });
}
/**
 * Get all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */


function values() {
  var customStore = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultGetStore();
  return customStore('readonly', function (store) {
    // Fast path for modern browsers
    if (store.getAll) {
      return promisifyRequest(store.getAll(), "", "");
    }

    var items = [];
    return eachCursor(store, function (cursor) {
      return items.push(cursor.value);
    }).then(function () {
      return items;
    });
  });
}
/**
 * Get all entries in the store. Each entry is an array of `[key, value]`.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */


function entries() {
  var customStore = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : defaultGetStore();
  return customStore('readonly', function (store) {
    // Fast path for modern browsers
    // (although, hopefully we'll get a simpler path some day)
    if (store.getAll && store.getAllKeys) {
      return Promise.all([promisifyRequest(store.getAllKeys(), "", ""), promisifyRequest(store.getAll(), "", "")]).then(function (_ref) {
        var _ref2 = _slicedToArray(_ref, 2),
            keys = _ref2[0],
            values = _ref2[1];

        return keys.map(function (key, i) {
          return [key, values[i]];
        });
      });
    }

    var items = [];
    return eachCursor(store, function (cursor) {
      return items.push([cursor.key, cursor.value]);
    }).then(function () {
      return items;
    });
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
