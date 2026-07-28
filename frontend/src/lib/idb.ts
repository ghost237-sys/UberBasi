// IndexedDB Offline Storage Helper for Conductor PWA

export interface OfflineTicket {
  id: string;
  code: string;
  trip_id: string;
  status: string; // 'paid', 'confirmed'
  passenger_phone?: string;
  fare: number;
  boarding_stage_name?: string;
  alighting_stage_name?: string;
  synced: boolean;
  updated_offline_at?: string;
}

const DB_NAME = 'uberbasi_conductor_db';
const DB_VERSION = 1;
const STORE_TICKETS = 'tickets';
const STORE_SYNC_QUEUE = 'sync_queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return;
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TICKETS)) {
        const ticketStore = db.createObjectStore(STORE_TICKETS, { keyPath: 'id' });
        ticketStore.createIndex('code', 'code', { unique: false });
        ticketStore.createIndex('passenger_phone', 'passenger_phone', { unique: false });
        ticketStore.createIndex('trip_id', 'trip_id', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const offlineStore = {
  async saveTickets(tickets: OfflineTicket[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_TICKETS, 'readwrite');
    const store = tx.objectStore(STORE_TICKETS);
    for (const t of tickets) {
      store.put({ ...t, synced: true });
    }
    return new Promise((resolve) => (tx.oncomplete = () => resolve()));
  },

  async getAllTickets(tripId?: string): Promise<OfflineTicket[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_TICKETS, 'readonly');
    const store = tx.objectStore(STORE_TICKETS);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => {
        let results: OfflineTicket[] = request.result || [];
        if (tripId) {
          results = results.filter((t) => t.trip_id === tripId);
        }
        resolve(results);
      };
    });
  },

  async findTicket(codeOrPhone: string, tripId?: string): Promise<OfflineTicket | null> {
    const tickets = await this.getAllTickets(tripId);
    const query = codeOrPhone.trim().toUpperCase();
    return (
      tickets.find(
        (t) =>
          t.code.toUpperCase() === query ||
          (t.passenger_phone && t.passenger_phone.includes(query))
      ) || null
    );
  },

  async markTicketConfirmedLocally(ticketId: string): Promise<OfflineTicket | null> {
    const db = await openDB();
    const tx = db.transaction([STORE_TICKETS, STORE_SYNC_QUEUE], 'readwrite');
    const ticketStore = tx.objectStore(STORE_TICKETS);
    const queueStore = tx.objectStore(STORE_SYNC_QUEUE);

    return new Promise((resolve) => {
      const getReq = ticketStore.get(ticketId);
      getReq.onsuccess = () => {
        const ticket: OfflineTicket = getReq.result;
        if (ticket) {
          ticket.status = 'confirmed';
          ticket.synced = false;
          ticket.updated_offline_at = new Date().toISOString();
          ticketStore.put(ticket);

          // Add to sync queue for background sync when online
          queueStore.add({
            type: 'CONFIRM_TICKET',
            ticket_id: ticketId,
            code: ticket.code,
            timestamp: new Date().toISOString(),
          });

          resolve(ticket);
        } else {
          resolve(null);
        }
      };
    });
  },

  async addCashTicketLocally(ticket: OfflineTicket): Promise<void> {
    const db = await openDB();
    const tx = db.transaction([STORE_TICKETS, STORE_SYNC_QUEUE], 'readwrite');
    tx.objectStore(STORE_TICKETS).put(ticket);
    tx.objectStore(STORE_SYNC_QUEUE).add({
      type: 'ADD_CASH',
      ticket,
      timestamp: new Date().toISOString(),
    });
    return new Promise((resolve) => (tx.oncomplete = () => resolve()));
  },

  async getSyncQueue(): Promise<any[]> {
    const db = await openDB();
    const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
    const request = tx.objectStore(STORE_SYNC_QUEUE).getAll();
    return new Promise((resolve) => (request.onsuccess = () => resolve(request.result || [])));
  },

  async clearSyncQueue(): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
    tx.objectStore(STORE_SYNC_QUEUE).clear();
    return new Promise((resolve) => (tx.oncomplete = () => resolve()));
  },
};
