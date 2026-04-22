// js/10-pos.js

function openPOSScreen() {
    switchScreen('screen-pos');
    renderPOSGrid();
    renderPOSTabs();
    renderPOSCart();
}

function renderPOSGrid() {
    const grid = document.getElementById('pos-product-grid');
    
    grid.innerHTML = appData.inventory.map(p => {
        const stock = p.inStock || 0;
        const imgSrc = p.images && p.images.length > 0 ? p.images[0] : null;
        
        const imgHTML = imgSrc 
            ? `<img src="${imgSrc}" class="pos-item-img">`
            : `<div class="pos-item-img">${p.name.charAt(0).toUpperCase()}</div>`;
            
        // 🌟 Pull the Retail Price for the visual grid (fallback to WSP if old item)
        const displayPrice = p.retailPrice || p.price || 0;
        
        return `
        <div class="col" onclick="handlePosItemClick('${p.id}', event)">
            <div class="pos-item-card ${stock <= 0 ? 'opacity-50' : ''}">
                ${imgHTML}
                <div class="pos-item-details">
                    <div class="fw-bold text-dark font-13 lh-sm mb-1">${p.name}</div>
                    <div class="d-flex justify-content-between align-items-center w-100 mt-2">
                        <span class="text-maroon fw-bold font-13">₹${displayPrice.toFixed(2)}</span>
                        <span class="badge ${stock > 0 ? 'bg-success' : 'bg-danger'} font-11">${stock > 0 ? stock : 'Out'}</span>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function handlePosItemClick(pid, event) {
    const product = appData.inventory.find(x => x.id === pid);
    if ((product.inStock || 0) <= 0) return showCustomAlert("This item is currently out of stock!", "Stock Error", "❌");

    if (!activePosCartId) {
        pendingPosItemAdd = product; 
        document.getElementById('pos-cust-name').value = "";
        document.getElementById('pos-cust-phone').value = "";
        document.getElementById('pos-customer-modal').style.display = "flex";
        document.getElementById('pos-customer-modal').style.zIndex = "10020";
    } else {
        addPosItemToActiveCart(product);
        
        if (window.innerWidth < 992 && event) {
            animateItemToCart(product.name, event);
        }
    }
}

function animateItemToCart(itemName, event) {
    const cartIcon = document.querySelector('.pos-header-btn');
    if (!cartIcon || !event) return;

    let startX = event.clientX;
    let startY = event.clientY;
    if (event.touches && event.touches.length > 0) {
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
    }

    const rect = cartIcon.getBoundingClientRect();
    const endX = rect.left + rect.width / 2;
    const endY = rect.top + rect.height / 2;

    const flyingEl = document.createElement('div');
    flyingEl.className = 'fly-to-cart';
    flyingEl.innerText = itemName;
    
    flyingEl.style.left = startX + 'px';
    flyingEl.style.top = startY + 'px';
    document.body.appendChild(flyingEl);

    void flyingEl.offsetWidth;

    const deltaX = endX - startX;
    const deltaY = endY - startY;

    flyingEl.style.transform = `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(0.1)`;
    flyingEl.style.opacity = '0';

    setTimeout(() => {
        flyingEl.remove();
    }, 1200); 
}

function cancelPOSCustomer() {
    pendingPosItemAdd = null;
    document.getElementById('pos-customer-modal').style.display = "none";
}

function confirmPOSCustomer() {
    const name = document.getElementById('pos-cust-name').value.trim() || "Walk-in Customer";
    const phone = document.getElementById('pos-cust-phone').value.trim();
    
    const newCartId = 'pos-' + Date.now();
    posCarts.push({ id: newCartId, name: name, phone: phone, items: [] });
    
    activePosCartId = newCartId;
    document.getElementById('pos-customer-modal').style.display = "none";
    
    if (pendingPosItemAdd) {
        addPosItemToActiveCart(pendingPosItemAdd);
        pendingPosItemAdd = null;
    }
    
    renderPOSTabs();
    renderPOSCart();
}

function addPosItemToActiveCart(product) {
    const cartObj = posCarts.find(c => c.id === activePosCartId);
    if (!cartObj) return;

    const existing = cartObj.items.find(i => i.id === product.id);
    const currentQty = existing ? existing.qty : 0;

    let availableStock = product.inStock || 0;
    if (currentQty + 1 > availableStock) {
        return showCustomAlert("Cannot add more. Retail limit reached based on available physical stock!", "Stock Limit", "📦");
    }

    if (existing) { 
        existing.qty += 1; 
    } else { 
        // 🌟 FORCE RETAIL PRICE INTO POS CART
        const posPrice = product.retailPrice || product.price || 0;
        cartObj.items.push({ ...product, qty: 1, price: posPrice, gstPercent: product.gstPercent }); 
    }
    
    renderPOSCart();
}

function removePosItem(pid) {
    const cartObj = posCarts.find(c => c.id === activePosCartId);
    if (!cartObj) return;
    
    const idx = cartObj.items.findIndex(i => i.id === pid);
    if (idx > -1) {
        cartObj.items.splice(idx, 1);
        renderPOSCart();
    }
}

function switchPosCart(cartId) {
    activePosCartId = cartId;
    renderPOSTabs();
    renderPOSCart();
}

function createNewPosCart() {
    pendingPosItemAdd = null;
    document.getElementById('pos-cust-name').value = "";
    document.getElementById('pos-cust-phone').value = "";
    document.getElementById('pos-customer-modal').style.display = "flex";
    document.getElementById('pos-customer-modal').style.zIndex = "10020";
}

function promptClosePosCart(cartId, event) {
    if (event) event.stopPropagation();
    const cart = posCarts.find(c => c.id === cartId);
    if (!cart) return;
    showCustomConfirm(`Are you sure you want to cancel the bill for "${cart.name}"? This will clear all items in their cart.`, () => executeClosePosCart(cartId), "Yes, Cancel Bill");
}

function executeClosePosCart(cartId) {
    posCarts = posCarts.filter(c => c.id !== cartId);
    if (activePosCartId === cartId) activePosCartId = posCarts.length > 0 ? posCarts[0].id : null;
    renderPOSTabs();
    renderPOSCart();
}

function renderPOSTabs() {
    const container = document.getElementById('pos-tabs');
    if (posCarts.length === 0) { container.innerHTML = ""; return; }
    
    let html = posCarts.map(cart => `
        <div class="pos-tab ${cart.id === activePosCartId ? 'active' : ''}" onclick="switchPosCart('${cart.id}')">
            🛍️ ${cart.name}
            <span class="pos-tab-close" onclick="promptClosePosCart('${cart.id}', event)">✕</span>
        </div>
    `).join('');
    
    html += `<div class="pos-tab bg-white text-dark" onclick="createNewPosCart()">➕ New Customer</div>`;
    container.innerHTML = html;
}

function renderPOSCart() {
    const container = document.getElementById('pos-cart-container');
    const countEl = document.getElementById('pos-cart-count');
    const totalEl = document.getElementById('pos-cart-total');
    const btnCheckout = document.getElementById('btn-pos-checkout');

    const cartObj = posCarts.find(c => c.id === activePosCartId);
    
    if (!cartObj || cartObj.items.length === 0) {
        countEl.innerText = "0"; totalEl.innerText = "₹0.00"; btnCheckout.classList.add('d-none');
        container.innerHTML = `<div class="text-center p-4 text-muted small border rounded-3 bg-white">Cart is empty. Tap an item to add.</div>`;
        return;
    }

    let totalQty = 0; let grandTotal = 0;

    container.innerHTML = cartObj.items.map(item => {
        totalQty += item.qty;
        const baseAmt = item.qty * item.price;
        const gstAmt = baseAmt * (item.gstPercent / 100);
        grandTotal += (baseAmt + gstAmt);

        return `
        <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-white border rounded shadow-sm">
            <div class="font-13">
                <div class="fw-bold text-dark lh-1 mb-1">${item.name}</div>
                <div class="text-muted" style="font-size:11px;">₹${item.price.toFixed(2)} + ${item.gstPercent}% GST</div>
            </div>
            <div class="d-flex align-items-center gap-2">
                <span class="badge bg-secondary rounded-pill" style="font-size:12px;">x${item.qty}</span>
                <button class="btn btn-sm btn-light text-danger fw-bold py-0 px-2 border shadow-sm" onclick="removePosItem('${item.id}')">X</button>
            </div>
        </div>`;
    }).join('');

    countEl.innerText = totalQty;
    totalEl.innerText = `₹${Math.round(grandTotal).toFixed(2)}`;
    btnCheckout.classList.remove('d-none');
}

// ========================================================
// 🌟 ADVANCED CONTINUOUS SCANNING ENGINE
// ========================================================

let html5QrcodeScanner = null;
let lastScannedCode = "";
let lastScanTime = 0;

function showToastMessage(msg, isError = false) {
    const existing = document.getElementById('pos-quick-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'pos-quick-toast';
    toast.className = 'pos-toast';
    toast.style.backgroundColor = isError ? '#ef4444' : '#10b981';
    toast.innerText = msg;
    document.body.appendChild(toast);
    
    void toast.offsetWidth; 
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';

    setTimeout(() => {
        if(document.body.contains(toast)) {
            toast.style.opacity = '0';
            toast.style.transform = 'translate(-50%, -20px)';
            setTimeout(() => {
                if(document.body.contains(toast)) toast.remove();
            }, 300);
        }
    }, 3000);
}

function initiateBarcodeScan() {
    const isMobile = window.innerWidth < 992;
    if (isMobile) {
        openCameraScanner(); 
    } else {
        showToastMessage("📟 Hardware Scanner Ready! Start scanning.");
    }
}

function initiateQRScan() {
    openCameraScanner(); 
}

function openCameraScanner() {
    document.getElementById('scanner-modal').style.display = 'flex';
    html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

function closeCameraScanner() {
    document.getElementById('scanner-modal').style.display = 'none';
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(err => console.error("Scanner clear error", err));
        html5QrcodeScanner = null;
    }
}

function onScanSuccess(decodedText) {
    const now = Date.now();
    if (decodedText === lastScannedCode && (now - lastScanTime) < 2000) {
        return; 
    }
    
    lastScannedCode = decodedText;
    lastScanTime = now;

    processScannedCode(decodedText);
}

function onScanFailure(error) { }

function processScannedCode(code) {
    const cleanedCode = code.trim().toLowerCase();
    
    const product = appData.inventory.find(p => 
        p.id.toLowerCase() === cleanedCode || 
        p.name.toLowerCase() === cleanedCode ||
        (p.barcode && p.barcode.toLowerCase() === cleanedCode) ||
        (p.qrcode && p.qrcode.toLowerCase() === cleanedCode)
    );
    
    if (product) {
        if (!activePosCartId) {
            closeCameraScanner();
            handlePosItemClick(product.id, null); 
            showToastMessage("Please enter customer details to start billing.", true);
        } else {
            handlePosItemClick(product.id, null); 
            showToastMessage(`✅ ${product.name} added to cart!`);
        }
    } else {
        showToastMessage(`❌ Unrecognized code: ${code}`, true);
    }
}

let hwBarcodeString = "";
let hwBarcodeTimeout;

document.addEventListener('keydown', (e) => {
    const posScreen = document.getElementById('screen-pos');
    if (!posScreen || !posScreen.classList.contains('active')) return;

    const activeTag = document.activeElement.tagName;
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;

    if (e.key === 'Enter') {
        if (hwBarcodeString.length > 2) {
            processScannedCode(hwBarcodeString);
        }
        hwBarcodeString = "";
    } else if (e.key.length === 1) { 
        hwBarcodeString += e.key;
        clearTimeout(hwBarcodeTimeout);
        
        hwBarcodeTimeout = setTimeout(() => {
            hwBarcodeString = ""; 
        }, 50); 
    }
});