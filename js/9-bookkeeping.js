// js/9-bookkeeping.js

let currentAuditDate = "";
let currentAuditData = null;

function openBookkeepingScreen() {
    const d = new Date();
    document.getElementById('audit-date').value = getLocalYMD(d);
    loadAuditForDate();
    switchScreen('screen-bookkeeping');
}

function loadAuditForDate() {
    const dateVal = document.getElementById('audit-date').value;
    if(!dateVal) return;
    currentAuditDate = dateVal;
    
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = "Loading Stock Audit...";

    db.collection("bookkeeping").doc(dateVal).get().then(doc => {
        if(doc.exists) {
            currentAuditData = doc.data();
        } else {
            // Initialize a brand new audit, pulling ONLY items with active stock > 0
            const itemsToAudit = appData.inventory
                .filter(p => (p.inStock || 0) > 0)
                .map(p => ({
                    id: p.id,
                    name: p.name,
                    systemStock: p.inStock || 0,
                    physicalStock: "",
                    comment: ""
                }));
            
            currentAuditData = {
                date: dateVal,
                status: 'draft',
                items: itemsToAudit
            };
        }
        renderAuditUI();
        document.getElementById('loading-overlay').style.display = 'none';
    }).catch(err => {
        console.error(err);
        showCustomAlert("Failed to load audit from cloud.", "Error", "🔴");
        document.getElementById('loading-overlay').style.display = 'none';
    });
}

function renderAuditUI() {
    const container = document.getElementById("audit-items-container");
    const statusBanner = document.getElementById("audit-status-banner");
    const btnSave = document.getElementById("btn-save-audit");
    const btnSubmit = document.getElementById("btn-submit-audit");
    const adminActions = document.getElementById("admin-audit-actions");

    // Lock inputs if it is submitted or fully approved
    const isLocked = currentAuditData.status === 'submitted' || currentAuditData.status === 'approved';
    
    // Dynamically inject the Admin Approval and Return buttons
    adminActions.innerHTML = `
        <div class="d-flex gap-2">
            <button class="btn btn-warning flex-grow-1 fw-bold shadow-sm" onclick="returnAuditToStockiest()">↩️ Return for Correction</button>
            <button class="btn btn-success flex-grow-1 fw-bold shadow-sm" onclick="approveAudit()">✅ Approve & Sync Stock</button>
        </div>
    `;

    // Handle UI States based on Submission Status and Admin Role
    if (currentAuditData.status === 'approved') {
        statusBanner.className = "alert alert-success fw-bold";
        statusBanner.innerText = "✅ Audit Approved & Inventory Synced";
        statusBanner.style.display = "block";
        
        btnSave.style.display = "none";
        btnSubmit.style.display = "none";
        adminActions.style.display = "none";
    } else if (currentAuditData.status === 'submitted') {
        statusBanner.className = "alert alert-info fw-bold";
        statusBanner.innerText = "🔒 Audit Submitted - Waiting for Admin Approval";
        statusBanner.style.display = "block";
        
        btnSave.style.display = "none";
        btnSubmit.style.display = "none";
        adminActions.style.display = isAdmin ? "block" : "none";
    } else if (currentAuditData.status === 'returned') {
        statusBanner.className = "alert alert-warning fw-bold";
        statusBanner.innerText = "⚠️ Audit Returned by Admin - Corrections Needed";
        statusBanner.style.display = "block";
        
        btnSave.style.display = "block";
        btnSubmit.style.display = "block";
        adminActions.style.display = "none";
    } else {
        statusBanner.style.display = "none";
        
        btnSave.style.display = "block";
        btnSubmit.style.display = "block";
        adminActions.style.display = "none";
    }

    if (currentAuditData.items.length === 0) {
        container.innerHTML = `<div class="text-center p-5 text-muted bg-light rounded-4 border">No active inventory items found to audit today.</div>`;
        return;
    }

    container.innerHTML = currentAuditData.items.map((item, idx) => `
        <div class="p-3 bg-light border rounded-4 shadow-sm" style="border-color: #e2e8f0 !important;">
            <div class="fw-bold mb-2" style="color: #0b2a5c;">${item.name}</div>
            <div class="row g-2 align-items-center mb-2">
                <div class="col-6">
                    <label class="form-label mb-1" style="font-size:10px;">System Stock</label>
                    <input type="text" class="form-control bg-white text-center fw-bold text-muted" value="${item.systemStock}" readonly disabled>
                </div>
                <div class="col-6">
                    <label class="form-label mb-1" style="font-size:10px; color:#d97706;">Physical Count</label>
                    <input type="number" id="audit-qty-${idx}" class="form-control text-center fw-bold border-warning" placeholder="Count" value="${item.physicalStock}" ${isLocked ? 'disabled' : ''}>
                </div>
            </div>
            <div>
                <textarea id="audit-comment-${idx}" class="form-control" rows="2" placeholder="Write discrepancy reason here (if any)..." ${isLocked ? 'disabled' : ''}>${item.comment}</textarea>
            </div>
        </div>
    `).join('');
}

async function saveAudit(targetStatus) {
    let hasErrors = false;
    let errorMsg = "";
    
    // Extract and Validate all data
    currentAuditData.items.forEach((item, idx) => {
        const physInput = document.getElementById(`audit-qty-${idx}`).value;
        const commentInput = document.getElementById(`audit-comment-${idx}`).value.trim();
        
        item.physicalStock = physInput === "" ? "" : parseInt(physInput);
        item.comment = commentInput;

        // If submitting, force them to fill everything
        if (targetStatus === 'submitted') {
            if (physInput === "") {
                hasErrors = true;
                errorMsg = "Please enter the physical stock count for all items before submitting the final audit.";
            }
        }

        // Logic check: If quantities don't match, a comment is strictly required
        if (item.physicalStock !== "" && item.physicalStock !== item.systemStock) {
            if (item.comment === "") {
                hasErrors = true;
                errorMsg = `Discrepancy found for "${item.name}". You must provide a reason in the comments.`;
            }
        }
    });

    if (hasErrors) {
        return showCustomAlert(errorMsg, "Incomplete Data", "⚠️");
    }

    currentAuditData.status = targetStatus;
    currentAuditData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();

    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = targetStatus === 'submitted' ? "Submitting Audit..." : "Saving Draft...";

    try {
        await db.collection("bookkeeping").doc(currentAuditDate).set(currentAuditData);
        showCustomAlert(targetStatus === 'submitted' ? "Audit submitted and locked successfully!" : "Draft saved successfully. You can return later.", "Success", "✅");
        renderAuditUI();
    } catch (error) {
        console.error(error);
        showCustomAlert("Failed to save audit to cloud.", "Error", "🔴");
        currentAuditData.status = 'draft'; // Revert state on failure
    } finally {
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

async function returnAuditToStockiest() {
    if (!isAdmin) return;
    
    showCustomConfirm("Are you sure you want to return this audit back to the Stockiest for corrections? This will unlock the form.", async () => {
        currentAuditData.status = 'returned';
        document.getElementById('loading-overlay').style.display = 'flex';
        document.getElementById('loading-text').innerText = "Returning Audit...";
        
        try {
            await db.collection("bookkeeping").doc(currentAuditDate).update({ status: 'returned' });
            showCustomAlert("Audit successfully returned and unlocked for the Stockiest.", "Success", "✅");
            renderAuditUI();
        } catch(e) {
            showCustomAlert("Failed to return audit.", "Error", "🔴");
        } finally {
            document.getElementById('loading-overlay').style.display = 'none';
        }
    }, "Yes, Return it");
}

// 🌟 NEW FUNCTION: Approve Audit and Update Master Inventory
async function approveAudit() {
    if (!isAdmin) return;
    
    showCustomConfirm("Are you sure you want to approve this audit? This will permanently update your main inventory stock levels to match the physical count.", async () => {
        document.getElementById('loading-overlay').style.display = 'flex';
        document.getElementById('loading-text').innerText = "Approving & Syncing Inventory...";
        
        try {
            // A Firebase "Batch" ensures either ALL inventory updates succeed, or none of them do.
            const batch = db.batch();
            
            currentAuditData.items.forEach(auditItem => {
                // Update Cloud Inventory
                const prodRef = db.collection("inventory").doc(auditItem.id);
                batch.update(prodRef, { inStock: auditItem.physicalStock });
                
                // Keep Local Data Synced Instantly
                const localProdIdx = appData.inventory.findIndex(p => p.id === auditItem.id);
                if (localProdIdx > -1) {
                    appData.inventory[localProdIdx].inStock = auditItem.physicalStock;
                }
            });
            
            // Mark Audit as Approved
            currentAuditData.status = 'approved';
            const auditRef = db.collection("bookkeeping").doc(currentAuditDate);
            batch.update(auditRef, { status: 'approved' });
            
            await batch.commit();
            
            // Rerender the background lists so the UI reflects the new stock
            renderProductList();
            
            showCustomAlert("Audit approved! All inventory stock levels have been successfully synced.", "Success", "✅");
            renderAuditUI();
            
        } catch(e) {
            console.error("Approval Error:", e);
            currentAuditData.status = 'submitted'; // Revert to previous state if failure
            showCustomAlert("Failed to approve audit and sync stock.", "Error", "🔴");
        } finally {
            document.getElementById('loading-overlay').style.display = 'none';
        }
    }, "Yes, Approve & Sync");
}