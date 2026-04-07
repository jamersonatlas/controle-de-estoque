import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// As suas chaves secretas do Firebase!
const firebaseConfig = {
  apiKey: "AIzaSyA4jbp0i9e141xDuyU4DVgNfZsuo4xw_AA",
  authDomain: "controle-de-estoque-98807.firebaseapp.com",
  projectId: "controle-de-estoque-98807",
  storageBucket: "controle-de-estoque-98807.firebasestorage.app",
  messagingSenderId: "325645001508",
  appId: "1:325645001508:web:724f07aa2f6754d48649b1"
};

// Conectando o Firebase e o Banco de Dados
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
