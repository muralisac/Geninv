// js/8-history-payouts.js

async function generatePreview(type) { 
    if(!isAdmin && !isStockiest) return;
    
    currentDocType = type; 
    let buyer, btnId, saveBtn;
    
    if (type === 'pos') {
        editingDocId = null; 
        
        const activeCart = posCarts.find(c => c.id === activePosCartId);
        if (!activeCart || activeCart.items.length === 0) return showCustomAlert("Cart is empty.");
        
        currentCart = activeCart.items;
        buyer = { id: 'retail', name: activeCart.name, address: activeCart.phone ? "Ph: " + activeCart.phone : "Retail Walk-in", gstin: "URP", stateCode: SELLER_STATE };
        
        const d = new Date(); 
        tempDocDate = createDateFromYMD(getLocalYMD(d)).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
        
        btnId = 'btn-pos-checkout';
        saveBtn = document.getElementById(btnId);
    } else {
        const vendorSelectId = type === 'po' ? "po-vendor-select" : "customer-select"; 
        const custId = document.getElementById(vendorSelectId).value; 
        if (!custId) return showCustomAlert("Select a client/vendor."); 
        if (currentCart.length === 0) return showCustomAlert("Cart is empty."); 
        
        buyer = appData.customers.find(c => c.id === custId) || { name: "N/A", address: "N/A", gstin: "N/A", stateCode: SELLER_STATE }; 
        
        const rawD = document.getElementById(type === 'po' ? "po-date-input" : "inv-date-input").value;
        tempDocDate = createDateFromYMD(rawD).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
        
        btnId = type === 'po' ? '#screen-po-builder .btn-success' : '#screen-builder .btn-success';
        saveBtn = document.querySelector(btnId);
    }

    // 🌟 STEP 1: LOCAL CHECK (Fast rejection for obvious stock issues)
    if (type === 'pos' || type === 'invoice') {
        let stockErrors = [];
        currentCart.forEach(cartItem => {
            const invItem = appData.inventory.find(p => p.id === cartItem.id);
            let currentAvailable = invItem ? (invItem.inStock || 0) : 0;

            if (editingDocId && type === 'invoice') {
                const oldDoc = appData.history.find(h => h.id === editingDocId);
                if (oldDoc && oldDoc.cart) {
                    const oldItem = oldDoc.cart.find(i => i.id === cartItem.id);
                    if (oldItem) currentAvailable += oldItem.qty; 
                }
            }

            if (cartItem.qty > currentAvailable) {
                stockErrors.push(`- ${cartItem.name} (Need: ${cartItem.qty}, Avail: ${currentAvailable})`);
            }
        });

        if (stockErrors.length > 0) {
            return showCustomAlert(`Checkout blocked! Insufficient physical stock for:\n\n${stockErrors.join('\n')}\n\nPlease adjust the cart before proceeding.`, "Stock Error", "🚫");
        }
    }

    if (saveBtn) { saveBtn.innerText = "⏳ Securing Invoice..."; saveBtn.disabled = true; } 
    
    let subTotal = 0, totalGst = 0;
    currentCart.forEach(item => {
        let baseAmt = item.qty * item.price;
        let gstAmt = baseAmt * (item.gstPercent / 100);
        subTotal += baseAmt; totalGst += gstAmt;
    });
    const roundedGrandTotal = Math.round(subTotal + totalGst);

    let stockChanges = {};
    if (editingDocId) {
        const oldDoc = (type === 'po' ? appData.purchaseOrders : appData.history).find(h => h.id === editingDocId);
        let shouldReverse = (type === 'invoice' || type === 'pos') || (type === 'po' && oldDoc && oldDoc.status === 'converted');
        if (oldDoc && oldDoc.cart && shouldReverse) {
            oldDoc.cart.forEach(item => {
                if (!stockChanges[item.id]) stockChanges[item.id] = 0;
                stockChanges[item.id] += (type === 'invoice' || type === 'pos') ? item.qty : -item.qty;
            });
        }
    }

    let isPOConverted = false;
    if (type === 'po' && editingDocId) {
        const existingPO = appData.purchaseOrders.find(h => h.id === editingDocId);
        if (existingPO && existingPO.status === 'converted') isPOConverted = true;
    }
    
    let shouldApplyNew = (type === 'invoice' || type === 'pos') || (type === 'po' && isPOConverted);
    if(shouldApplyNew) {
        currentCart.forEach(item => {
            if (!stockChanges[item.id]) stockChanges[item.id] = 0;
            stockChanges[item.id] += (type === 'invoice' || type === 'pos') ? -item.qty : item.qty;
        });
    }

    const userEmail = auth.currentUser ? auth.currentUser.email : "Unknown User";

    const record = { 
        id: editingDocId || (type === 'po' ? 'po' : 'inv') + Date.now(), 
        docType: type,
        date: tempDocDate, 
        customerId: buyer.id, 
        customerName: buyer.name, 
        cart: JSON.parse(JSON.stringify(currentCart)), 
        totalAmount: roundedGrandTotal, 
        paid: type === 'pos' ? true : false, 
        deleted: false, 
        createdBy: userEmail, 
        timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    }; 
    
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

    try { 
        const finalResult = await db.runTransaction(async (transaction) => {
            // 🌟 STEP 2: CLOUD LOCK - READ ALL DATA FIRST
            const metaRef = db.collection("metadata").doc("invoiceData");
            const metaDoc = await transaction.get(metaRef);

            // Securely read the TRUE cloud stock for every item being checked out
            const invRefs = {};
            const invDocs = {};
            for (const pid of Object.keys(stockChanges)) {
                invRefs[pid] = db.collection("inventory").doc(pid);
                invDocs[pid] = await transaction.get(invRefs[pid]);
            }

            // 🌟 STEP 3: CLOUD STOCK VALIDATION
            for (const [pid, change] of Object.entries(stockChanges)) {
                // If change is negative, it means stock is being deducted (Sales/POS)
                if (change < 0) {
                    const invDoc = invDocs[pid];
                    const currentCloudStock = invDoc.exists ? (invDoc.data().inStock || 0) : 0;
                    const itemName = invDoc.exists ? invDoc.data().name : "Unknown Item";

                    // If the cloud stock + our deduction drops below zero, THROW ERROR!
                    if (currentCloudStock + change < 0) {
                        throw new Error(`STOCK_ERROR||${itemName}||${currentCloudStock}`);
                    }
                }
            }

            // 🌟 STEP 4: WRITE DATA (Safe to proceed)
            let metaData = metaDoc.exists ? metaDoc.data() : { lastNum: 22, lastPoNum: 5 };
            let assignedNum = editingDocId ? tempDocNumber : ""; 

            if (!editingDocId) {
                const d = new Date();
                const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

                if (type === 'po') {
                    metaData.lastPoNum++;
                    assignedNum = `PO-${dateStr}-${metaData.lastPoNum}`;
                    transaction.update(metaRef, { lastPoNum: metaData.lastPoNum });
                } else {
                    metaData.lastNum++;
                    assignedNum = `NN-${dateStr}-${metaData.lastNum}`;
                    transaction.update(metaRef, { lastNum: metaData.lastNum });
                }
            }

            record.invoiceNumber = assignedNum;
            const docRef = db.collection(collectionName).doc(record.id);
            transaction.set(docRef, record);

            // Update cloud inventory using the explicitly locked numbers
            for (const [pid, change] of Object.entries(stockChanges)) {
                if (change !== 0) {
                    const currentStock = invDocs[pid].exists ? (invDocs[pid].data().inStock || 0) : 0;
                    transaction.update(invRefs[pid], { inStock: currentStock + change });
                }
            }

            return { assignedNum, metaData };
        });

        // 🌟 POST-TRANSACTION SUCCESS
        tempDocNumber = finalResult.assignedNum;
        record.invoiceNumber = finalResult.assignedNum;

        if (!editingDocId) {
            if (type === 'po') appData.lastPoNum = finalResult.metaData.lastPoNum;
            else appData.lastInvoiceNum = finalResult.metaData.lastNum;
        }

        const { html } = renderInvoiceHTML(currentCart, type, buyer, tempDocNumber, tempDocDate);
        document.getElementById("invoice-content").innerHTML = html;

        if (editingDocId) { 
            const idx = arrayRef.findIndex(h => h.id === editingDocId); arrayRef[idx] = record; 
        } else { 
            arrayRef.unshift(record); 
        } 
        
        editingDocId = record.id;

        // Force local sync of inventory to match cloud truth
        for (const [pid, change] of Object.entries(stockChanges)) {
            if (change !== 0) {
                const productIndex = appData.inventory.findIndex(p => p.id === pid);
                if (productIndex > -1) {
                    appData.inventory[productIndex].inStock = (appData.inventory[productIndex].inStock || 0) + change;
                }
            }
        }
        
        if (type === 'pos') {
            posCarts = posCarts.filter(c => c.id !== activePosCartId);
            activePosCartId = posCarts.length > 0 ? posCarts[0].id : null;
            renderPOSTabs();
            renderPOSCart();
        }
        
        let canEditPrev = isAdmin; let canDeletePrev = isAdmin;
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
            if(record.status === 'converted') { document.getElementById("payout-status-container").style.display = "block"; renderPayoutUI(record); } 
            else document.getElementById("payout-status-container").style.display = "none";
        } else { 
            document.getElementById("payout-status-container").style.display = "none"; renderHistoryList(); 
        }
        
        renderProductList(); switchScreen('screen-preview'); 

    } catch (error) { 
        console.error("Save Error:", error); 
        // 🌟 CATCH THE CLOUD ERROR AND ALERT THE USER
        if (error.message && error.message.startsWith("STOCK_ERROR||")) {
            const parts = error.message.split("||");
            const itemName = parts[1];
            const actualCloudStock = parts[2];
            showCustomAlert(`Checkout Failed!\n\nAnother user just purchased "${itemName}". There are only ${actualCloudStock} unit(s) left in the cloud inventory.\n\nPlease correct your cart and try again.`, "Inventory Conflict", "🚫");
            
            // Force the app to pull the real data from the cloud so their UI updates
            manualRefresh(); 
        } else {
            showCustomAlert("Failed to save to the cloud."); 
        }
    } finally { 
        if (saveBtn) {
            saveBtn.innerText = type === 'po' ? "💾 Create PO" : (type === 'pos' ? "🛒 Checkout" : "💾 Create Invoice"); 
            saveBtn.disabled = false; 
        }
    } 
}

function renderHistoryList() { 
    const list = document.getElementById("history-list"); 
    if(appData.history.length === 0) {
        list.innerHTML = `<div class="text-center p-5 text-muted bg-light rounded-4 border">No sales records yet.</div>`; 
        return;
    }
    list.innerHTML = appData.history.map(h => {
        const isPos = h.docType === 'pos';
        const brandColor = isPos ? 'text-maroon' : 'text-primary';
        const brandBorder = isPos ? 'history-card-pos' : 'history-card';
        const brandIcon = isPos ? '🛍️ Retail' : '🧾 Wholesale';

        if (h.deleted) {
            const reasonBtn = h.deleteReason ? `<button class="btn btn-sm border ms-2 py-0 px-2 shadow-sm" style="font-size: 11px; background: #fff; color: #0b2a5c; border-radius: 6px;" onclick="event.stopPropagation(); showDeleteReason('${h.id}', 'invoice')">💬 View Reason</button>` : '';
            return `<div class="list-item ${brandBorder}" style="opacity: 0.6; border-left-color: #ef4444; background: #f8fafc;"><div style="flex-grow: 1; padding-left: 8px;"><strong class="text-danger text-decoration-line-through">${h.invoiceNumber}</strong> <span class="badge bg-danger ms-2">Deleted</span>${reasonBtn}<br><small class="text-muted fw-medium">${h.customerName} &nbsp;&bull;&nbsp; ${h.date}</small><div class="mt-1 fw-bold text-muted small">No items - Voided</div></div></div>`;
        }
        
        const isPaid = h.paid ? '<span class="badge bg-success ms-2">Paid</span>' : '<span class="badge bg-secondary ms-2">Pending</span>';
        const markPaidBtn = (!h.paid && isAdmin) ? `<button class="btn btn-success btn-sm action-btn shadow-sm me-2" onclick="event.stopPropagation(); markInvoicePaid('${h.id}')">💰 Mark Paid</button>` : '';
        const editBtn = (isAdmin && !h.paid && !isPos) ? `<button class="btn btn-light action-btn border shadow-sm" onclick="event.stopPropagation(); loadOldDocumentForEdit('${h.id}', 'invoice')">Edit</button>` : '';
        
        return `<div class="list-item ${brandBorder}" style="cursor: pointer;" onclick="viewOldDocument('${h.id}', '${h.docType || 'invoice'}')">
            <div style="flex-grow: 1; padding-left: 8px;">
                <div class="fw-bold ${brandColor} d-flex align-items-center gap-2" style="font-size: 16px;">
                    ${h.invoiceNumber} ${isPaid}
                </div>
                <div class="mt-1">
                    <span class="badge bg-light text-dark border me-1">${brandIcon}</span>
                    <small class="text-muted fw-medium">${h.customerName} &nbsp;&bull;&nbsp; ${h.date}</small>
                </div>
                <div class="mt-2 fw-bold" style="color:#0b2a5c; font-size:15px;">₹${h.totalAmount.toFixed(2)}</div>
            </div>
            <div class="d-flex align-items-center">${markPaidBtn}${editBtn}</div>
        </div>`;
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
    showCustomConfirm("Mark this Purchase Order as Received? This will update your inventory stock.", async function() {
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
    
    let buyer;

    if (type === 'po') {
        document.getElementById("po-vendor-select").value = doc.customerId; 
        document.getElementById("po-builder-title").innerText = "Edit PO"; 
        buyer = appData.customers.find(c => c.id === doc.customerId) || { name: doc.customerName, address: "Address Data Unavailable", gstin: "N/A", stateCode: SELLER_STATE };
        renderCartUI('po');
    } else if (type === 'pos') {
        buyer = { id: 'retail', name: doc.customerName, address: "Retail Customer", gstin: "URP", stateCode: SELLER_STATE };
    } else {
        document.getElementById("customer-select").value = doc.customerId; 
        document.getElementById("builder-title").innerText = "Edit Invoice"; 
        buyer = appData.customers.find(c => c.id === doc.customerId) || { name: doc.customerName, address: "Address Data Unavailable", gstin: "N/A", stateCode: SELLER_STATE };
        renderCartUI('invoice');
    }
    
    const { html } = renderInvoiceHTML(doc.cart, type, buyer, tempDocNumber, tempDocDate);
    document.getElementById("invoice-content").innerHTML = html;
    
    let canEdit = isAdmin; let canDelete = isAdmin;

    if (type === 'po') { 
        const statusStr = doc.status || 'converted';
        if (statusStr === 'converted') {
            document.getElementById("payout-status-container").style.display = "block"; 
            renderPayoutUI(doc); canEdit = false; 
        } else {
            document.getElementById("payout-status-container").style.display = "none"; canEdit = true; 
        }
        if (doc.payout) { canEdit = false; canDelete = false; }
    } else { 
        document.getElementById("payout-status-container").style.display = "none"; 
        if (doc.paid || type === 'pos') canEdit = false;
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
    
    editingDocId = doc.id; currentCart = JSON.parse(JSON.stringify(doc.cart)); 
    tempDocNumber = doc.invoiceNumber; tempDocDate = doc.date; 
    
    if(type === 'po') { 
        const isConverted = doc.status === 'converted';
        const poParsedD = new Date(doc.date);
        document.getElementById("po-date-input").value = !isNaN(poParsedD) ? getLocalYMD(poParsedD) : getLocalYMD(new Date());

        document.getElementById("po-vendor-select").value = doc.customerId; 
        document.getElementById("po-vendor-select").disabled = isConverted; 
        document.getElementById("po-builder-title").innerText = isConverted ? "View PO" : "Edit PO"; 
        
        document.getElementById("po-add-item-panel").style.display = isConverted ? "none" : "block";
        document.getElementById("btn-save-po").style.display = isConverted ? "none" : "block";
        renderCartUI('po'); switchScreen('screen-po-builder'); 
    } else { 
        const invParsedD = new Date(doc.date);
        document.getElementById("inv-date-input").value = !isNaN(invParsedD) ? getLocalYMD(invParsedD) : getLocalYMD(new Date());

        document.getElementById("customer-select").value = doc.customerId; 
        document.getElementById("builder-title").innerText = "Edit Invoice"; 
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
    
    document.getElementById("delete-target-id").value = targetId; document.getElementById("delete-target-type").value = "po";
    document.getElementById("delete-reason-text").innerText = msg; document.getElementById("delete-reason-input").value = "";
    document.getElementById("delete-reason-modal").style.display = "flex";
}

async function executeDeletePO(targetId, reason) {
    document.getElementById('loading-overlay').style.display = 'flex'; 
    document.getElementById('loading-text').innerText = "Verifying & Deleting...";
    
    try {
        const cloudDoc = await db.collection("purchaseOrders").doc(targetId).get();
        if (!cloudDoc.exists || cloudDoc.data().deleted === true) {
            document.getElementById('loading-overlay').style.display = 'none';
            document.getElementById("delete-reason-modal").style.display = "none";
            showCustomAlert("This document has already been deleted or modified by another device.", "Sync Conflict", "⚠️");
            manualRefresh(); 
            return;
        }

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
            appData.purchaseOrders[poIndex].deleted = true; appData.purchaseOrders[poIndex].cart = [];
            appData.purchaseOrders[poIndex].totalAmount = 0; appData.purchaseOrders[poIndex].deleteReason = reason;
        }
        
        document.getElementById("delete-reason-modal").style.display = "none";
        renderProductList(); renderPOList(); switchScreen('screen-po-history', false);
    } catch (error) { showCustomAlert("Failed to delete Purchase Order.", "Error", "🔴"); } 
    finally { document.getElementById('loading-overlay').style.display = 'none'; }
}

function promptDeleteInvoice(id = null) {
    const targetId = id || editingDocId;
    if(!isAdmin || !targetId) return;
    document.getElementById("delete-target-id").value = targetId; document.getElementById("delete-target-type").value = "invoice";
    document.getElementById("delete-reason-text").innerText = "Are you sure you want to delete this record? The items will be returned to inventory. Please provide a reason.";
    document.getElementById("delete-reason-input").value = ""; document.getElementById("delete-reason-modal").style.display = "flex";
}

async function executeDeleteInvoice(targetId, reason) {
    document.getElementById('loading-overlay').style.display = 'flex'; 
    document.getElementById('loading-text').innerText = "Verifying & Deleting...";
    
    try {
        const cloudDoc = await db.collection("history").doc(targetId).get();
        if (!cloudDoc.exists || cloudDoc.data().deleted === true) {
            document.getElementById('loading-overlay').style.display = 'none';
            document.getElementById("delete-reason-modal").style.display = "none";
            showCustomAlert("This document has already been deleted or modified by another device.", "Sync Conflict", "⚠️");
            manualRefresh(); 
            return;
        }

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
            appData.history[invIndex].deleted = true; appData.history[invIndex].cart = [];
            appData.history[invIndex].totalAmount = 0; appData.history[invIndex].deleteReason = reason;
        }
        
        document.getElementById("delete-reason-modal").style.display = "none";
        renderProductList(); renderHistoryList(); switchScreen('screen-history', false);
    } catch (error) { showCustomAlert("Failed to delete record.", "Error", "🔴"); } 
    finally { document.getElementById('loading-overlay').style.display = 'none'; }
}

function editCurrentDocument() { 
    if(!isAdmin) return;
    if(currentDocType === 'po') { switchScreen('screen-po-builder'); } 
    else { switchScreen('screen-builder'); }
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
        container.innerHTML = `<div class="text-danger fw-bold mb-3 mt-2">❌ Payment Pending</div>${isAdmin ? `<button class="btn btn-warning fw-bold px-4" onclick="openPayoutModal('${poDoc.id}')">💳 Record Payout Now</button>` : ''}`;
    }
}

function openPayoutModal(poId) { 
    if(!isAdmin) return;
    document.getElementById("payout-po-id").value = poId; document.getElementById("payout-date").value = new Date().toISOString().split('T')[0]; 
    document.getElementById("payout-ref").value = ""; document.getElementById("payout-amount").value = ""; document.getElementById("payout-image").value = ""; 
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
    const poId = document.getElementById("payout-po-id").value; const date = document.getElementById("payout-date").value; 
    const ref = document.getElementById("payout-ref").value; const amount = document.getElementById("payout-amount").value; 
    const fileInput = document.getElementById("payout-image");
    
    if(!date || !amount) return showCustomAlert("Date and Amount are required.");
    const btn = document.getElementById("btn-save-payout"); btn.innerText = "Processing..."; btn.disabled = true;
    
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
        if(poIndex > -1) { appData.purchaseOrders[poIndex].payout = payoutData; renderPayoutUI(appData.purchaseOrders[poIndex]); renderPOList(); } 
        closePayoutModal(); 
    } catch (err) { showCustomAlert("Failed to save payment to cloud.", "Error", "🔴"); } 
    finally { btn.innerText = "Confirm & Lock Payment"; btn.disabled = false; }
}