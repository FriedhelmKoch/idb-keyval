declare function encrypt(text: string, key?: string | number): string;
declare function decrypt(chiffre: string, key?: string | number): string;
declare function promisifyRequest<T = string>(request: IDBRequest<T> | IDBTransaction, crypt: string, key: IDBValidKey): Promise<T>;
declare function createStore(dbName: string, storeName: string): (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>;
/**
 * Get a value by its key.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
declare function get(key: IDBValidKey, customStore?: (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>): Promise<any>;
/**
 * Set a value with a key.
 *
 * @param key
 * @param value
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
declare function set(key: IDBValidKey, value: any, customStore?: (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>): Promise<void>;
/**
 * Set multiple values at once. This is faster than calling set() multiple times.
 * It's also atomic – if one of the pairs can't be added, none will be added.
 *
 * @param entries Array of entries, where each entry is an array of `[key, value]`.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
declare function setMany(entries: [IDBValidKey, any][], customStore?: (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>): Promise<void>;
/**
 * Get multiple values by their keys
 *
 * @param keys
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
declare function getMany(keys: IDBValidKey[], customStore?: (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>): Promise<any[]>;
/**
 * Update a value. This lets you see the old value and update it as an atomic operation.
 *
 * @param key
 * @param updater A callback that takes the old value and returns a new value.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
declare function update(key: IDBValidKey, updater: (oldValue: any) => any, customStore?: (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>): Promise<void>;
/**
 * Delete a particular key from the store.
 *
 * @param key
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
declare function del(key: IDBValidKey, customStore?: (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>): Promise<void>;
/**
 * Delete multiple keys at once.
 *
 * @param keys List of keys to delete.
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
declare function delMany(keys: IDBValidKey[], customStore?: (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>): Promise<void>;
/**
 * Clear all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
declare function clear(customStore?: (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>): Promise<void>;
/**
 * Get all keys in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
declare function keys(customStore?: (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>): Promise<IDBValidKey[]>;
/**
 * Get all values in the store.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
declare function values(customStore?: (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>): Promise<any[]>;
/**
 * Get all entries in the store. Each entry is an array of `[key, value]`.
 *
 * @param customStore Method to get a custom store. Use with caution (see the docs).
 */
declare function entries(customStore?: (txMode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<any>) => Promise<any>): Promise<[IDBValidKey, any][]>;
export { clear, createStore, decrypt, del, delMany, encrypt, entries, get, getMany, keys, promisifyRequest, set, setMany, update, values };
