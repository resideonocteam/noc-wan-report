// ── src/firebase.js ───────────────────────────────────────────────────────────
// Replace the values below with your own Firebase project config.
// Firebase Console → Project Settings → Your apps → SDK setup and configuration

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyA2sB89ijlql-sprnB8UTQmb7pqm_JjJjQ",
  authDomain:        "resideo-noc-wan-report.firebaseapp.com",
  projectId:         "resideo-noc-wan-report",
  storageBucket:     "resideo-noc-wan-report.firebasestorage.app",
  messagingSenderId: "576742374850",
  appId:             "1:576742374850:web:0a66fcaa85378f304d6a5b",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ── Firestore helpers ─────────────────────────────────────────────────────────

// Single shared report document (current working state)
const REPORT_DOC = "noc/current";

export async function loadReport() {
  const snap = await getDoc(doc(db, "noc", "current"));
  return snap.exists() ? snap.data() : null;
}

export async function saveReport(data) {
  await setDoc(doc(db, "noc", "current"), data);
}

// Subscribe to real-time updates of the shared report
export function subscribeReport(callback) {
  return onSnapshot(doc(db, "noc", "current"), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}

// Archives — each snapshot is its own document in noc/archives/{id}
export async function saveArchive(snapshot) {
  await setDoc(doc(db, "noc", "archives", snapshot.id), snapshot);
}

export async function loadArchives() {
  const snap = await getDocs(collection(db, "noc", "archives"));
  return snap.docs.map((d) => d.data());
}

export async function deleteArchive(id) {
  await deleteDoc(doc(db, "noc", "archives", id));
}
