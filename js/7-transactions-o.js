function openNewInvoice() { 
    if(!isAdmin) return;
    currentDocType = "invoice"; editingDocId = null; currentCart = []; 
    document.getElementById("customer-select").value = ""; 
    document.getElementById("builder-title").innerText = "New Sales Invoice"; 
    document.getElementById("editing-invoice-label").innerText = "Drafting document..."; 
    document.getElementById("btn-delete-invoice").style.display = "none";
    
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
    
    if (!pid || !qty || qty <= 0 || isNaN(customPrice) || isNaN(customGst)) return showCustomAlert("Please fill all item fields properly."); 
    const product = appData.inventory.find(p => p.id === pid); 
    if (qty < product.moq) return showCustomAlert(`Wholesale Warning: MOQ for ${product.name} is ${product.moq}.`); 
    
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
    
    if ((currentCartQty + qty) > availableStock) {
        return showCustomAlert("Available quantity is less than your need. Place a Purchase order and then create invoice.", "Out of Stock", "📦");
    }
    
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
    document.getElementById("btn-delete-po").style.display = "none";
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
    
    if (!pid || !qty || qty <= 0 || isNaN(customPrice) || isNaN(customGst)) return showCustomAlert("Please fill all item fields properly."); 
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

async function generatePreview(type) { 
    if(!isAdmin) return;
    currentDocType = type; 
    const vendorSelectId = type === 'po' ? "po-vendor-select" : "customer-select"; 
    const btnContainer = type === 'po' ? "#screen-po-builder" : "#screen-builder";
    
    const custId = document.getElementById(vendorSelectId).value; 
    if (!custId) return showCustomAlert("Select a client/vendor."); 
    if (currentCart.length === 0) return showCustomAlert("Cart is empty."); 
    
    if (type === 'invoice') {
        const rawD = document.getElementById("inv-date-input").value;
        const d = createDateFromYMD(rawD);
        tempDocDate = d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
    } else if (type === 'po') {
        const rawD = document.getElementById("po-date-input").value;
        const d = createDateFromYMD(rawD);
        tempDocDate = d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
    }

    const saveBtn = document.querySelector(`${btnContainer} .btn-success`); 
    saveBtn.innerText = "⏳ Processing..."; 
    saveBtn.disabled = true; 
    
    const buyer = appData.customers.find(c => c.id === custId) || { name: "N/A", address: "N/A", gstin: "N/A", stateCode: SELLER_STATE }; 
    const { html, roundedGrandTotal } = renderInvoiceHTML(currentCart, type, buyer, tempDocNumber, tempDocDate);
    document.getElementById("invoice-content").innerHTML = html;
    
    let stockChanges = {};
    if (editingDocId) {
        const arrayRef = type === 'po' ? appData.purchaseOrders : appData.history;
        const oldDoc = arrayRef.find(h => h.id === editingDocId);
        let shouldReverse = type === 'invoice' || (type === 'po' && oldDoc && oldDoc.status === 'converted');
        if (oldDoc && oldDoc.cart && shouldReverse) {
            oldDoc.cart.forEach(item => {
                if (!stockChanges[item.id]) stockChanges[item.id] = 0;
                stockChanges[item.id] += (type === 'invoice') ? item.qty : -item.qty;
            });
        }
    }

    let isPOConverted = false;
    if (type === 'po' && editingDocId) {
        const existingPO = appData.purchaseOrders.find(h => h.id === editingDocId);
        if (existingPO && existingPO.status === 'converted') isPOConverted = true;
    }
    
    let shouldApplyNew = type === 'invoice' || (type === 'po' && isPOConverted);
    if(shouldApplyNew) {
        currentCart.forEach(item => {
            if (!stockChanges[item.id]) stockChanges[item.id] = 0;
            stockChanges[item.id] += (type === 'invoice') ? -item.qty : item.qty;
        });
    }

    const record = { 
        id: editingDocId || (type === 'po' ? 'po' : 'inv') + Date.now(), 
        invoiceNumber: tempDocNumber, date: tempDocDate, 
        customerId: buyer.id, customerName: buyer.name, 
        cart: JSON.parse(JSON.stringify(currentCart)), 
        totalAmount: roundedGrandTotal, paid: false, deleted: false,
        timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    }; 
    
    try { 
        const collectionName = type === 'po' ? "purchaseOrders" : "history"; 
        const arrayRef = type === 'po' ? appData.purchaseOrders : appData.history;
        
        if(type === 'po') { 
            const existingPO = appData.purchaseOrders.find(h => h.id === editingDocId); 
            record.status = existingPO ? (existingPO.status || 'converted') : 'created';
            if(existingPO && existingPO.payout) record.payout = existingPO.payout; 
        }
        
        if(type === 'invoice' && editingDocId) {
            const existingInv = appData.history.find(h => h.id === editingDocId);
            if(existingInv && existingInv.paid) record.paid = existingInv.paid;
        }
        
        const batch = db.batch();
        for (const [pid, change] of Object.entries(stockChanges)) {
            if (change !== 0) {
                const productIndex = appData.inventory.findIndex(p => p.id === pid);
                if (productIndex > -1) {
                    let currentStock = appData.inventory[productIndex].inStock || 0;
                    let newStock = currentStock + change;
                    appData.inventory[productIndex].inStock = newStock; 
                    batch.update(db.collection("inventory").doc(pid), { inStock: newStock });
                }
            }
        }
        
        batch.set(db.collection(collectionName).doc(record.id), record);
        await batch.commit(); 
        
        if (editingDocId) { 
            const idx = arrayRef.findIndex(h => h.id === editingDocId); 
            arrayRef[idx] = record; 
        } else { 
            arrayRef.unshift(record); 
            if(type === 'po') { 
                appData.lastPoNum++; 
                await db.collection("metadata").doc("invoiceData").update({ lastPoNum: appData.lastPoNum }); 
            } else { 
                appData.lastInvoiceNum++; 
                await db.collection("metadata").doc("invoiceData").update({ lastNum: appData.lastInvoiceNum }); 
            } 
        } 
        
        editingDocId = record.id;
        
        let canEditPrev = isAdmin;
        let canDeletePrev = isAdmin;

        if (type === 'po') {
            if (record.status === 'converted') canEditPrev = false;
            if (record.payout) { canEditPrev = false; canDeletePrev = false; }
        } else {
            if (record.paid) canEditPrev = false;
        }

        document.getElementById("btn-edit-preview").style.display = canEditPrev ? 'inline-block' : 'none';
        document.getElementById("btn-delete-preview").style.display = canDeletePrev ? 'inline-block' : 'none';

        if(type === 'po') { 
            renderPOList(); 
            if(record.status === 'converted') {
                document.getElementById("payout-status-container").style.display = "block";
                renderPayoutUI(record);
            } else {
                document.getElementById("payout-status-container").style.display = "none";
            }
        } else { 
            document.getElementById("payout-status-container").style.display = "none";
            renderHistoryList(); 
        }
        
        renderProductList(); 
        switchScreen('screen-preview'); 
    } catch (error) { 
        console.error(error); showCustomAlert("Failed to save to the cloud."); 
    } finally { 
        saveBtn.innerText = "💾 Save & Calculate"; saveBtn.disabled = false; 
    } 
}

function renderHistoryList() { 
    const list = document.getElementById("history-list"); 
    if(appData.history.length === 0) {
        list.innerHTML = `<div class="text-center p-5 text-muted bg-light rounded-4 border">No sales invoices yet.</div>`; 
        return;
    }
    list.innerHTML = appData.history.map(h => {
        if (h.deleted) {
            const reasonBtn = h.deleteReason ? `<button class="btn btn-sm border ms-2 py-0 px-2 shadow-sm" style="font-size: 11px; background: #fff; color: #0b2a5c; border-radius: 6px;" onclick="event.stopPropagation(); showDeleteReason('${h.id}', 'invoice')">💬 View Reason</button>` : '';
            return `<div class="list-item history-card" style="opacity: 0.6; border-left-color: #ef4444; background: #f8fafc;"><div style="flex-grow: 1; padding-left: 8px;"><strong class="text-danger text-decoration-line-through">${h.invoiceNumber}</strong> <span class="badge bg-danger ms-2">Deleted</span>${reasonBtn}<br><small class="text-muted fw-medium">${h.customerName} &nbsp;&bull;&nbsp; ${h.date}</small><div class="mt-1 fw-bold text-muted small">No items - Voided</div></div></div>`;
        }
        const isPaid = h.paid ? '<span class="badge bg-success ms-2">Paid</span>' : '<span class="badge bg-secondary ms-2">Pending</span>';
        const markPaidBtn = (!h.paid && isAdmin) ? `<button class="btn btn-success btn-sm action-btn shadow-sm me-2" onclick="event.stopPropagation(); markInvoicePaid('${h.id}')">💰 Mark Paid</button>` : '';
        const editBtn = (isAdmin && !h.paid) ? `<button class="btn btn-light action-btn border shadow-sm" onclick="event.stopPropagation(); loadOldDocumentForEdit('${h.id}', 'invoice')">Edit</button>` : '';
        return `<div class="list-item history-card" style="cursor: pointer;" onclick="viewOldDocument('${h.id}', 'invoice')"><div style="flex-grow: 1; padding-left: 8px;"><strong class="text-primary">${h.invoiceNumber}</strong> ${isPaid}<br><small class="text-muted fw-medium">${h.customerName} &nbsp;&bull;&nbsp; ${h.date}</small><div class="mt-1 fw-bold" style="color:#0b2a5c;">₹${h.totalAmount.toFixed(2)}</div></div><div class="d-flex align-items-center">${markPaidBtn}${editBtn}</div></div>`;
    }).join(''); 
}

async function markInvoicePaid(invoiceId) {
    if(!isAdmin) return;
    try {
        await db.collection("history").doc(invoiceId).update({ paid: true });
        const idx = appData.history.findIndex(h => h.id === invoiceId);
        if (idx > -1) { appData.history[idx].paid = true; renderHistoryList(); }
    } catch (error) { showCustomAlert("Failed to update payment status.", "Error", "🔴"); }
}

function renderPOList() { 
    const list = document.getElementById("po-list"); 
    if(appData.purchaseOrders.length === 0) {
        list.innerHTML = `<div class="text-center p-5 text-muted bg-light rounded-4 border">No purchase orders yet.</div>`; 
        return;
    }
    list.innerHTML = appData.purchaseOrders.map(h => {
        if (h.deleted) {
            const reasonBtn = h.deleteReason ? `<button class="btn btn-sm border ms-2 py-0 px-2 shadow-sm" style="font-size: 11px; background: #fff; color: #0b2a5c; border-radius: 6px;" onclick="event.stopPropagation(); showDeleteReason('${h.id}', 'po')">💬 View Reason</button>` : '';
            return `<div class="list-item po-card" style="opacity: 0.6; border-left-color: #ef4444; background: #f8fafc;"><div style="flex-grow: 1; padding-left: 8px;"><strong class="text-danger text-decoration-line-through">${h.invoiceNumber}</strong> <span class="badge bg-danger ms-2">Deleted</span>${reasonBtn}<br><small class="text-muted fw-medium">${h.customerName} &nbsp;&bull;&nbsp; ${h.date}</small><div class="mt-1 fw-bold text-muted small">No items - Voided</div></div></div>`;
        }
        const statusStr = h.status || 'converted';
        const isPaid = h.payout ? '<span class="badge bg-success ms-2">Paid</span>' : '<span class="badge bg-secondary ms-2">Pending</span>';
        const badges = statusStr === 'converted' ? `<span class="badge bg-primary ms-2">Converted</span> ${isPaid}` : '';
        let convertBtn = '', deleteBtn = '';
        if (statusStr === 'created' && isAdmin) {
            convertBtn = `<button class="btn btn-sm shadow-sm me-2 fw-bold" style="background-color: #38bdf8; color: white; border: none;" onclick="event.stopPropagation(); convertPO('${h.id}')">Created</button>`;
            deleteBtn = `<button class="btn btn-danger btn-sm shadow-sm" onclick="event.stopPropagation(); promptDeletePO('${h.id}')">🗑️</button>`;
        }
        if (statusStr === 'converted' && isAdmin && !h.payout) {
            deleteBtn = `<button class="btn btn-danger btn-sm shadow-sm ms-2" onclick="event.stopPropagation(); promptDeletePO('${h.id}')">🗑️</button>`;
        }
        const editBtn = (isAdmin && statusStr === 'created') ? `<button class="btn btn-light action-btn border shadow-sm me-2" onclick="event.stopPropagation(); loadOldDocumentForEdit('${h.id}', 'po')">Edit</button>` : '';
        
        return `<div class="list-item po-card" style="cursor: pointer;" onclick="viewOldDocument('${h.id}', 'po')"><div style="flex-grow: 1; padding-left: 8px;"><strong style="color:#d97706;">${h.invoiceNumber}</strong> ${badges}<br><small class="text-muted fw-medium">${h.customerName} &nbsp;&bull;&nbsp; ${h.date}</small><div class="mt-1 fw-bold" style="color:#0b2a5c;">₹${h.totalAmount.toFixed(2)}</div></div><div class="d-flex align-items-center">${convertBtn}${editBtn}${deleteBtn}</div></div>`;
    }).join(''); 
}

function convertPO(poId) {
    if(!isAdmin) return;
    showCustomConfirm("Mark this Purchase Order as Received? This will update your inventory.", async function() {
        try {
            const poIndex = appData.purchaseOrders.findIndex(p => p.id === poId);
            if(poIndex === -1) return;
            const po = appData.purchaseOrders[poIndex];
            const batch = db.batch();
            
            po.cart.forEach(item => {
                const prodIdx = appData.inventory.findIndex(p => p.id === item.id);
                if (prodIdx > -1) {
                    let newStock = (appData.inventory[prodIdx].inStock || 0) + item.qty;
                    appData.inventory[prodIdx].inStock = newStock;
                    batch.update(db.collection("inventory").doc(item.id), { inStock: newStock });
                }
            });
            batch.update(db.collection("purchaseOrders").doc(poId), { status: 'converted' });
            appData.purchaseOrders[poIndex].status = 'converted';
            await batch.commit();

            showCustomAlert("Purchase Order converted. Inventory updated.", "Success", "✅");
            renderPOList(); renderProductList();
        } catch (err) { showCustomAlert("Failed to convert Purchase Order.", "Error", "🔴"); }
    }, "Yes, Convert");
}

function viewOldDocument(id, type) {
    currentDocType = type; 
    const arrayRef = type === 'po' ? appData.purchaseOrders : appData.history; 
    const doc = arrayRef.find(h => h.id === id); 
    if (!doc) return;
    
    editingDocId = doc.id; 
    currentCart = JSON.parse(JSON.stringify(doc.cart)); 
    tempDocNumber = doc.invoiceNumber; 
    tempDocDate = doc.date;
    
    if (type === 'po') {
        document.getElementById("po-vendor-select").value = doc.customerId; 
        document.getElementById("po-builder-title").innerText = "Edit PO"; 
        renderCartUI('po');
    } else {
        document.getElementById("customer-select").value = doc.customerId; 
        document.getElementById("builder-title").innerText = "Edit Invoice"; 
        renderCartUI('invoice');
    }
    
    const buyer = appData.customers.find(c => c.id === doc.customerId) || { name: doc.customerName, address: "Address Data Unavailable", gstin: "N/A", stateCode: SELLER_STATE };
    const { html } = renderInvoiceHTML(doc.cart, type, buyer, tempDocNumber, tempDocDate);
    document.getElementById("invoice-content").innerHTML = html;
    
    let canEdit = isAdmin;
    let canDelete = isAdmin;

    if (type === 'po') { 
        const statusStr = doc.status || 'converted';
        if (statusStr === 'converted') {
            document.getElementById("payout-status-container").style.display = "block"; 
            renderPayoutUI(doc); 
            canEdit = false; 
        } else {
            document.getElementById("payout-status-container").style.display = "none"; 
            canEdit = true; 
        }
        if (doc.payout) { canEdit = false; canDelete = false; }
    } else { 
        document.getElementById("payout-status-container").style.display = "none"; 
        if (doc.paid) canEdit = false;
    }
    
    document.getElementById("btn-edit-preview").style.display = canEdit ? 'inline-block' : 'none';
    document.getElementById("btn-delete-preview").style.display = canDelete ? 'inline-block' : 'none';
    
    switchScreen('screen-preview');
}

function loadOldDocumentForEdit(id, type) {
    if(!isAdmin) return;
    currentDocType = type; 
    const arrayRef = type === 'po' ? appData.purchaseOrders : appData.history; 
    const doc = arrayRef.find(h => h.id === id); 
    if (!doc) return; 
    
    editingDocId = doc.id; 
    currentCart = JSON.parse(JSON.stringify(doc.cart)); 
    tempDocNumber = doc.invoiceNumber; 
    tempDocDate = doc.date; 
    
    if(type === 'po') { 
        const isConverted = doc.status === 'converted';
        const poParsedD = new Date(doc.date);
        document.getElementById("po-date-input").value = !isNaN(poParsedD) ? getLocalYMD(poParsedD) : getLocalYMD(new Date());

        document.getElementById("po-vendor-select").value = doc.customerId; 
        document.getElementById("po-vendor-select").disabled = isConverted; 
        document.getElementById("po-builder-title").innerText = isConverted ? "View PO" : "Edit PO"; 
        
        document.getElementById("btn-delete-po").style.display = "block";
        document.getElementById("po-add-item-panel").style.display = isConverted ? "none" : "block";
        document.getElementById("btn-save-po").style.display = isConverted ? "none" : "block";
        renderCartUI('po'); switchScreen('screen-po-builder'); 
    } else { 
        const invParsedD = new Date(doc.date);
        document.getElementById("inv-date-input").value = !isNaN(invParsedD) ? getLocalYMD(invParsedD) : getLocalYMD(new Date());

        document.getElementById("customer-select").value = doc.customerId; 
        document.getElementById("builder-title").innerText = "Edit Invoice"; 
        document.getElementById("btn-delete-invoice").style.display = "block";
        renderCartUI('invoice'); switchScreen('screen-builder'); 
    }
}

function promptDeleteFromPreview() {
    if (currentDocType === 'po') promptDeletePO(editingDocId);
    else promptDeleteInvoice(editingDocId);
}

function promptDeletePO(id = null) {
    const targetId = id || editingDocId;
    if(!isAdmin || !targetId) return;
    const po = appData.purchaseOrders.find(p => p.id === targetId);
    if(!po) return;
    let msg = "Are you sure you want to delete this Purchase Order? Please provide a reason.";
    if(po.status === 'converted') msg = "Are you sure you want to delete this Converted Purchase Order? The received items will be safely deducted from your inventory. Please provide a reason.";
    
    document.getElementById("delete-target-id").value = targetId;
    document.getElementById("delete-target-type").value = "po";
    document.getElementById("delete-reason-text").innerText = msg;
    document.getElementById("delete-reason-input").value = "";
    document.getElementById("delete-reason-modal").style.display = "flex";
}

async function executeDeletePO(targetId, reason) {
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = "Deleting PO...";
    try {
        const batch = db.batch();
        const poIndex = appData.purchaseOrders.findIndex(p => p.id === targetId);
        const po = appData.purchaseOrders[poIndex];

        if (po.status === 'converted') {
            po.cart.forEach(item => {
                const productIndex = appData.inventory.findIndex(p => p.id === item.id);
                if (productIndex > -1) {
                    let newStock = (appData.inventory[productIndex].inStock || 0) - item.qty; 
                    appData.inventory[productIndex].inStock = newStock;
                    batch.update(db.collection("inventory").doc(item.id), { inStock: newStock });
                }
            });
        }
        batch.update(db.collection("purchaseOrders").doc(targetId), { deleted: true, cart: [], totalAmount: 0, deleteReason: reason }); 
        await batch.commit();

        if (poIndex > -1) {
            appData.purchaseOrders[poIndex].deleted = true;
            appData.purchaseOrders[poIndex].cart = [];
            appData.purchaseOrders[poIndex].totalAmount = 0;
            appData.purchaseOrders[poIndex].deleteReason = reason;
        }
        renderProductList(); renderPOList(); switchScreen('screen-po-history');
    } catch (error) { showCustomAlert("Failed to delete Purchase Order.", "Error", "🔴"); } 
    finally { document.getElementById('loading-overlay').style.display = 'none'; }
}

function promptDeleteInvoice(id = null) {
    const targetId = id || editingDocId;
    if(!isAdmin || !targetId) return;
    document.getElementById("delete-target-id").value = targetId;
    document.getElementById("delete-target-type").value = "invoice";
    document.getElementById("delete-reason-text").innerText = "Are you sure you want to delete this invoice? The items will be returned to inventory. Please provide a reason.";
    document.getElementById("delete-reason-input").value = "";
    document.getElementById("delete-reason-modal").style.display = "flex";
}

async function executeDeleteInvoice(targetId, reason) {
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = "Deleting Invoice...";
    try {
        const batch = db.batch();
        const invIndex = appData.history.findIndex(p => p.id === targetId);
        const inv = appData.history[invIndex];
        
        inv.cart.forEach(item => {
            const productIndex = appData.inventory.findIndex(p => p.id === item.id);
            if (productIndex > -1) {
                let newStock = (appData.inventory[productIndex].inStock || 0) + item.qty;
                appData.inventory[productIndex].inStock = newStock;
                batch.update(db.collection("inventory").doc(item.id), { inStock: newStock });
            }
        });
        batch.update(db.collection("history").doc(targetId), { deleted: true, cart: [], totalAmount: 0, deleteReason: reason }); 
        await batch.commit();

        if (invIndex > -1) {
            appData.history[invIndex].deleted = true;
            appData.history[invIndex].cart = [];
            appData.history[invIndex].totalAmount = 0;
            appData.history[invIndex].deleteReason = reason;
        }
        renderProductList(); renderHistoryList(); switchScreen('screen-history');
    } catch (error) { showCustomAlert("Failed to delete invoice.", "Error", "🔴"); } 
    finally { document.getElementById('loading-overlay').style.display = 'none'; }
}

function editCurrentDocument() { 
    if(!isAdmin) return;
    if(currentDocType === 'po') {
        document.getElementById("btn-delete-po").style.display = "block";
        switchScreen('screen-po-builder'); 
    } else {
        document.getElementById("btn-delete-invoice").style.display = "block";
        switchScreen('screen-builder'); 
    }
}

function renderPayoutUI(poDoc) {
    const container = document.getElementById("payout-details-display");
    if (poDoc.payout) {
        container.innerHTML = `
            <div class="d-flex align-items-center justify-content-center text-success mb-2">
                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" class="me-2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span class="fw-bold fs-5">Payment Locked</span>
            </div>
            <div class="text-start bg-light p-3 rounded-3 mt-3 mx-auto" style="max-width: 300px; font-size: 13px;">
                <div class="d-flex justify-content-between mb-1"><span>Amount:</span> <strong style="color:#0b2a5c">₹${poDoc.payout.amount}</strong></div>
                <div class="d-flex justify-content-between mb-1"><span>Date:</span> <strong>${poDoc.payout.date}</strong></div>
                <div class="d-flex justify-content-between mb-2"><span>Ref No:</span> <strong>${poDoc.payout.ref}</strong></div>
                ${poDoc.payout.img ? `<button onclick="openReceiptViewer('${poDoc.id}')" class="btn btn-sm btn-outline-primary w-100 mt-2">🖼️ View Receipt Image</button>` : ''}
            </div>`;
    } else {
        container.innerHTML = `
            <div class="text-danger fw-bold mb-3 mt-2">❌ Payment Pending</div>
            ${isAdmin ? `<button class="btn btn-warning fw-bold px-4" onclick="openPayoutModal('${poDoc.id}')">💳 Record Payout Now</button>` : ''}`;
    }
}

function openPayoutModal(poId) { 
    if(!isAdmin) return;
    document.getElementById("payout-po-id").value = poId; 
    document.getElementById("payout-date").value = new Date().toISOString().split('T')[0]; 
    document.getElementById("payout-ref").value = ""; 
    document.getElementById("payout-amount").value = ""; 
    document.getElementById("payout-image").value = ""; 
    document.getElementById("payout-modal").style.display = "flex"; 
}
function closePayoutModal() { document.getElementById("payout-modal").style.display = "none"; }
function openReceiptViewer(poId) { 
    const po = appData.purchaseOrders.find(p => p.id === poId);
    if(po && po.payout && po.payout.img) {
        document.getElementById('receipt-viewer-img').src = po.payout.img;
        document.getElementById('receipt-viewer-modal').style.display = 'flex';
    }
}
function closeReceiptViewer() { document.getElementById('receipt-viewer-modal').style.display = 'none'; document.getElementById('receipt-viewer-img').src = ''; }

async function savePayout() {
    if(!isAdmin) return;
    const poId = document.getElementById("payout-po-id").value; 
    const date = document.getElementById("payout-date").value; 
    const ref = document.getElementById("payout-ref").value; 
    const amount = document.getElementById("payout-amount").value; 
    const fileInput = document.getElementById("payout-image");
    
    if(!date || !amount) return showCustomAlert("Date and Amount are required.");
    
    const btn = document.getElementById("btn-save-payout"); 
    btn.innerText = "Processing..."; btn.disabled = true;
    
    let base64Image = null;
    if (fileInput.files && fileInput.files[0]) {
        base64Image = await new Promise((resolve) => { 
            const reader = new FileReader(); reader.readAsDataURL(fileInput.files[0]); 
            reader.onload = e => { 
                const img = new Image(); img.src = e.target.result; 
                img.onload = () => { 
                    const canvas = document.createElement('canvas'); const MAX_WIDTH = 600; 
                    const scale = MAX_WIDTH / img.width; canvas.width = MAX_WIDTH; canvas.height = img.height * scale; 
                    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
                    resolve(canvas.toDataURL('image/jpeg', 0.5)); 
                } 
            }; 
        });
    }
    
    const payoutData = { date: date, ref: ref || "N/A", amount: amount, img: base64Image };
    try { 
        await db.collection("purchaseOrders").doc(poId).update({ payout: payoutData }); 
        const poIndex = appData.purchaseOrders.findIndex(p => p.id === poId); 
        if(poIndex > -1) { 
            appData.purchaseOrders[poIndex].payout = payoutData; 
            renderPayoutUI(appData.purchaseOrders[poIndex]); 
            renderPOList(); 
        } 
        closePayoutModal(); 
    } catch (err) { showCustomAlert("Failed to save payment to cloud.", "Error", "🔴"); } 
    finally { btn.innerText = "Confirm & Lock Payment"; btn.disabled = false; }
}