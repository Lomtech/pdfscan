"use client";

import { openDB, type IDBPDatabase } from "idb";
import type { DocRecord } from "./types";

const DB_NAME = "pdf-skill-extractor";
const DB_VERSION = 1;
const STORE = "documents";

interface Schema {
  documents: {
    key: string;
    value: DocRecord;
    indexes: { byAddedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("byAddedAt", "addedAt");
        }
      },
    });
  }
  return dbPromise;
}

export async function listDocs(): Promise<DocRecord[]> {
  const db = await getDB();
  const all = await db.getAll(STORE);
  return all.sort((a, b) => a.addedAt - b.addedAt);
}

export async function putDoc(doc: DocRecord): Promise<void> {
  const db = await getDB();
  await db.put(STORE, doc);
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE);
}
