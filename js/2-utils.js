function toggleMenu() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open'); overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    } else {
        overlay.style.display = 'block';
        setTimeout(() => { overlay.style.opacity = '1'; sidebar.classList.add('open'); }, 10);
    }
}

function getLocalYMD(dateObj) {
    const year = dateObj.getFullYear(); const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`;
}

function createDateFromYMD(ymdStr) {
    if (!ymdStr) return new Date(); const parts = ymdStr.split('-');
    if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]); return new Date();
}

function showCustomAlert(message, title = "Notice", icon = "⚠️") {
    document.getElementById("custom-alert-message").innerText = message;
    document.getElementById("custom-alert-title").innerText = title;
    document.getElementById("custom-alert-icon").innerText = icon;
    document.getElementById("custom-alert-modal").style.display = "flex";
}
function closeCustomAlert() { document.getElementById("custom-alert-modal").style.display = "none"; }

let confirmCallback = null;
function showCustomConfirm(message, callback, btnText = "Yes, Confirm") {
    document.getElementById("custom-confirm-message").innerText = message; confirmCallback = callback;
    document.getElementById("custom-confirm-btn").innerText = btnText; document.getElementById("custom-confirm-modal").style.display = "flex";
    document.getElementById("custom-confirm-btn").onclick = function() { if(confirmCallback) confirmCallback(); closeCustomConfirm(); };
}
function closeCustomConfirm() { document.getElementById("custom-confirm-modal").style.display = "none"; confirmCallback = null; }

function closeDeleteReasonModal() { document.getElementById("delete-reason-modal").style.display = "none"; }
function confirmDeleteWithReason() {
    const reason = document.getElementById("delete-reason-input").value.trim();
    if(!reason) { showCustomAlert("Please enter a reason for deletion.", "Required", "⚠️"); return; }
    const targetId = document.getElementById("delete-target-id").value;
    const type = document.getElementById("delete-target-type").value;
    closeDeleteReasonModal();
    if (type === 'invoice') executeDeleteInvoice(targetId, reason); else if (type === 'po') executeDeletePO(targetId, reason);
}

function showDeleteReason(id, type) {
    let doc;
    if (type === 'invoice') doc = appData.history.find(x => x.id === id);
    else if (type === 'po') doc = appData.purchaseOrders.find(x => x.id === id);
    document.getElementById("view-reason-text").innerText = doc && doc.deleteReason ? doc.deleteReason : "No reason provided.";
    document.getElementById("view-reason-modal").style.display = "flex";
}
function closeViewReasonModal() { document.getElementById("view-reason-modal").style.display = "none"; }

let exitConfirmed = false;

function switchScreen(screenId, pushHistory = true) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    const navBtn = document.getElementById(`nav-${screenId.replace('screen-','')}`);
    if(navBtn) navBtn.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && sidebar.classList.contains('open')) toggleMenu();
    if (pushHistory) window.history.pushState({ id: screenId }, "", "#" + screenId);
}

window.addEventListener('popstate', (event) => {
    if (exitConfirmed || !auth.currentUser) return;
    let overlayClosed = false;
    const modals = [
        { id: 'receipt-viewer-modal', closeFn: closeReceiptViewer },
        { id: 'delete-reason-modal', closeFn: closeDeleteReasonModal },
        { id: 'view-reason-modal', closeFn: closeViewReasonModal },
        { id: 'payout-modal', closeFn: closePayoutModal },
        { id: 'custom-confirm-modal', closeFn: closeCustomConfirm },
        { id: 'custom-alert-modal', closeFn: closeCustomAlert }
    ];
    for (let m of modals) {
        const el = document.getElementById(m.id);
        if (el && (el.style.display === 'flex' || el.style.display === 'block')) { m.closeFn(); overlayClosed = true; }
    }
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && sidebar.classList.contains('open')) { toggleMenu(); overlayClosed = true; }

    if (overlayClosed) { window.history.pushState(event.state, "", window.location.hash); return; }

    if (event.state && event.state.id) { switchScreen(event.state.id, false); } 
    else {
        showCustomConfirm("Are you sure you want to exit the application?", () => { exitConfirmed = true; window.history.go(-2); }, "Yes, Exit");
        window.history.pushState({ exitPrompt: true }, "", "#exit");
    }
});