// Initialize Telegram Web App
const tg = window.Telegram.WebApp;
tg.expand();

// Game State
let state = {
    balance: 0,
    accumulated: 0,
    miningRate: 10, // per hour
    storageLimit: 2, // hours
    pickLv: 1,
    cartLv: 1,
    lastClaimTime: Date.now()
};

// DOM Elements
const balanceEl = document.getElementById('balance');
const accumulatedEl = document.getElementById('accumulated');
const rateEl = document.getElementById('rate');
const progressEl = document.getElementById('block-progress');
const btnClaim = document.getElementById('btn-claim');

// Navigation Logic
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

navItems.forEach(item => {
    item.addEventListener('click', () => {
        const targetView = item.getAttribute('data-view');
        
        // Update Nav
        navItems.forEach(ni => ni.classList.remove('active'));
        item.classList.add('active');
        
        // Update Views
        views.forEach(v => {
            v.classList.remove('active');
            if (v.id === targetView) v.classList.add('active');
        });
    });
});

// Load User Info from TG
if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
    document.getElementById('user-name').innerText = tg.initDataUnsafe.user.first_name;
    if (tg.initDataUnsafe.user.photo_url) {
        document.getElementById('user-avatar').src = tg.initDataUnsafe.user.photo_url;
    }
}

// Mining Simulation Loop (updates every 100ms)
setInterval(() => {
    const maxAccumulation = state.miningRate * state.storageLimit;
    
    if (state.accumulated < maxAccumulation) {
        // Simple increment logic for 100ms tick (36000 ticks per hour)
        const increment = state.miningRate / 36000;
        state.accumulated += increment;
        
        if (state.accumulated > maxAccumulation) state.accumulated = maxAccumulation;
    }

    // Update UI
    accumulatedEl.innerText = state.accumulated.toFixed(2);
    balanceEl.innerText = state.balance.toFixed(2);
    
    // Update Progress Bar (0 to 100%)
    const progressPercent = (state.accumulated / maxAccumulation) * 100;
    progressEl.style.height = `${progressPercent}%`;
    
    // Enable/Disable Claim Button
    btnClaim.disabled = state.accumulated <= 0;
}, 100);

// Claim Logic
btnClaim.addEventListener('click', () => {
    state.balance += state.accumulated;
    state.accumulated = 0;
    tg.HapticFeedback.notificationOccurred('success');
});

// Upgrade Logic
document.getElementById('btn-upgrade-pick').addEventListener('click', () => {
    const cost = Math.floor(100 * Math.pow(1.5, state.pickLv - 1));
    if (state.balance >= cost) {
        state.balance -= cost;
        state.pickLv++;
        state.miningRate += 2;
        
        // Update UI
        document.getElementById('pick-lv').innerText = state.pickLv;
        document.getElementById('pick-cost').innerText = Math.floor(100 * Math.pow(1.5, state.pickLv));
        rateEl.innerText = state.miningRate.toFixed(1);
    } else {
        tg.showAlert("Insufficient $ORDI_REVIVE balance!");
    }
});

document.getElementById('btn-upgrade-cart').addEventListener('click', () => {
    const cost = Math.floor(150 * Math.pow(1.6, state.cartLv - 1));
    if (state.balance >= cost) {
        state.balance -= cost;
        state.cartLv++;
        state.storageLimit += 2;
        
        // Update UI
        document.getElementById('cart-lv').innerText = state.cartLv;
        document.getElementById('cart-cost').innerText = Math.floor(150 * Math.pow(1.6, state.cartLv));
    } else {
        tg.showAlert("Insufficient $ORDI_REVIVE balance!");
    }
});

// Copy Referral Link
document.getElementById('btn-copy').addEventListener('click', () => {
    const link = document.getElementById('referral-link');
    link.select();
    document.execCommand('copy');
    tg.showScanQrPopup({text: "Invite Link Copied!"});
    setTimeout(() => tg.closeScanQrPopup(), 1000);
});
