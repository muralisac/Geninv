// js/3-auth-db.js

auth.onAuthStateChanged(user => {
    if (user) {
        isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
        
        document.body.classList.remove('login-mode'); 
        document.body.classList.add('auth-mode');
        
        document.getElementById('app-header').style.display = 'flex'; 
        document.getElementById('screen-login').classList.remove('active'); 
        document.getElementById('loading-overlay').style.display = 'flex';
        document.getElementById('loading-text').innerText = isAdmin ? "Loading Admin ERP..." : "Loading Read-Only View...";
        
        applyRolePermissions();
        fetchCloudData();
        
        exitConfirmed = false;
        // Note: The history trap is now dynamically armed in utils.js upon the user's first physical touch.
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
    document.getElementById('btn-new-sale').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('btn-new-po').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('btn-add-customer').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('btn-add-product').style.display = isAdmin ? 'block' : 'none';
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
    historyPadded = false; // Reset the trap flag on logout
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