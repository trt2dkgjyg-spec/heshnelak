import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, orderBy, limit, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"; 

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

const authOverlay = document.getElementById('firebase-auth-overlay');
const authFormContainer = document.getElementById('auth-form-container');
const authLoadingSpinner = document.getElementById('auth-loading-spinner');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const loginBtn = document.getElementById('auth-login-btn');
const forgotBtn = document.getElementById('auth-forgot-btn');
const errorDiv = document.getElementById('auth-error');
const logoutBtn = document.getElementById('auth-logout-btn');
const headerEmail = document.getElementById('header-admin-email');
const headerTime = document.getElementById('header-datetime');

function showError(msg) { errorDiv.textContent = msg; errorDiv.style.display = 'block'; }
function hideError() { errorDiv.style.display = 'none'; }

setInterval(() => {
  if(!headerTime) return;
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
  headerTime.textContent = new Date().toLocaleString('ar-EG', options);
}, 1000);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    authOverlay.style.display = 'none';
    logoutBtn.style.display = 'flex';
    if(headerEmail) headerEmail.textContent = user.email;
    await initAdminSession(user);
  } else {
    authOverlay.style.display = 'flex';
    if(authFormContainer) authFormContainer.style.display = 'block';
    if(authLoadingSpinner) authLoadingSpinner.style.display = 'none';
    logoutBtn.style.display = 'none';
    if(headerEmail) headerEmail.textContent = 'غير متصل';
    emailInput.value = ''; passwordInput.value = '';
  }
});

const originalSetItem = localStorage.setItem;
localStorage.setItem = async function(key, value) {
  originalSetItem.apply(this, arguments);
  if(!auth.currentUser) return;
  try {
    if (key === 'alanwar_products_v2') await setDoc(doc(db, 'system', 'products'), { data: value });
    else if (key === 'alanwar_settings_v2') await setDoc(doc(db, 'system', 'settings'), { data: value });
    else if (key === 'alanwar_orders') await setDoc(doc(db, 'system', 'orders'), { data: value });
  } catch(e) { console.error(e); }
};

async function initAdminSession(user) {
  try {
    const prodsSnap = await getDoc(doc(db, 'system', 'products'));
    if (prodsSnap.exists()) {
      originalSetItem.call(localStorage, 'alanwar_products_v2', prodsSnap.data().data);
      if(window.allProducts) { window.allProducts = JSON.parse(prodsSnap.data().data); if(window.renderProductsGrid) window.renderProductsGrid(); }
    }
    const settingsSnap = await getDoc(doc(db, 'system', 'settings'));
    if (settingsSnap.exists()) {
      originalSetItem.call(localStorage, 'alanwar_settings_v2', settingsSnap.data().data);
      if(window.loadSettings) window.loadSettings();
    }
    const ordersSnap = await getDoc(doc(db, 'system', 'orders'));
    if (ordersSnap.exists()) {
      originalSetItem.call(localStorage, 'alanwar_orders', ordersSnap.data().data);
      if(window.ordersList) { window.ordersList = JSON.parse(ordersSnap.data().data); if(window.renderOrders) window.renderOrders(); }
    }
    
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    let role = 'admin';
    if(userSnap.exists()) { role = userSnap.data().role; } 
    else { await setDoc(doc(db, 'users', user.uid), { email: user.email, role: 'superadmin', created_at: Date.now() }); role = 'superadmin'; }
    
    applyRBAC(role);
  } catch(e) { console.error(e); }
}

function applyRBAC(role) {
  if (role === 'suspended') { alert('عفواً، تم إيقاف حسابك من قبل الإدارة.'); signOut(auth); return; }
  
  if(role !== 'superadmin') {
     ['settings', 'logs', 'admins'].forEach(id => {
       const btn = document.querySelector(`.tab-btn[onclick="switchTab('${id}')"]`) || document.getElementById(`tab-btn-${id}`);
       if(btn) btn.style.display = 'none';
     });
  } else { loadActivityLogs(); loadAdminsList(); }
}

function loadAdminsList() {
  onSnapshot(collection(db, 'users'), (snapshot) => {
    const tbody = document.getElementById('adminsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    snapshot.forEach(docSnap => {
       const u = docSnap.data(); const uid = docSnap.id; const tr = document.createElement('tr');
       let statusHtml = '', actionHtml = '';
       if(u.role === 'superadmin') { statusHtml = `<span style="color:#C9A84C; font-weight:bold;">مدير عام</span>`; actionHtml = `<span style="color:var(--silver);">لا يمكن التعديل</span>`; } 
       else if (u.role === 'suspended') { statusHtml = `<span style="color:#ef4444; font-weight:bold;">محظور</span>`; actionHtml = `<button onclick="window.toggleAdminRole('${uid}', 'admin')" style="background:#22c55e; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">تفعيل</button>`; } 
       else { statusHtml = `<span style="color:#3b82f6; font-weight:bold;">مشرف عادي</span>`; actionHtml = `<button onclick="window.toggleAdminRole('${uid}', 'suspended')" style="background:#ef4444; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">حظر</button>`; }
       const dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString('ar-EG') : 'غير محدد';
       tr.innerHTML = `<td style="font-weight:bold; color:var(--dark);">${u.email}</td><td>${statusHtml}</td><td style="direction:ltr; text-align:right;">${dateStr}</td><td>${actionHtml}</td>`;
       tbody.appendChild(tr);
    });
  });
}

window.toggleAdminRole = async function(uid, newRole) {
  if(!confirm(`هل أنت متأكد من ${newRole === 'suspended' ? 'حظر' : 'تفعيل'} هذا المشرف؟`)) return;
  try { await updateDoc(doc(db, 'users', uid), { role: newRole }); logActivity(newRole === 'suspended' ? 'حظر مشرف' : 'تفعيل مشرف', `المعرف: ${uid}`); } 
  catch(e) { alert("حدث خطأ."); }
}

const createAdminBtn = document.getElementById('createNewAdminBtn');
if(createAdminBtn) {
  createAdminBtn.addEventListener('click', async () => {
    const email = document.getElementById('newAdminEmail').value.trim();
    const pass = document.getElementById('newAdminPassword').value;
    const msg = document.getElementById('createAdminMsg');
    
    if(!email || pass.length < 6) { msg.textContent = 'الإيميل مطلوب، وكلمة المرور 6 أحرف على الأقل.'; msg.style.color = '#ef4444'; msg.style.display = 'block'; return; }
    if(!confirm(`تأكيد إنشاء حساب مشرف جديد للإيميل:\n${email}\nكلمة المرور:\n${pass}`)) return;
    
    createAdminBtn.disabled = true; createAdminBtn.textContent = 'جاري الإنشاء...';
    try {
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp" + Date.now());
      const secAuth = getAuth(secondaryApp);
      const userCred = await createUserWithEmailAndPassword(secAuth, email, pass);
      await setDoc(doc(db, 'users', userCred.user.uid), { email: email, role: 'admin', created_at: Date.now() });
      await signOut(secAuth); await deleteApp(secondaryApp);
      logActivity('إنشاء مشرف جديد', `الإيميل: ${email}`);
      
      document.getElementById('newAdminEmail').value = ''; document.getElementById('newAdminPassword').value = '';
      msg.textContent = 'تم إنشاء الحساب بنجاح!'; msg.style.color = '#22c55e'; msg.style.display = 'block';
      setTimeout(() => msg.style.display = 'none', 4000);
    } catch(e) {
      msg.textContent = 'فشل الإنشاء: قد يكون الإيميل مستخدماً أو غير صالح.'; msg.style.color = '#ef4444'; msg.style.display = 'block';
    } finally { createAdminBtn.disabled = false; createAdminBtn.textContent = 'إنشاء الحساب'; }
  });
}

function loadActivityLogs() {
  onSnapshot(query(collection(db, 'system', 'activity_logs', 'logs'), orderBy('timestamp', 'desc'), limit(150)), (snapshot) => {
    const tbody = document.getElementById('activityLogsTableBody');
    if(!tbody) return;
    tbody.innerHTML = '';
    if(snapshot.empty) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">لا توجد نشاطات مسجلة بعد</td></tr>'; return; }
    snapshot.forEach(docSnap => {
       const d = docSnap.data(); const tr = document.createElement('tr');
       const dateStr = new Date(d.timestamp).toLocaleString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
       tr.innerHTML = `<td style="direction:ltr; text-align:right;">${dateStr}</td><td style="font-weight:bold; color:var(--primary);">${d.email}</td><td><span style="background:rgba(201, 168, 76, 0.2); color:#C9A84C; padding:4px 8px; border-radius:4px; font-size:13px; font-weight:bold;">${d.action}</span></td><td style="color:var(--silver);">${d.details}</td>`;
       tbody.appendChild(tr);
    });
  });
}

async function logActivity(action, details) {
  if(!auth.currentUser) return;
  try { await addDoc(collection(db, 'system', 'activity_logs', 'logs'), { email: auth.currentUser.email, action: action, details: details, timestamp: new Date().getTime() }); } 
  catch(e) {}
}

setTimeout(() => {
  if(window.saveProduct) {
    const origSaveProduct = window.saveProduct;
    window.saveProduct = function() {
      try { const pName = document.getElementById('p_name_ar') ? document.getElementById('p_name_ar').value : 'منتج';
            const isNew = document.getElementById('editProductIdx') && document.getElementById('editProductIdx').value === '';
            logActivity(isNew ? 'إضافة منتج جديد' : 'تعديل منتج موجود', `المنتج: ${pName}`);
      } catch(e){} return origSaveProduct.apply(this, arguments);
    };
  }
  if(window.deleteProduct) {
    const origDel = window.deleteProduct;
    window.deleteProduct = function(idx) {
      try { const prod = (window.allProducts && window.allProducts[idx]) ? window.allProducts[idx].name.ar : 'منتج مجهول';
            logActivity('حذف منتج', `تم حذف: ${prod}`);
      } catch(e){} return origDel.apply(this, arguments);
    };
  }
  if(window.saveSiteSettings) {
    const origSet = window.saveSiteSettings;
    window.saveSiteSettings = function() {
      logActivity('تعديل الإعدادات', 'تم تغيير إعدادات الموقع الأساسية'); return origSet.apply(this, arguments);
    };
  }
}, 3000);

loginBtn.addEventListener('click', async () => {
  hideError(); const email = emailInput.value.trim(); const password = passwordInput.value;
  if(!email || !password) return showError('يرجى إدخال الإيميل وكلمة المرور');
  loginBtn.textContent = 'جاري الدخول...'; loginBtn.disabled = true;
  try { await signInWithEmailAndPassword(auth, email, password); logActivity('تسجيل دخول', 'عملية دخول ناجحة للوحة التحكم'); } 
  catch (error) { showError('بيانات الدخول غير صحيحة أو تم حظر الحساب!'); } 
  finally { loginBtn.textContent = 'دخول'; loginBtn.disabled = false; }
});

forgotBtn.addEventListener('click', async () => {
  hideError(); const email = emailInput.value.trim();
  if(!email) return showError('يرجى كتابة الإيميل أولاً لنرسل لك رابط الاستعادة');
  try { await sendPasswordResetEmail(auth, email); alert('تم إرسال رابط استعادة كلمة المرور إلى إيميلك!'); } 
  catch(err) { showError('حدث خطأ! تأكد أن الإيميل صحيح ومسجل لدينا.'); }
});

logoutBtn.addEventListener('click', () => {
  if(confirm('هل أنت متأكد من تسجيل الخروج؟')) {
    logActivity('تسجيل خروج', 'تم الخروج من النظام');
    setTimeout(() => signOut(auth), 500);
  }
});
