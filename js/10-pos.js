// js/10-pos.js

function openPOSScreen() {
    switchScreen('screen-pos');
    renderPOSGrid();
    renderPOSTabs();
    renderPOSCart();
}

function renderPOSGrid() {
    const grid = document.getElementById('pos-product-grid');
    
    // Render all active products for the POS screen
    grid.innerHTML = appData.inventory.map(p => {
        const stock = p.inStock || 0;
        const imgSrc = p.images && p.images.length > 0 ? p.images[0] : null;
        
        // Show image if it exists, otherwise show a stylish initial letter
        const imgHTML = imgSrc 
            ? `<img src="${imgSrc}" class="pos-item-img">`
            : `<div class="pos-item-img">${p.name.charAt(0).toUpperCase()}</div>`;
        
        return `
        <div class="col" onclick="handlePosItemClick('${p.id}')">
            <div class="pos-item-card ${stock <= 0 ? 'opacity-50' : ''}">
                ${imgHTML}
                <div class="pos-item-details">
                    <div class="fw-bold text-dark font-13 lh-sm mb-1">${p.name}</div>
                    <div class="d-flex justify-content-between align-items-center w-100 mt-2">
                        <span class="text-maroon fw-bold font-13">₹${p.price.toFixed(2)}</span>
                        <span class="badge ${stock > 0 ? 'bg-success' : 'bg-danger'} font-11">${stock > 0 ? stock : 'Out'}</span>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function handlePosItemClick(pid) {
    const product = appData.inventory.find(x => x.id === pid);
    if ((product.inStock || 0) <= 0) return showCustomAlert("This item is currently out of stock!", "Stock Error", "❌");

    // If no active customer cart exists, force them to create one first
    if (!activePosCartId) {
        pendingPosItemAdd = product; // Remember what they clicked!
        document.getElementById('pos-cust-name').value = "";
        document.getElementById('pos-cust-phone').value = "";
        document.getElementById('pos-customer-modal').style.display = "flex";
    } else {
        addPosItemToActiveCart(product);
    }
}

function cancelPOSCustomer() {
    pendingPosItemAdd = null;
    document.getElementById('pos-customer-modal').style.display = "none";
}

// Start a new cart session
function confirmPOSCustomer() {
    const name = document.getElementById('pos-cust-name').value.trim() || "Walk-in Customer";
    const phone = document.getElementById('pos-cust-phone').value.trim();
    
    const newCartId = 'pos-' + Date.now();
    posCarts.push({
        id: newCartId,
        name: name,
        phone: phone,
        items: []
    });
    
    activePosCartId = newCartId;
    document.getElementById('pos-customer-modal').style.display = "none";
    
    // Automatically add the item they clicked before the popup appeared
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

    // Strict Inventory Safeguard
    let availableStock = product.inStock || 0;
    if (currentQty + 1 > availableStock) {
        return showCustomAlert("Cannot add more. Retail limit reached based on available physical stock!", "Stock Limit", "📦");
    }

    if (existing) {
        existing.qty += 1;
    } else {
        cartObj.items.push({ ...product, qty: 1, price: product.price, gstPercent: product.gstPercent });
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
}

function renderPOSTabs() {
    const container = document.getElementById('pos-tabs');
    
    if (posCarts.length === 0) {
        container.innerHTML = "";
        document.getElementById('pos-active-customer').innerText = "Retail POS";
        return;
    }
    
    let html = posCarts.map(cart => `
        <div class="pos-tab ${cart.id === activePosCartId ? 'active' : ''}" onclick="switchPosCart('${cart.id}')">
            🛍️ ${cart.name}
        </div>
    `).join('');
    
    html += `<div class="pos-tab bg-white text-dark" onclick="createNewPosCart()">➕ New Customer</div>`;
    container.innerHTML = html;
    
    const active = posCarts.find(c => c.id === activePosCartId);
    if(active) {
        document.getElementById('pos-active-customer').innerText = "Billing: " + active.name;
    }
}

function renderPOSCart() {
    const container = document.getElementById('pos-cart-container');
    const countEl = document.getElementById('pos-cart-count');
    const totalEl = document.getElementById('pos-cart-total');
    const btnCheckout = document.getElementById('btn-pos-checkout');

    const cartObj = posCarts.find(c => c.id === activePosCartId);
    
    if (!cartObj || cartObj.items.length === 0) {
        countEl.innerText = "0";
        totalEl.innerText = "₹0.00";
        btnCheckout.classList.add('d-none');
        container.innerHTML = `<div class="text-center p-4 text-muted small border rounded-3 bg-white">Cart is empty. Tap an item to add.</div>`;
        return;
    }

    let totalQty = 0;
    let grandTotal = 0;

    container.innerHTML = cartObj.items.map(item => {
        totalQty += item.qty;
        const baseAmt = item.qty * item.price;
        const gstAmt = baseAmt * (item.gstPercent / 100);
        const rowTotal = baseAmt + gstAmt;
        grandTotal += rowTotal;

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