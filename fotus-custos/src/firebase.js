// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage"; // <--- 1. Importação NOVA

export const firebaseConfig = {
  apiKe: "chaveApi",
  authDomain: "XXXXXXXXXXX",
  projectId: "XXXXXXXXXXXXX",
  storageBucket: "XXXXXXXXXX", // Verifique se isso está correto no seu console
  messagingSenderId: "XXXXXXXXX",
  appId: "XXXXXXXXX",
  measurementId: "XXXXXXXXXX"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // <--- 2. Exportação NOVA (que estava faltando)

