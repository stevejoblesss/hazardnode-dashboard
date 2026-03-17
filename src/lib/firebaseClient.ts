import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC0GQiIGvuWuRsjOZoj5a6luO8gYCbG9fY",
  authDomain: "hazardnode.firebaseapp.com",
  databaseURL: "https://hazardnode-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hazardnode",
  storageBucket: "hazardnode.firebasestorage.app",
  messagingSenderId: "657179073018",
  appId: "1:657179073018:web:e145ee59d84efb05286c43",
  measurementId: "G-Q4LSWXS9WG"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const rtdb = getDatabase(app);

export { rtdb };
