import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC0GQiIGvuWuRsjOZoj5a6luO8gYCbG9fY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "hazardnode.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://hazardnode-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "hazardnode",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "hazardnode.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "657179073018",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:657179073018:web:e145ee59d84efb05286c43",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-Q4LSWXS9WG"
};

// Initialize Firebase only if we have a Project ID
let app;
let rtdb: any = null;

try {
  // Ensure we have at least a project ID and database URL before initializing
  if (firebaseConfig.projectId && firebaseConfig.databaseURL) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    rtdb = getDatabase(app);
  }
} catch (error) {
  console.error("Firebase client initialization error:", error);
}

export { rtdb };
