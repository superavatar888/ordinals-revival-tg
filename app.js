import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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

const statusEl = document.getElementById('db-status');
let userId = "local_user";
let referralId = null;

if (tg.initDataUnsafe && tg.initDataUnsafe.start_param) {
    const param = tg.initDataUnsafe.start_param;
    if (param.startsWith('ref_')) referralId = param.replace('ref_', '');
}

if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    userId = tg.initDataUnsafe.user.id.toString();
    document.getElementById('user-name').innerText = tg.initDataUnsafe.user.first_name;
    if (tg.initDataUnsafe.user.photo_url) {
        document.getElementById('user-avatar').src = tg.initDataUnsafe.user.photo_url;
    }
}

const myRefLink = `https://t.me/ReviveOrdiBot?start=ref_${userId}`;
document.getElementById('referral-link').value = myRefLink;

// Initial Local State
let state = {
    balance: 0,
    miningRate: 10, 
    storageLimit: 2, 
    pickLv: 1,
    cartLv: 1,
    lastClaimTime: Date.now(),
    referredBy: null,
    referralBonus: 0,
    referralCount: 0
};

let isDataLoaded = false;
let localAccumulated = 0;

// --- DOM Elements ---
const balanceEl = document.getElementById('balance');
const accumulatedEl = document.getElementById('accumulated');
const rateEl = document.getElementById('rate');
const progressEl = document.getElementById('block-progress');
const btnClaim = document.getElementById('btn-claim');

// --- Core Functions ---

async function syncData() {
    console.log("Attempting to sync with Firebase for UID:", userId);
    try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const cloudData = userSnap.data();
            console.log("Cloud data found:", cloudData);
            state = { ...state, ...cloudData };
        } else {
            console.log("New user detected. Initializing cloud record...");
            state.referredBy = referralId;
            await setDoc(userRef, state);
            
            if (referralId) {
                const inviterRef = doc(db, "users", referralId);
                await updateDoc(inviterRef, { referralCount: increment(1) }).catch(e => console.error("Inviter update failed:", e));
            }
        }
        
        isDataLoaded = true;
        statusEl.className = 'online';
        updateUpgradeUI();
        updateSyndicateUI();
    } catch (error) {
        console.error("Firebase Sync Error:", error);
        statusEl.className = 'offline';
        tg.showAlert("Cloud Sync Error: " + error.message + "\nPlease check your internet and Firebase rules.");
    }
}

function updateUpgradeUI() {
    document.getElementById('pick-lv').innerText = state.pickLv;
    document.getElementById('pick-cost').innerText = Math.floor(100 * Math.pow(1.5, state.pickLv - 1));
    document.getElementById('cart-lv').innerText = state.cartLv;
    document.getElementById('cart-cost').innerText = Math.floor(150 * Math.pow(1.6, state.cartLv - 1));
    rateEl.innerText = state.miningRate.toFixed(1);
}

function updateSyndicateUI() {
    document.getElementById('ref-count').innerText = state.referralCount || 0;
    document.getElementById('ref-bonus').innerText = (state.referralBonus || 0).toFixed(2);
}

// Mining Loop
setInterval(() => {
    if (!isDataLoaded) return; // Wait for Firebase before calculating anything

    const now = Date.now();
    const elapsedHrs = (now - state.lastClaimTime) / (1000 * 60 * 60);
    const maxAccumulation = state.miningRate * state.storageLimit;
    
    localAccumulated = Math.min(maxAccumulation, elapsedHrs * state.miningRate);

    // Update UI
    accumulatedEl.innerText = localAccumulated.toFixed(4);
    balanceEl.innerText = (state.balance + (state.referralBonus || 0)).toFixed(2);
    
    const progressPercent = (localAccumulated / maxAccumulation) * 100;
    progressEl.style.height = `${progressPercent}%`;
    btnClaim.disabled = localAccumulated <= 0.0001;
}, 100);

// Claim Logic
btnClaim.addEventListener('click', async () => {
    if (!isDataLoaded) return;
    
    const claimedAmount = localAccumulated;
    state.balance += claimedAmount;
    state.lastClaimTime = Date.now();
    localAccumulated = 0;
    
    console.log("Claiming", claimedAmount, "new balance:", state.balance);
    
    try {
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
            balance: state.balance,
            lastClaimTime: state.lastClaimTime
        });

        if (state.referredBy) {
            const commission = claimedAmount * 0.05;
            const inviterRef = doc(db, "users", state.referredBy);
            await updateDoc(inviterRef, { referralBonus: increment(commission) });
        }
        tg.HapticFeedback.notificationOccurred('success');
    } catch (e) {
        console.error("Claim write failed:", e);
        tg.showAlert("Failed to save claim to cloud!");
    }
});

// Upgrade Logic
async function handleUpgrade(type) {
    if (!isDataLoaded) return;
    
    let cost = 0;
    try {
        const userRef = doc(db, "users", userId);
        if (type === 'pick') {
            cost = Math.floor(100 * Math.pow(1.5, state.pickLv - 1));
            if (state.balance >= cost) {
                state.balance -= cost;
                state.pickLv++;
                state.miningRate += 2;
            } else { tg.showAlert("Insufficient $ORDIR!"); return; }
        } else {
            cost = Math.floor(150 * Math.pow(1.6, state.cartLv - 1));
            if (state.balance >= cost) {
                state.balance -= cost;
                state.cartLv++;
                state.storageLimit += 2;
            } else { tg.showAlert("Insufficient $ORDIR!"); return; }
        }

        await setDoc(userRef, state);
        updateUpgradeUI();
        tg.HapticFeedback.impactOccurred('medium');
    } catch (e) {
        console.error("Upgrade failed:", e);
        tg.showAlert("Failed to save upgrade!");
    }
}

document.getElementById('btn-upgrade-pick').addEventListener('click', () => handleUpgrade('pick'));
document.getElementById('btn-upgrade-cart').addEventListener('click', () => handleUpgrade('cart'));

// Navigation & Copy (Same as before)
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

document.getElementById('btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('referral-link').value);
    tg.showScanQrPopup({text: "Invite Link Copied!"});
    setTimeout(() => tg.closeScanQrPopup(), 1000);
});

// Init
syncData();
