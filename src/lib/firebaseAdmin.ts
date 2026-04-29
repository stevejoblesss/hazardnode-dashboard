import * as admin from "firebase-admin";

if (!admin.apps.length && (process.env.FIREBASE_PROJECT_ID || "hazardnode")) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID || "hazardnode",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "your-client-email",
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "your-private-key").replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL || "https://hazardnode-default-rtdb.asia-southeast1.firebasedatabase.app",
    });
  } catch (error) {
    console.error("Firebase admin initialization error:", error);
  }
}

const db = admin.apps.length ? admin.database() : null as any;
export { db };
