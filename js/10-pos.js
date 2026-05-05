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
    
    let reservedQty = 0;
    posCarts.forEach(cart => {
        const existingInCart = cart.items.find(i => i.id === product.id);
        if (existingInCart) {
            reservedQty += existingInCart.qty;
        }
    });
    
    let physicalStock = product.inStock || 0;
    
    if (reservedQty >= physicalStock) {
        showToastMessage(`❌ Stock limit reached for ${product.name}`, true);
        return showCustomAlert(`You only have ${physicalStock} unit(s) of "${product.name}" in stock, and they are currently reserved in your active checkout tabs!`, "Item Reserved", "📦");
    }

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
    resumeScannerAfterCustomer = false; 
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

    if (resumeScannerAfterCustomer) {
        resumeScannerAfterCustomer = false; 
        setTimeout(() => { openCameraScanner(); }, 300); 
    }
}

function addPosItemToActiveCart(product) {
    const cartObj = posCarts.find(c => c.id === activePosCartId);
    if (!cartObj) return;

    const existing = cartObj.items.find(i => i.id === product.id);

    if (existing) { 
        existing.qty += 1; 
    } else { 
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

// 🌟 UPDATED: Removed the pull-bar-count logic
function renderPOSCart() {
    const container = document.getElementById('pos-cart-container');
    const countEl = document.getElementById('pos-cart-count');
    const totalEl = document.getElementById('pos-cart-total');
    
    const btnCheckout = document.getElementById('btn-pos-checkout');
    const btnQc = document.getElementById('btn-pos-qc');

    const cartObj = posCarts.find(c => c.id === activePosCartId);
    
    if (!cartObj || cartObj.items.length === 0) {
        countEl.innerText = "0"; totalEl.innerText = "₹0.00"; 
        if(btnCheckout) btnCheckout.style.display = 'none';
        if(btnQc) btnQc.style.display = 'none';
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
    
    if(btnCheckout) btnCheckout.style.display = 'block';
    if(btnQc) btnQc.style.display = 'flex';
}

// ========================================================
// 🌟 NEW: CHECKOUT REVIEW MODAL LOGIC
// ========================================================

function openCheckoutReview() {
    if (posCart.length === 0) return showCustomAlert("Cart is empty!", "Notice", "⚠️");
    
    const container = document.getElementById('review-cart-items');
    container.innerHTML = '';
    
    posCart.forEach((item, index) => {
        // Default discount to 0 if not set
        item.discount = item.discount || 0; 
        
        const itemHtml = `
            <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-white border rounded">
                <div style="width: 40%;">
                    <div class="fw-bold text-dark font-13">${item.name}</div>
                    <div class="small text-muted">${item.qty} x ₹${item.price}</div>
                </div>
                <div style="width: 30%;">
                    <div class="input-group input-group-sm">
                        <span class="input-group-text text-danger">-₹</span>
                        <input type="number" class="form-control" value="${item.discount}" 
                            oninput="updateItemDiscount(${index}, this.value)" placeholder="Disc">
                    </div>
                </div>
                <div class="fw-bold text-end" style="width: 30%; color: #0b2a5c;">
                    ₹${((item.price * item.qty) - item.discount).toFixed(2)}
                </div>
            </div>
        `;
        container.innerHTML += itemHtml;
    });

    document.getElementById('pos-checkout-modal').style.display = 'flex';
    document.getElementById('review-overall-discount').value = 0; // Reset overall discount
    recalculateReviewTotal();
}

function closeCheckoutReview() {
    document.getElementById('pos-checkout-modal').style.display = 'none';
}

function renderCheckoutReviewModal() {
    const cartObj = posCarts.find(c => c.id === activePosCartId);
    const container = document.getElementById('review-cart-items');
    
    if (!cartObj || cartObj.items.length === 0) {
        closeCheckoutReview();
        return;
    }

    let html = '';
    let grandTotal = 0;

    cartObj.items.forEach(item => {
        const baseAmt = item.qty * item.price;
        const gstAmt = baseAmt * (item.gstPercent / 100);
        const rowTotal = baseAmt + gstAmt;
        grandTotal += rowTotal;

        html += `
        <div class="d-flex justify-content-between align-items-center mb-3 p-3 bg-white border rounded shadow-sm">
            <div class="font-13 flex-grow-1">
                <div class="fw-bold text-dark lh-1 mb-1" style="font-size: 14px;">${item.name}</div>
                <div class="text-muted" style="font-size:11px;">₹${item.price.toFixed(2)} + ${item.gstPercent}% GST</div>
                <div class="fw-bold text-maroon mt-1">₹${rowTotal.toFixed(2)}</div>
            </div>
            <div class="d-flex align-items-center gap-1">
                <button class="btn btn-light border fw-bold px-3 py-1 shadow-sm rounded-start" onclick="updateReviewQty('${item.id}', -1)">-</button>
                <div class="bg-light border-top border-bottom fw-bold px-3 py-1 text-center" style="min-width: 40px;">${item.qty}</div>
                <button class="btn btn-light border fw-bold px-3 py-1 shadow-sm rounded-end" onclick="updateReviewQty('${item.id}', 1)">+</button>
                <button class="btn btn-danger px-2 py-1 ms-2 shadow-sm rounded" onclick="updateReviewQty('${item.id}', 'remove')">🗑️</button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
    document.getElementById('review-grand-total').innerText = `₹${Math.round(grandTotal).toFixed(2)}`;
}

function updateReviewQty(pid, change) {
    const cartObj = posCarts.find(c => c.id === activePosCartId);
    if (!cartObj) return;
    
    const idx = cartObj.items.findIndex(i => i.id === pid);
    if (idx === -1) return;

    const product = appData.inventory.find(p => p.id === pid);
    const physicalStock = product ? (product.inStock || 0) : 0;

    if (change === 'remove') {
        cartObj.items.splice(idx, 1);
    } else {
        const newQty = cartObj.items[idx].qty + change;
        if (newQty <= 0) {
            cartObj.items.splice(idx, 1);
        } else if (newQty > physicalStock) {
            return showCustomAlert(`Cannot add more. Only ${physicalStock} in stock!`, "Stock Limit", "📦");
        } else {
            cartObj.items[idx].qty = newQty;
        }
    }

    renderPOSCart(); // Keep the background UI synced
    renderCheckoutReviewModal(); // Re-render the modal with new numbers
}


async function confirmReviewCheckout() {
    const paymentMode = document.getElementById('review-payment-mode').value;
    const overallDiscount = parseFloat(document.getElementById('review-overall-discount').value) || 0;
    const grandTotal = recalculateReviewTotal();

    // Determine status based on payment mode
    const paymentStatus = (paymentMode === 'credit') ? 'pending' : 'paid';

    // Build your invoice object
    const invoiceData = {
        tenantId: currentUserTenantId,
        type: 'retail', // Differentiate from B2B
        customerName: document.getElementById('pos-cust-name').value || "Walk-in Customer",
        items: posCart, // Now includes item.discount
        subTotal: grandTotal + overallDiscount,
        overallDiscount: overallDiscount,
        totalAmount: grandTotal,
        paymentMode: paymentMode,
        paymentStatus: paymentStatus,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    // -> (Keep your existing code here that saves invoiceData to Firestore and generates the PDF)
        closeCheckoutReview();
		generatePreview('pos');  // Proceeds with the standard checkout engine
    // Example:
    // await db.collection('history').add(invoiceData);
    // showToastMessage(`Invoice generated. Status: ${paymentStatus.toUpperCase()}`);
    // closeCheckoutReview();
}

// ========================================================
// 🌟 ADVANCED CONTINUOUS SCANNING ENGINE
// ========================================================

let html5QrcodeScanner = null;
let lastScannedCode = "";
let lastScanTime = 0;
let resumeScannerAfterCustomer = false; 

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
            resumeScannerAfterCustomer = true; 
            closeCameraScanner();
            handlePosItemClick(product.id, null); 
            showToastMessage("Please enter customer details to start billing.", true);
        } else {
            handlePosItemClick(product.id, null); 
            const activeCartObj = posCarts.find(c => c.id === activePosCartId);
            const isInCart = activeCartObj && activeCartObj.items.some(i => i.id === product.id);
            if(isInCart) showToastMessage(`✅ ${product.name} added to cart!`);
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
// ========================================================
// 🌟 MOBILE OFF-CANVAS CART LOGIC & SWIPE DETECTION
// ========================================================

function toggleMobileCart() {
    const wrapper = document.getElementById('pos-cart-wrapper');
    const overlay = document.getElementById('mobile-cart-overlay');
    
    if (wrapper.classList.contains('open')) {
        closeMobileCart();
    } else {
        wrapper.classList.add('open');
        overlay.classList.add('show');
    }
}

function closeMobileCart() {
    const wrapper = document.getElementById('pos-cart-wrapper');
    const overlay = document.getElementById('mobile-cart-overlay');
    if(wrapper) wrapper.classList.remove('open');
    if(overlay) overlay.classList.remove('show');
}

// 🌟 Native Mobile Swipe Support
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
}, {passive: true});

document.addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    handleMobileSwipe();
}, {passive: true});

function handleMobileSwipe() {
    const posScreen = document.getElementById('screen-pos');
    if (!posScreen || !posScreen.classList.contains('active')) return;
    
    const wrapper = document.getElementById('pos-cart-wrapper');
    
    // Swipe Right to Open (Only if starting from the left edge)
    if (touchEndX - touchStartX > 60 && touchStartX < 50) {
        if (wrapper && !wrapper.classList.contains('open')) toggleMobileCart();
    }
    
    // Swipe Left to Close (Only if drawer is open)
    if (touchStartX - touchEndX > 60) {
        if (wrapper && wrapper.classList.contains('open')) closeMobileCart();
    }
}