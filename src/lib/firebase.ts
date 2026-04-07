import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA4jbp0i9e141xDuyU4DVgNfZsuo4xw_AA",
  authDomain: "controle-de-estoque-98807.firebaseapp.com",
  projectId: "controle-de-estoque-98807",
  storageBucket: "controle-de-estoque-98807.firebasestorage.app",
  messagingSenderId: "325645001508",
  appId: "1:325645001508:web:724f07aa2f6754d48649b1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
