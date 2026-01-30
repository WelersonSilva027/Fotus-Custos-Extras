// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage"; // <--- 1. Importação NOVA

export const firebaseConfig = {
  apiKey: "AIzaSyCNONv2Jlyi6KrK0rxkEgT8WxCaCBKmvSA",
  authDomain: "fotus-custos-extras.firebaseapp.com",
  projectId: "fotus-custos-extras",
  storageBucket: "fotus-custos-extras.firebasestorage.app", // Verifique se isso está correto no seu console
  messagingSenderId: "554227414301",
  appId: "1:554227414301:web:3aed9c4bedafa51f77ddf4",
  measurementId: "G-R7VG2W6S6H"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // <--- 2. Exportação NOVA (que estava faltando)

