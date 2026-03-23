// js/6-cart-builder.js

function openNewInvoice() { 
    if(!isAdmin) return;
    currentDocType = "invoice"; editingDocId = null; currentCart = []; 
    document.getElementById("customer-select").value = ""; 
    document.getElementById("builder-title").innerText = "New Sales Invoice"; 
    document.getElementById("editing-invoice-label").innerText = "Drafting document..."; 
    
    const d = new Date(); 
    tempDocNumber = `NN-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${appData.lastInvoiceNum + 1}`; 
    document.getElementById("inv-date-input").value = getLocalYMD(d);
    
    renderCartUI('invoice'); 
    switchScreen('screen-builder'); 
}

function autoFillInvoicePrice() {
    const pid = document.getElementById("product-select").value;
    if (!pid) return;
    const product = appData.inventory.find(p => p.id === pid);
    document.getElementById("inv-price-input").value = product.price || 0;
    document.getElementById("inv-gst-input").value = product.gstPercent || 0;
}

function addItemToCart() { 
    if(!isAdmin) return;
    const pid = document.getElementById("product-select").value; 
    const qty = parseInt(document.getElementById("qty-input").value); 
    const customPrice = parseFloat(document.getElementById("inv-price-input").value);
    const customGst = parseFloat(document.getElementById("inv-gst-input").value);
    
    if (!pid || !qty || qty <= 0 || isNaN(customPrice) || isNaN(customGst)) return showCustomAlert("Please fill all item fields."); 
    const product = appData.inventory.find(p => p.id === pid); 
    if (qty < product.moq) return showCustomAlert(`MOQ for ${product.name} is ${product.moq}.`); 
    
    let availableStock = product.inStock || 0;
    if (editingDocId) {
        const oldDoc = appData.history.find(h => h.id === editingDocId);
        if (oldDoc && oldDoc.cart) { 
            const oldItem = oldDoc.cart.find(i => i.id === pid); 
            if (oldItem) availableStock += oldItem.qty; 
        }
    }
    
    const existing = currentCart.find(item => item.id === pid); 
    const currentCartQty = existing ? existing.qty : 0;
    if ((currentCartQty + qty) > availableStock) return showCustomAlert("Out of Stock! Place a PO.", "Stock Error", "📦");
    
    if (existing) { 
        existing.qty += qty; existing.price = customPrice; existing.gstPercent = customGst; 
    } else {
        currentCart.push({ ...product, qty: qty, price: customPrice, gstPercent: customGst }); 
    }
    
    document.getElementById("qty-input").value = ""; 
    document.getElementById("inv-price-input").value = ""; 
    document.getElementById("inv-gst-input").value = ""; 
    document.getElementById("product-select").value = "";
    renderCartUI('invoice'); 
}

function openNewPO() { 
    if(!isAdmin) return;
    currentDocType = "po"; editingDocId = null; currentCart = []; 
    document.getElementById("po-vendor-select").value = ""; 
    document.getElementById("po-vendor-select").disabled = false; 
    document.getElementById("po-price-input").value = ""; 
    document.getElementById("po-gst-input").value = ""; 
    document.getElementById("po-builder-title").innerText = "New Purchase Order"; 
    document.getElementById("po-editing-label").innerText = "Drafting PO..."; 
    document.getElementById("po-add-item-panel").style.display = "block";
    document.getElementById("btn-save-po").style.display = "block";
    
    const d = new Date(); 
    tempDocNumber = `PO-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${appData.lastPoNum + 1}`; 
    document.getElementById("po-date-input").value = getLocalYMD(d);
    
    renderCartUI('po'); 
    switchScreen('screen-po-builder'); 
}

function autoFillPoPrice() {
    const pid = document.getElementById("po-product-select").value; 
    if(!pid) return;
    const product = appData.inventory.find(p => p.id === pid);
    document.getElementById("po-price-input").value = product.purchasePrice || product.price; 
    document.getElementById("po-gst-input").value = product.gstPercent || 0; 
}

function addPoItemToCart() { 
    if(!isAdmin) return;
    const pid = document.getElementById("po-product-select").value; 
    const qty = parseInt(document.getElementById("po-qty-input").value); 
    const customPrice = parseFloat(document.getElementById("po-price-input").value);
    const customGst = parseFloat(document.getElementById("po-gst-input").value);
    
    if (!pid || !qty || qty <= 0 || isNaN(customPrice) || isNaN(customGst)) return showCustomAlert("Please fill all item fields."); 
    
    const product = appData.inventory.find(p => p.id === pid); 
    const existing = currentCart.find(item => item.id === pid); 
    
    if (existing) { 
        existing.qty += qty; existing.price = customPrice; existing.gstPercent = customGst; 
    } else { 
        currentCart.push({ ...product, qty: qty, price: customPrice, gstPercent: customGst }); 
    } 
    
    document.getElementById("po-qty-input").value = ""; 
    document.getElementById("po-price-input").value = ""; 
    document.getElementById("po-gst-input").value = ""; 
    document.getElementById("po-product-select").value = ""; 
    renderCartUI('po'); 
}

function removeCartItem(idx, type) { 
    currentCart.splice(idx, 1); 
    renderCartUI(type); 
}

function renderCartUI(type) { 
    const containerId = type === 'po' ? "po-cart-container" : "cart-container"; 
    const countId = type === 'po' ? "po-cart-count" : "cart-count"; 
    const themeColor = type === 'po' ? "#d97706" : "#0b2a5c";
    
    let isLocked = false;
    if (type === 'po' && editingDocId) {
        const po = appData.purchaseOrders.find(p => p.id === editingDocId);
        if (po && po.status === 'converted') isLocked = true;
    }
    
    document.getElementById(countId).innerText = `${currentCart.length} items`; 
    if(currentCart.length === 0) { 
        document.getElementById(containerId).innerHTML = `<div class="text-center p-4 text-muted small border rounded-4 bg-light">Cart is empty.</div>`; 
        return; 
    }
    
    document.getElementById(containerId).innerHTML = currentCart.map((item, idx) => `
        <div class="list-item">
            <div>
                <div class="fw-bold" style="color:${themeColor};">${item.name}</div>
                <div class="text-muted small fw-medium mt-1">Qty: ${item.qty} &nbsp;|&nbsp; @ ₹${item.price.toFixed(2)} (${item.gstPercent}%)</div>
            </div>
            ${!isLocked ? `<button class="btn btn-sm btn-light text-danger fw-bold shadow-sm" onclick="removeCartItem(${idx}, '${type}')">X</button>` : ''}
        </div>
    `).join(''); 
}