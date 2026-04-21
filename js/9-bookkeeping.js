// js/9-bookkeeping.js

let currentAuditDate = "";
let currentAuditData = null;

function openBookkeepingScreen() {
    const d = new Date();
    const todayStr = getLocalYMD(d);
    
    const dateInput = document.getElementById('audit-date');
    dateInput.max = todayStr; // 🌟 Block Future Dates in the calendar picker
    dateInput.value = todayStr;
    
    loadAuditForDate();
    switchScreen('screen-bookkeeping');
}

function loadAuditForDate() {
    const dateVal = document.getElementById('audit-date').value;
    if(!dateVal) return;
    
    // Fallback safety: Prevent future dates via manual entry
    const todayStr = getLocalYMD(new Date());
    if (dateVal > todayStr) {
        showCustomAlert("Future book keeping is not allowed.", "Invalid Date", "⚠️");
        document.getElementById('audit-date').value = todayStr;
        return loadAuditForDate();
    }
    
    currentAuditDate = dateVal;
    
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = "Loading Stock Audit...";

    db.collection("bookkeeping").doc(dateVal).get().then(doc => {
        if(doc.exists) {
            currentAuditData = doc.data();
            currentAuditData.items = currentAuditData.items.map(item => ({
                ...item,
                historicComments: item.historicComments || item.comment || "",
                draftComment: item.draftComment || ""
            }));
        } else {
            const itemsToAudit = appData.inventory
                .filter(p => (p.inStock || 0) > 0)
                .map(p => ({
                    id: p.id,
                    name: p.name,
                    systemStock: p.inStock || 0,
                    physicalStock: "",
                    historicComments: "",
                    draftComment: ""
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

    const todayStr = getLocalYMD(new Date());
    const isPastDate = currentAuditDate < todayStr;

    // 🌟 ROLE & TIME-BASED LOGIC
    // If it's a past date, NO ONE can act. It is completely frozen.
    const isStockiestActing = !isPastDate && isStockiest && (currentAuditData.status === 'draft' || currentAuditData.status === 'returned');
    const isAdminActing = !isPastDate && isAdmin && currentAuditData.status === 'submitted';
    
    // Inputs are locked if it is a past date, or if the form is submitted/approved.
    const isLocked = isPastDate || currentAuditData.status === 'submitted' || currentAuditData.status === 'approved';

    // Extract submit time for message logic (fallback to current time if missing)
    let submitHour = 0;
    if (currentAuditData.submitTime) {
        submitHour = new Date(currentAuditData.submitTime).getHours();
    }

    // 🌟 BANNER MESSAGING LOGIC
    statusBanner.style.display = "block"; // Always show a banner unless it's a blank draft today

    if (isPastDate) {
        // --- PAST DATES (FROZEN VIEWS) ---
        btnSave.style.display = "none"; 
        btnSubmit.style.display = "none"; 
        adminActions.style.display = "none";

        if (currentAuditData.status === 'draft' || currentAuditData.status === 'returned') {
            statusBanner.className = "alert alert-danger fw-bold";
            statusBanner.innerText = "❌ Daily stock was not audited";
        } else if (currentAuditData.status === 'submitted') {
            statusBanner.className = "alert alert-warning fw-bold";
            if (submitHour >= 21) {
                statusBanner.innerText = "⚠️ Book keeping submitted after 9PM and Admin did not act on it";
            } else {
                statusBanner.innerText = "⚠️ Admin did not act on the Book Keeping";
            }
        } else if (currentAuditData.status === 'approved') {
            statusBanner.className = "alert alert-success fw-bold";
            if (submitHour >= 21) {
                statusBanner.innerText = "✅ Book Keeping submitted after 9PM, Audit approved and Inventory Synced";
            } else {
                statusBanner.innerText = "✅ Audit Approved & Inventory Synced";
            }
        }
    } else {
        // --- CURRENT DATE (ACTIVE VIEWS) ---
        if (currentAuditData.status === 'approved') {
            statusBanner.className = "alert alert-success fw-bold";
            if (submitHour >= 21) {
                statusBanner.innerText = "✅ Book Keeping submitted after 9PM and Admin approved it";
            } else {
                statusBanner.innerText = "✅ Audit Approved & Inventory Synced";
            }
            btnSave.style.display = "none"; btnSubmit.style.display = "none"; adminActions.style.display = "none";
        } 
        else if (currentAuditData.status === 'submitted') {
            statusBanner.className = "alert alert-info fw-bold";
            if (submitHour >= 21) {
                statusBanner.innerText = "⚠️ Book keeping submitted after 9PM. Waiting for Admin approval.";
            } else {
                statusBanner.innerText = "🔒 Audit Submitted - Waiting for Admin Approval";
            }
            btnSave.style.display = "none"; btnSubmit.style.display = "none"; 
            adminActions.style.display = isAdminActing ? "block" : "none";
        } 
        else if (currentAuditData.status === 'returned') {
            statusBanner.className = "alert alert-warning fw-bold";
            statusBanner.innerText = "⚠️ Audit Returned by Admin - Corrections Needed";
            btnSave.style.display = isStockiestActing ? "block" : "none"; 
            btnSubmit.style.display = isStockiestActing ? "block" : "none";
            adminActions.style.display = "none";
        } 
        else {
            // It's a fresh Draft today
            statusBanner.style.display = "none";
            btnSave.style.display = isStockiestActing ? "block" : "none"; 
            btnSubmit.style.display = isStockiestActing ? "block" : "none";
            adminActions.style.display = "none";
        }
    }

    // Inject Admin Buttons
    adminActions.innerHTML = `
        <div class="d-flex gap-2">
            <button class="btn btn-warning flex-grow-1 fw-bold shadow-sm" onclick="processAdminAction('returned')">↩️ Return for Correction</button>
            <button class="btn btn-success flex-grow-1 fw-bold shadow-sm" onclick="processAdminAction('approved')">✅ Approve & Sync Stock</button>
        </div>
    `;

    if (currentAuditData.items.length === 0) {
        container.innerHTML = `<div class="text-center p-5 text-muted bg-light rounded-4 border">No active inventory items found to audit.</div>`;
        return;
    }

    // Render Items
    container.innerHTML = currentAuditData.items.map((item, idx) => {
        let commentsHTML = "";
        
        if (item.historicComments) {
            commentsHTML += `<div class="p-2 mt-2 bg-white border rounded text-dark small font-monospace shadow-sm" style="white-space: pre-wrap; font-size: 12px; border-left: 4px solid #64748b !important;">${item.historicComments}</div>`;
        }

        if (isStockiestActing) {
            commentsHTML += `<textarea id="audit-comment-${idx}" class="form-control mt-2 font-13" rows="2" placeholder="Stockiest Notes: Enter discrepancy reason...">${item.draftComment || ""}</textarea>`;
        }
        
        if (isAdminActing) {
            commentsHTML += `<textarea id="audit-admin-comment-${idx}" class="form-control border-warning mt-2 font-13" rows="2" placeholder="Admin Notes: Enter instructions or remarks..."></textarea>`;
        }

        return `
        <div class="p-3 bg-light border rounded-4 shadow-sm" style="border-color: #e2e8f0 !important;">
            <div class="fw-bold mb-2" style="color: #0b2a5c;">${item.name}</div>
            <div class="row g-2 align-items-center mb-1">
                <div class="col-6">
                    <label class="form-label mb-1" style="font-size:10px;">System Stock</label>
                    <input type="text" class="form-control bg-white text-center fw-bold text-muted" value="${item.systemStock}" readonly disabled>
                </div>
                <div class="col-6">
                    <label class="form-label mb-1" style="font-size:10px; color:#d97706;">Physical Count</label>
                    <input type="number" id="audit-qty-${idx}" class="form-control text-center fw-bold border-warning" placeholder="Count" value="${item.physicalStock}" ${isLocked ? 'disabled' : ''}>
                </div>
            </div>
            ${commentsHTML}
        </div>`;
    }).join('');
}

// 🌟 STOCKIEST ACTION: Save or Submit
async function saveAudit(targetStatus) {
    let hasErrors = false;
    let errorMsg = "";
    
    currentAuditData.items.forEach((item, idx) => {
        const physInput = document.getElementById(`audit-qty-${idx}`).value;
        const draftInputEl = document.getElementById(`audit-comment-${idx}`);
        const draftInput = draftInputEl ? draftInputEl.value.trim() : item.draftComment;
        
        item.physicalStock = physInput === "" ? "" : parseInt(physInput);
        item.draftComment = draftInput;

        if (targetStatus === 'submitted') {
            if (physInput === "") {
                hasErrors = true;
                errorMsg = "Please enter the physical stock count for all items before submitting the final audit.";
            }
            const combinedComments = item.historicComments + item.draftComment;
            if (item.physicalStock !== "" && item.physicalStock !== item.systemStock && combinedComments.trim() === "") {
                hasErrors = true;
                errorMsg = `Discrepancy found for "${item.name}". You must provide a reason in the comments.`;
            }
        }
    });

    if (hasErrors) return showCustomAlert(errorMsg, "Incomplete Data", "⚠️");

    if (targetStatus === 'submitted') {
        // 🌟 Save exact submit time for logic checks
        currentAuditData.submitTime = new Date().toISOString();
        
        currentAuditData.items.forEach(item => {
            if (item.draftComment) {
                const prefix = item.historicComments ? "\n" : "";
                item.historicComments += `${prefix}StksT: ${item.draftComment}`;
                item.draftComment = ""; 
            }
        });
    }

    currentAuditData.status = targetStatus;
    currentAuditData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();

    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = targetStatus === 'submitted' ? "Submitting Audit..." : "Saving Draft...";

    try {
        await db.collection("bookkeeping").doc(currentAuditDate).set(currentAuditData);
        showCustomAlert(targetStatus === 'submitted' ? "Audit submitted to Admin and locked!" : "Draft saved successfully.", "Success", "✅");
        renderAuditUI();
    } catch (error) {
        console.error(error);
        showCustomAlert("Failed to save audit to cloud.", "Error", "🔴");
        if(targetStatus === 'submitted') currentAuditData.status = 'draft'; 
    } finally {
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

// 🌟 ADMIN ACTION: Approve or Return
async function processAdminAction(actionStatus) {
    if (!isAdmin) return;
    
    let actionText = actionStatus === 'approved' ? "approve" : "return";
    let confirmMsg = actionStatus === 'approved' 
        ? "Approve this audit? This will permanently update master inventory to match the physical counts."
        : "Return this audit to the Stockiest for corrections? This will unlock the form for them.";

    showCustomConfirm(confirmMsg, async () => {
        document.getElementById('loading-overlay').style.display = 'flex';
        document.getElementById('loading-text').innerText = "Processing...";

        currentAuditData.items.forEach((item, idx) => {
            const adminInputEl = document.getElementById(`audit-admin-comment-${idx}`);
            if (adminInputEl && adminInputEl.value.trim() !== "") {
                const prefix = item.historicComments ? "\n" : "";
                item.historicComments += `${prefix}Admin: ${adminInputEl.value.trim()}`;
            }
        });

        currentAuditData.status = actionStatus;
        currentAuditData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();
        
        // 🌟 Record exactly when the Admin approved it
        if (actionStatus === 'approved') {
            currentAuditData.approveTime = new Date().toISOString();
        }

        try {
            const batch = db.batch();
            const auditRef = db.collection("bookkeeping").doc(currentAuditDate);

            if (actionStatus === 'approved') {
                currentAuditData.items.forEach(auditItem => {
                    const prodRef = db.collection("inventory").doc(auditItem.id);
                    batch.update(prodRef, { inStock: auditItem.physicalStock });
                    
                    const localProdIdx = appData.inventory.findIndex(p => p.id === auditItem.id);
                    if (localProdIdx > -1) appData.inventory[localProdIdx].inStock = auditItem.physicalStock;
                });
            }

            batch.set(auditRef, currentAuditData);
            await batch.commit();

            if (actionStatus === 'approved') renderProductList();
            
            showCustomAlert(`Audit successfully ${actionStatus}.`, "Success", "✅");
            renderAuditUI();
            
        } catch(e) {
            console.error("Admin Action Error:", e);
            currentAuditData.status = 'submitted'; 
            showCustomAlert(`Failed to ${actionText} audit.`, "Error", "🔴");
        } finally {
            document.getElementById('loading-overlay').style.display = 'none';
        }
    }, `Yes, ${actionStatus === 'approved' ? 'Approve' : 'Return'}`);
}