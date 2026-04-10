// ─── src/firebase.js ─────────────────────────────────────────
// Firebase Firestore pour synchronisation multi-appareils
//
// INSTRUCTIONS DE CONFIGURATION :
// 1. Va sur https://console.firebase.google.com
// 2. Crée un projet (ex: "tracker-pro")
// 3. Ajoute une "Web app" et copie la config ci-dessous
// 4. Active Firestore Database (mode test pour commencer)
// 5. Active Authentication > Anonymous sign-in
// ──────────────────────────────────────────────────────────────

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

// ⚠️ REMPLACE CES VALEURS par ta config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAXxII9Cw7xF6-PNsV8k0rx6gaWdNA40Tc",
  authDomain: "progress-a1e20.firebaseapp.com",
  projectId: "progress-a1e20",
  storageBucket: "progress-a1e20.firebasestorage.app",
  messagingSenderId: "12649330428",
  appId: "1:12649330428:web:ff27235047143752354979"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ─── AUTH ────────────────────────────────────────────────────
// Pour la v1, on utilise l'auth anonyme.
// Chaque appareil connecté au même compte Firebase voit les mêmes données.
// Pour lier plusieurs appareils : on utilisera un "code de liaison" (userId partagé).
let currentUserId = null;

export function getUserId() {
  return currentUserId;
}

export function initAuth() {
  return new Promise((resolve) => {
    // Vérifie si un userId custom est stocké localement (liaison multi-appareils)
    const savedUserId = localStorage.getItem('tp-userId');
    
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        const cred = await signInAnonymously(auth);
        currentUserId = savedUserId || cred.user.uid;
      } else {
        currentUserId = savedUserId || user.uid;
      }
      resolve(currentUserId);
    });
  });
}

// Permet de lier un autre appareil en partageant le même userId
export function linkDevice(userId) {
  localStorage.setItem('tp-userId', userId);
  currentUserId = userId;
  window.location.reload(); // Recharge pour utiliser le nouveau userId
}

export function unlinkDevice() {
  localStorage.removeItem('tp-userId');
  window.location.reload();
}

// ─── FIRESTORE STORAGE ──────────────────────────────────────
const COLLECTIONS = {
  workouts: 'workouts',
  nutrition: 'nutrition',
  body: 'body',
  shoes: 'shoes',
};

function getDocRef(collection) {
  if (!currentUserId) throw new Error('Not authenticated');
  return doc(db, 'users', currentUserId, 'data', collection);
}

// Sauvegarder les données
export async function saveData(collection, data) {
  try {
    const ref = getDocRef(collection);
    await setDoc(ref, { items: data, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error(`Save error (${collection}):`, e);
    // Fallback localStorage
    localStorage.setItem(`tp-${collection}`, JSON.stringify(data));
  }
}

// Charger les données (une seule fois)
export async function loadData(collection) {
  try {
    const ref = getDocRef(collection);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data().items || [];
    }
    // Tenter de récupérer depuis localStorage (migration)
    const local = localStorage.getItem(`tp-${collection}`);
    if (local) {
      const parsed = JSON.parse(local);
      await saveData(collection, parsed); // Migration vers Firebase
      return parsed;
    }
    return [];
  } catch (e) {
    console.error(`Load error (${collection}):`, e);
    const local = localStorage.getItem(`tp-${collection}`);
    return local ? JSON.parse(local) : [];
  }
}

// Écouter les changements en temps réel (sync multi-appareils)
export function subscribeData(collection, callback) {
  try {
    const ref = getDocRef(collection);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        callback(snap.data().items || []);
      }
    }, (error) => {
      console.error(`Subscribe error (${collection}):`, error);
    });
  } catch (e) {
    console.error(`Subscribe setup error:`, e);
    return () => {}; // noop unsubscribe
  }
}

export { COLLECTIONS };
