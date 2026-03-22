import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDYKESqrlf3TMbgmtprnw3deC489--lRxo",
  authDomain: "ordir-mining.firebaseapp.com",
  projectId: "ordir-mining",
  storageBucket: "ordir-mining.firebasestorage.app",
  messagingSenderId: "1033380847938",
  appId: "1:1033380847938:web:58e515d042891d26dba8db",
  measurementId: "G-QQEDZT2SGH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- Telegram & App State ---
const tg = window.Telegram.WebApp;
tg.expand();

let userId = "local_user";
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    userId = tg.initDataUnsafe.user.id.toString();
    document.getElementById('user-name').innerText = tg.initDataUnsafe.user.first_name;
    if (tg.initDataUnsafe.user.photo_url) {
        document.getElementById('user-avatar').src = tg.initDataUnsafe.user.photo_url;
    }
}

let state = {
    balance: 0,
    miningRate: 10, 
    storageLimit: 2, 
    pickLv: 1,
    cartLv: 1,
    lastClaimTime: Date.now()
};

let localAccumulated = 0;

// --- DOM Elements ---
const balanceEl = document.getElementById('balance');
const accumulatedEl = document.getElementById('accumulated');
const rateEl = document.getElementById('rate');
const progressEl = document.getElementById('block-progress');
const btnClaim = document.getElementById('btn-claim');

// --- Functions ---

async function syncData() {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        state = userSnap.data();
        updateUpgradeUI();
    } else {
        // New User
        await setDoc(userRef, state);
    }
}

function updateUpgradeUI() {
    document.getElementById('pick-lv').innerText = state.pickLv;
    document.getElementById('pick-cost').innerText = Math.floor(100 * Math.pow(1.5, state.pickLv - 1));
    document.getElementById('cart-lv').innerText = state.cartLv;
    document.getElementById('cart-cost').innerText = Math.floor(150 * Math.pow(1.6, state.cartLv - 1));
    rateEl.innerText = state.miningRate.toFixed(1);
}

// Mining Simulation Loop
setInterval(() => {
    const now = Date.now();
    const elapsedHrs = (now - state.lastClaimTime) / (1000 * 60 * 60);
    const maxAccumulation = state.miningRate * state.storageLimit;
    
    localAccumulated = Math.min(maxAccumulation, elapsedHrs * state.miningRate);

    // Update UI
    accumulatedEl.innerText = localAccumulated.toFixed(4);
    balanceEl.innerText = state.balance.toFixed(2);
    
    const progressPercent = (localAccumulated / maxAccumulation) * 100;
    progressEl.style.height = `${progressPercent}%`;
    btnClaim.disabled = localAccumulated <= 0.0001;
}, 100);

// Claim Logic
btnClaim.addEventListener('click', async () => {
    state.balance += localAccumulated;
    state.lastClaimTime = Date.now();
    localAccumulated = 0;
    
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
        balance: state.balance,
        lastClaimTime: state.lastClaimTime
    });
    
    tg.HapticFeedback.notificationOccurred('success');
});

// Upgrade Logic
async function handleUpgrade(type) {
    let cost = 0;
    const userRef = doc(db, "users", userId);

    if (type === 'pick') {
        cost = Math.floor(100 * Math.pow(1.5, state.pickLv - 1));
        if (state.balance >= cost) {
            state.balance -= cost;
            state.pickLv++;
            state.miningRate += 2;
        } else {
            tg.showAlert("Not enough $ORDIR!");
            return;
        }
    } else if (type === 'cart') {
        cost = Math.floor(150 * Math.pow(1.6, state.cartLv - 1));
        if (state.balance >= cost) {
            state.balance -= cost;
            state.cartLv++;
            state.storageLimit += 2;
        } else {
            tg.showAlert("Not enough $ORDIR!");
            return;
        }
    }

    await setDoc(userRef, state);
    updateUpgradeUI();
    tg.HapticFeedback.impactOccurred('medium');
}

document.getElementById('btn-upgrade-pick').addEventListener('click', () => handleUpgrade('pick'));
document.getElementById('btn-upgrade-cart').addEventListener('click', () => handleUpgrade('cart'));

// Navigation
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const targetView = item.getAttribute('data-view');
        document.querySelectorAll('.nav-item').forEach(ni => ni.classList.remove('active'));
        item.classList.add('active');
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            if (v.id === targetView) v.classList.add('active');
        });
    });
});

// Start the app
syncData();
