import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"; 

const firebaseConfig = {
  apiKey: "AIzaSyA_BpK4vK0xEuryDqTcJH12--8lwkrmwok",
  authDomain: "al-anwar-system.firebaseapp.com",
  projectId: "al-anwar-system",
  storageBucket: "al-anwar-system.firebasestorage.app",
  messagingSenderId: "713317990058",
  appId: "1:713317990058:web:b7f2b4ab8866d9e2e05ad3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function loadCloudData() {
  try {
    const prodsSnap = await getDoc(doc(db, 'system', 'products'));
    if (prodsSnap.exists()) {
      localStorage.setItem('alanwar_products_v2', prodsSnap.data().data);
      if(window.loadProducts) window.loadProducts(null); // Re-render grid
    }
    
    const settingsSnap = await getDoc(doc(db, 'system', 'settings'));
    if (settingsSnap.exists()) {
      localStorage.setItem('alanwar_settings_v2', settingsSnap.data().data);
      if(window.applySiteSettings) window.applySiteSettings(); // Re-apply UI settings
    }
  } catch(e) {
    console.error("Error loading cloud data:", e);
  }
}

// Load data on page load
loadCloudData();
