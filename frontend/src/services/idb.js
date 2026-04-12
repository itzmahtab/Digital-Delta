const DB_NAME = 'digital-delta';
const DB_VERSION = 1;

const STORES = {
  GRAPH: 'graph',
  DELIVERIES: 'deliveries',
  INVENTORY: 'inventory',
  MUTATIONS: 'mutations',
  VECTOR_CLOCK: 'vector_clock',
  NONCES: 'nonces',
  USERS: 'users',
};

class IndexedDBService {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(STORES.GRAPH)) {
          db.createObjectStore(STORES.GRAPH, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(STORES.DELIVERIES)) {
          const deliveryStore = db.createObjectStore(STORES.DELIVERIES, { keyPath: 'id' });
          deliveryStore.createIndex('priority', 'priority', { unique: false });
          deliveryStore.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.INVENTORY)) {
          const inventoryStore = db.createObjectStore(STORES.INVENTORY, { keyPath: 'id' });
          inventoryStore.createIndex('category', 'category', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.MUTATIONS)) {
          const mutationStore = db.createObjectStore(STORES.MUTATIONS, { keyPath: 'id', autoIncrement: true });
          mutationStore.createIndex('timestamp', 'timestamp', { unique: false });
          mutationStore.createIndex('synced', 'synced', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.VECTOR_CLOCK)) {
          db.createObjectStore(STORES.VECTOR_CLOCK, { keyPath: 'nodeId' });
        }

        if (!db.objectStoreNames.contains(STORES.NONCES)) {
          const nonceStore = db.createObjectStore(STORES.NONCES, { keyPath: 'nonce' });
          nonceStore.createIndex('expires', 'expires', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.USERS)) {
          db.createObjectStore(STORES.USERS, { keyPath: 'username' });
        }
      };
    });
  }

  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedMutations() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(STORES.MUTATIONS, 'readonly');
      const store = transaction.objectStore(STORES.MUTATIONS);
      const index = store.index('synced');
      const request = index.getAll(IDBKeyRange.only(false));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markMutationSynced(id) {
    const mutation = await this.get(STORES.MUTATIONS, id);
    if (mutation) {
      mutation.synced = true;
      mutation.syncedAt = Date.now();
      await this.put(STORES.MUTATIONS, mutation);
    }
  }

  async addMutation(type, recordId, value, nodeId = 'local') {
    const mutation = {
      type,
      recordId,
      value,
      nodeId,
      timestamp: Date.now(),
      synced: false,
    };
    return await this.put(STORES.MUTATIONS, mutation);
  }

  async checkNonce(nonce) {
    const existing = await this.get(STORES.NONCES, nonce);
    return existing !== undefined;
  }

  async addNonce(nonce, deliveryId) {
    const expires = Date.now() + 5 * 60 * 1000;
    await this.put(STORES.NONCES, { nonce, deliveryId, expires });
  }

  async cleanupExpiredNonces() {
    const now = Date.now();
    const allNonces = await this.getAll(STORES.NONCES);
    
    for (const nonce of allNonces) {
      if (nonce.expires < now) {
        await this.delete(STORES.NONCES, nonce.nonce);
      }
    }
  }

  async saveGraph(graph) {
    await this.clear(STORES.GRAPH);
    for (const node of graph.nodes) {
      await this.put(STORES.GRAPH, { id: node.id, ...node, type: 'node' });
    }
    for (const edge of graph.edges) {
      await this.put(STORES.GRAPH, { id: edge.id, ...edge, type: 'edge' });
    }
  }

  async getGraph() {
    const allData = await this.getAll(STORES.GRAPH);
    const nodes = allData.filter(d => d.type === 'node');
    const edges = allData.filter(d => d.type === 'edge');
    return { nodes, edges };
  }

  async saveDeliveries(deliveries) {
    for (const delivery of deliveries) {
      await this.put(STORES.DELIVERIES, delivery);
    }
  }

  async updateDelivery(id, updates) {
    const delivery = await this.get(STORES.DELIVERIES, id);
    if (delivery) {
      await this.put(STORES.DELIVERIES, { ...delivery, ...updates, updatedAt: Date.now() });
      await this.addMutation('UPDATE', id, updates);
    }
  }
}

const idb = new IndexedDBService();

export { idb, STORES };
export default idb;
