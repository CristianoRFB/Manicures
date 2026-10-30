import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage, type FirebaseStorage } from "firebase/storage";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let emulatorConnected = false;

export function firebaseConfigured(): boolean {
  return Object.values(config).every((value) => typeof value === "string" && value.length > 0);
}

export function demoModeEnabled(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfigured()) return null;
  return getApps()[0] ?? initializeApp(config);
}

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

export function getFirebaseServices(): FirebaseServices | null {
  const app = getFirebaseApp();
  if (!app) return null;
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  if (!emulatorConnected && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    emulatorConnected = true;
  }

  return { app, auth, db, storage };
}
