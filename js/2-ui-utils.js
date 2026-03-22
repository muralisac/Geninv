function toggleMenu() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
    } else {
        overlay.style.display = 'block';
        setTimeout(() => { 
            overlay.style.opacity = '1'; 
            sidebar.classList.add('open');
        }, 10);
    }
}

function getLocalYMD(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function createDateFromYMD(ymdStr) {
    if (!ymdStr) return new Date();
    const parts = ymdStr.split('-');
    if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]);
    return new Date();
}

function showCustomAlert(message, title = "Notice", icon = "⚠️") {
    document.getElementById("custom-alert-message").innerText = message;
    document.getElementById("custom-alert-title").innerText = title;
    document.getElementById("custom-alert-icon").innerText = icon;
    document.getElementById("custom-alert-modal").style.display = "flex";
}

function closeCustomAlert() {
    document.getElementById("custom-alert-modal").style.display = "none";
}

let confirmCallback = null;
function showCustomConfirm(message, callback, btnText = "Yes, Confirm") {
    document.getElementById("custom-confirm-message").innerText = message;
    confirmCallback = callback;
    document.getElementById("custom-confirm-btn").innerText = btnText;
    document.getElementById("custom-confirm-modal").style.display = "flex";
    document.getElementById("custom-confirm-btn").onclick = function() {
        if(confirmCallback) confirmCallback(); 
        closeCustomConfirm();
    };
}

function closeCustomConfirm() {
    document.getElementById("custom-confirm-modal").style.display = "none";
    confirmCallback = null; 
}

function closeDeleteReasonModal() {
    document.getElementById("delete-reason-modal").style.display = "none";
}

function showDeleteReason(id, type) {
    let doc;
    if (type === 'invoice') doc = appData.history.find(x => x.id === id);
    else if (type === 'po') doc = appData.purchaseOrders.find(x => x.id === id);
    
    document.getElementById("view-reason-text").innerText = doc && doc.deleteReason ? doc.deleteReason : "No reason provided.";
    document.getElementById("view-reason-modal").style.display = "flex";
}

function closeViewReasonModal() {
    document.getElementById("view-reason-modal").style.display = "none";
}

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    const navBtn = document.getElementById(`nav-${screenId.replace('screen-','')}`);
    if(navBtn) navBtn.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar.classList.contains('open')) toggleMenu();
}

function numberToWords(amount) { 
    const words = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]; 
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]; 
    function convert(num) { 
        if (num < 20) return words[num]; 
        if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? " " + words[num % 10] : ""); 
        if (num < 1000) return words[Math.floor(num / 100)] + " Hundred" + (num % 100 !== 0 ? " and " + convert(num % 100) : ""); 
        if (num < 100000) return convert(Math.floor(num / 1000)) + " Thousand" + (num % 1000 !== 0 ? " " + convert(num % 1000) : ""); 
        if (num < 10000000) return convert(Math.floor(num / 100000)) + " Lakh" + (num % 100000 !== 0 ? " " + convert(num % 100000) : ""); 
        return convert(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 !== 0 ? " " + convert(num % 10000000) : ""); 
    } 
    let rupees = Math.floor(amount);
    let paise = Math.round((amount - rupees) * 100); 
    return (rupees === 0 ? "Zero" : convert(rupees)) + " Rupees" + (paise === 0 ? "" : " and " + convert(paise) + " paise") + " only."; 
}