let backTrapSetup = false;
let exitConfirmed = false;

function ensureBackTrap() {
    if (!backTrapSetup) {
        window.history.pushState({ page: 'base' }, "");
        window.history.pushState({ page: 'main' }, "");
        window.addEventListener('popstate', handleBackButton);
        backTrapSetup = true;
    }
}

document.body.addEventListener('click', () => { if (auth.currentUser) ensureBackTrap(); }, { once: true });
document.body.addEventListener('touchstart', () => { if (auth.currentUser) ensureBackTrap(); }, { once: true });

auth.onAuthStateChanged(user => {
    if (user) {
        isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());
        document.getElementById('app-header').style.display = 'block'; 
        document.getElementById('screen-login').classList.remove('active'); 
        document.getElementById('loading-overlay').style.display = 'flex';
        document.getElementById('loading-text').innerText = isAdmin ? "Loading Admin ERP..." : "Loading Read-Only View...";
        applyRolePermissions();
        fetchCloudData();
        ensureBackTrap(); 
    } else {
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('app-header').style.display = 'none'; 
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById('screen-login').classList.add('active');
    }
});

function handleBackButton(event) {
    if (exitConfirmed) return; 
    window.history.pushState({ page: 'main' }, "");

    const sidebar = document.getElementById('app-sidebar');
    if (sidebar.classList.contains('open')) {
        toggleMenu();
        return;
    }

    const activeScreen = document.querySelector('.screen.active');
    if (!activeScreen) return;

    if (activeScreen.id === 'screen-builder' || activeScreen.id === 'screen-po-builder' || activeScreen.id === 'screen-preview') {
        switchScreen(currentDocType === 'po' ? 'screen-po-history' : 'screen-history');
    } else {
        showCustomConfirm("Are you sure you want to close the app?", function() {
            exitConfirmed = true;
            window.history.go(-2); 
        }, "Yes, Exit");
    }
}

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
    auth.signInWithEmailAndPassword(email, pass).catch(error => { 
        document.getElementById('login-error').innerText = error.message; 
    }); 
}

function loginWithGoogle() { 
    document.getElementById('login-error').innerText = "Opening Google Login..."; 
    const provider = new firebase.auth.GoogleAuthProvider(); 
    auth.signInWithPopup(provider).catch(error => { 
        document.getElementById('login-error').innerText = "Error: " + error.message; 
    }); 
}

function promptLogout() {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar.classList.contains('open')) toggleMenu();
    showCustomConfirm("Are you sure you want to log out of your account?", logout, "Yes, Logout");
}

function logout() { auth.signOut(); }