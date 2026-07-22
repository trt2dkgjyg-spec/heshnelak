import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"; 

const firebaseConfig = {
  apiKey: "AIzaSyA_BpK4vK0xEuryDqTcJH12--8lwkrmwok",
  authDomain: "al-anwar-system.firebaseapp.com",
  projectId: "al-anwar-system",
  storageBucket: "al-anwar-system.firebasestorage.app",
  messagingSenderId: "713317990058",
  appId: "1:713317990058:web:b7f2b4ab8866d9e2e05ad3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authOverlay = document.getElementById('firebase-auth-overlay');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const loginBtn = document.getElementById('auth-login-btn');
const forgotBtn = document.getElementById('auth-forgot-btn');
const errorDiv = document.getElementById('auth-error');
const logoutBtn = document.getElementById('auth-logout-btn');

function showError(msg) {
  errorDiv.textContent = msg;
  errorDiv.style.display = 'block';
}

function hideError() {
  errorDiv.style.display = 'none';
}

// Auth State Listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Logged in
    authOverlay.style.display = 'none';
    logoutBtn.style.display = 'flex';
    console.log("Logged in as", user.email);
    
    // Check role and fetch data
    await initAdminSession(user);
    
  } else {
    // Logged out
    authOverlay.style.display = 'flex';
    logoutBtn.style.display = 'none';
    emailInput.value = '';
    passwordInput.value = '';
  }
});

// --- FIRESTORE SYNC & RBAC LOGIC ---

// Proxy localStorage to automatically sync to Firestore
const originalSetItem = localStorage.setItem;
localStorage.setItem = async function(key, value) {
  originalSetItem.apply(this, arguments);
  
  if(!auth.currentUser) return; // Only sync if logged in
  
  try {
    if (key === 'alanwar_products_v2') {
      await setDoc(doc(db, 'system', 'products'), { data: value });
    } else if (key === 'alanwar_settings_v2') {
      await setDoc(doc(db, 'system', 'settings'), { data: value });
    } else if (key === 'alanwar_orders') {
      await setDoc(doc(db, 'system', 'orders'), { data: value });
    }
  } catch(e) {
    console.error("Error syncing to cloud:", e);
  }
};

async function initAdminSession(user) {
  try {
    // 1. Fetch Cloud Data and update local storage
    const prodsSnap = await getDoc(doc(db, 'system', 'products'));
    if (prodsSnap.exists()) {
      originalSetItem.call(localStorage, 'alanwar_products_v2', prodsSnap.data().data);
      if(window.allProducts) {
         window.allProducts = JSON.parse(prodsSnap.data().data);
         if(typeof window.renderProductsGrid === 'function') window.renderProductsGrid();
         if(typeof window.renderCatCounts === 'function') window.renderCatCounts();
      }
    }
    
    const settingsSnap = await getDoc(doc(db, 'system', 'settings'));
    if (settingsSnap.exists()) {
      originalSetItem.call(localStorage, 'alanwar_settings_v2', settingsSnap.data().data);
      if(typeof window.loadSettings === 'function') window.loadSettings();
    }
    
    const ordersSnap = await getDoc(doc(db, 'system', 'orders'));
    if (ordersSnap.exists()) {
      originalSetItem.call(localStorage, 'alanwar_orders', ordersSnap.data().data);
      if(window.ordersList) {
         window.ordersList = JSON.parse(ordersSnap.data().data);
         if(typeof window.renderOrders === 'function') window.renderOrders();
      }
    }
    
    // 2. Role Based Access Control (RBAC)
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    let role = 'admin'; // default fallback
    if(userSnap.exists()) {
       role = userSnap.data().role;
    } else {
       // First time login for the owner (Super Admin)
       await setDoc(doc(db, 'users', user.uid), { email: user.email, role: 'superadmin' });
       role = 'superadmin';
    }
    
    applyRBAC(role);
    
  } catch(e) {
    console.error("Error initializing session:", e);
  }
}

function applyRBAC(role) {
  // If not superadmin, hide settings and roles tabs
  if(role !== 'superadmin') {
     const settingsTabBtn = document.querySelector('.tab-btn[onclick="switchTab(\\'settings\\')"]');
     if(settingsTabBtn) settingsTabBtn.style.display = 'none';
     
     // Remove delete buttons for editors if needed, etc.
     // For now, hide settings so they can only manage products and orders.
  }
}

// Login
loginBtn.addEventListener('click', async () => {
  hideError();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if(!email || !password) return showError('يرجى إدخال الإيميل وكلمة المرور');
  
  loginBtn.textContent = 'جاري الدخول...';
  loginBtn.disabled = true;
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showError('بيانات الدخول غير صحيحة!');
  } finally {
    loginBtn.textContent = 'دخول';
    loginBtn.disabled = false;
  }
});

// Forgot Password
forgotBtn.addEventListener('click', async () => {
  hideError();
  const email = emailInput.value.trim();
  if(!email) return showError('يرجى كتابة الإيميل أولاً لنرسل لك رابط الاستعادة');
  
  try {
    await sendPasswordResetEmail(auth, email);
    alert('تم إرسال رابط استعادة كلمة المرور إلى إيميلك!');
  } catch(err) {
    showError('حدث خطأ! تأكد أن الإيميل صحيح ومسجل لدينا.');
  }
});

// Logout
logoutBtn.addEventListener('click', () => {
  if(confirm('هل أنت متأكد من تسجيل الخروج؟')) {
    signOut(auth);
  }
});
