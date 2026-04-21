// js/3-auth-db.js

auth.onAuthStateChanged(user => {
    if (user) {
        const userEmail = user.email.toLowerCase();
        isAdmin = ADMIN_EMAILS.includes(userEmail);
        isStockiest = STOCKIEST_EMAILS.includes(userEmail);
        
        document.body.classList.remove('login-mode'); 
        document.body.classList.add('auth-mode');
        
        document.getElementById('app-header').style.display = 'flex'; 
        document.getElementById('screen-login').classList.remove('active'); 
        document.getElementById('loading-overlay').style.display = 'flex';
        
        // Dynamic Loading Message
        if (isAdmin) document.getElementById('loading-text').innerText = "Loading Admin ERP...";
        else if (isStockiest) document.getElementById('loading-text').innerText = "Loading Stockiest Portal...";
        else document.getElementById('loading-text').innerText = "Loading Read-Only View...";
        
        applyRolePermissions();
        fetchCloudData();
        
        exitConfirmed = false;
    } else {
        document.body.classList.remove('auth-mode'); 
        document.body.classList.add('login-mode');
        
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('app-header').style.display = 'none'; 
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('screen-login').classList.add('active');
    }
});

function applyRolePermissions() {
    // Standard Admin Permissions
    document.getElementById('btn-new-sale').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('btn-new-po').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('btn-add-customer').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('btn-add-product').style.display = isAdmin ? 'block' : 'none';
    
    // 🌟 NEW: Bookkeeping is only visible to Admins OR the designated Stockiest
    const navBookkeeping = document.getElementById('nav-bookkeeping');
    if (navBookkeeping) {
        navBookkeeping.style.display = (isAdmin || isStockiest) ? 'block' : 'none';
    }
}

function login() { 
    const email = document.getElementById('login-email').value; 
    const pass = document.getElementById('login-password').value; 
    document.getElementById('login-error').innerText = "Authenticating..."; 
    auth.signInWithEmailAndPassword(email, pass).catch(error => { document.getElementById('login-error').innerText = error.message; }); 
}

function loginWithGoogle() { 
    document.getElementById('login-error').innerText = "Opening Google Login..."; 
    const provider = new firebase.auth.GoogleAuthProvider(); 
    auth.signInWithPopup(provider).catch(error => { document.getElementById('login-error').innerText = "Error: " + error.message; }); 
}

function promptLogout() {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar.classList.contains('open')) toggleMenu();
    showCustomConfirm("Are you sure you want to log out of your account?", logout, "Yes, Logout");
}

function logout() { 
    historyPadded = false; 
    auth.signOut(); 
}

async function fetchCloudData() {
    try {
        const metaDoc = await db.collection("metadata").doc("invoiceData").get();
        if (metaDoc.exists) { 
            appData.lastInvoiceNum = metaDoc.data().lastNum || 22; 
            appData.lastPoNum = metaDoc.data().lastPoNum || 5; 
        } else { 
            await db.collection("metadata").doc("invoiceData").set({ lastNum: 22, lastPoNum: 5 }); 
        }

        const invSnap = await db.collection("inventory").get(); 
        appData.inventory = invSnap.docs.map(doc => doc.data());
        
        const custSnap = await db.collection("customers").get(); 
        appData.customers = custSnap.docs.map(doc => doc.data());
        
        const histSnap = await db.collection("history").orderBy("timestamp", "desc").get(); 
        appData.history = histSnap.docs.map(doc => doc.data());
        
        const poSnap = await db.collection("purchaseOrders").orderBy("timestamp", "desc").get(); 
        appData.purchaseOrders = poSnap.docs.map(doc => {
            let data = doc.data();
            if (!data.status) data.status = 'converted';
            return data;
        });

        document.getElementById('loading-overlay').style.display = 'none';
        
        switchScreen('screen-history', false); 
        
        renderCustomerList(); 
        renderProductList(); 
        renderHistoryList(); 
        renderPOList(); 
        populateDropdowns();
    } catch (error) {
        console.error("Error connecting to Firebase:", error);
        document.getElementById('loading-text').innerText = "Database error. Please refresh.";
        document.querySelector('.spinner').style.display = 'none';
    }
}