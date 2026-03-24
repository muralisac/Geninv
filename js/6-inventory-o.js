// js/6-inventory.js

function renderProductList() { 
    const list = document.getElementById("products-list");
    list.innerHTML = appData.inventory.map(p => { 
        let priceDisplay = isNaN(p.price) ? "Error" : p.price.toFixed(2); 
        let pPriceDisplay = p.purchasePrice ? `| Purch: ₹${p.purchasePrice.toFixed(2)}` : "";
        let stockDisplay = p.inStock ? p.inStock : 0;
        
        let deleteBtn = '';
        if (isAdmin) {
            if (stockDisplay === 0) {
                // Allows deletion if stock is exactly 0
                deleteBtn = `<button class="btn btn-danger btn-sm shadow-sm" onclick="promptDeleteProduct('${p.id}')">🗑️</button>`;
            } else {
                // Shows a faded button that alerts the user if they try to delete an item with active stock
                deleteBtn = `<button class="btn btn-secondary btn-sm shadow-sm opacity-50" onclick="showCustomAlert('Cannot delete items that have stock remaining. Please adjust the stock to 0 first.', 'Action Blocked', '🔒')">🗑️</button>`;
            }
        }
        
        return `
        <div class="list-item">
            <div>
                <strong style="color:#0b2a5c;">${p.name}</strong><br>
                <small class="text-muted">Sell: ₹${priceDisplay} ${pPriceDisplay} | GST: ${p.gstPercent}%</small><br>
                <span class="badge ${stockDisplay > 0 ? 'bg-success' : 'bg-danger'} mt-1">In Stock: ${stockDisplay}</span>
            </div>
            <div class="d-flex align-items-center gap-2">
                ${isAdmin ? `<button class="btn btn-light action-btn border shadow-sm" onclick="editProduct('${p.id}')">Edit</button>` : ''}
                ${deleteBtn}
            </div>
        </div>`; 
    }).join(''); 
    populateDropdowns(); 
}

function promptDeleteProduct(id) {
    if(!isAdmin) return;
    const product = appData.inventory.find(p => p.id === id);
    if(!product) return;
    
    // Double check security
    if((product.inStock || 0) > 0) {
        showCustomAlert("Cannot delete items that have stock remaining.", "Action Blocked", "🔒");
        return;
    }
    
    showCustomConfirm(
        `Are you sure you want to permanently delete the inventory item "${product.name}"?`, 
        () => executeDeleteProduct(id), 
        "Yes, Delete"
    );
}

async function executeDeleteProduct(id) {
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = "Deleting Item...";
    
    try {
        // Delete from Firebase Cloud
        await db.collection("inventory").doc(id).delete();
        
        // Remove from local array
        appData.inventory = appData.inventory.filter(p => p.id !== id);
        
        // Refresh UI
        renderProductList(); 
        showCustomAlert("Item successfully deleted from inventory.", "Success", "✅");
    } catch (error) {
        console.error("Error deleting product:", error);
        showCustomAlert("Failed to delete item. Check your network.", "Error", "🔴");
    } finally {
        document.getElementById('loading-overlay').style.display = 'none';
    }
}

function editProduct(id) { 
    if(!isAdmin) return;
    const formContainer = document.getElementById('product-form-container');
    formContainer.style.display = 'block'; 
    document.getElementById('btn-add-product').style.display = 'none';
    
    if (id === 'new') { 
        document.getElementById('prod-id').value = 'new'; 
        document.getElementById('prod-name').value = ''; 
        document.getElementById('prod-price').value = ''; 
        document.getElementById('prod-purchase-price').value = '';
        document.getElementById('prod-gst').value = '5'; 
        document.getElementById('prod-moq').value = '1'; 
        document.getElementById('prod-stock').value = '0';
    } else { 
        const p = appData.inventory.find(x => x.id === id); 
        document.getElementById('prod-id').value = p.id; 
        document.getElementById('prod-name').value = p.name; 
        document.getElementById('prod-price').value = isNaN(p.price) ? "" : p.price; 
        document.getElementById('prod-purchase-price').value = p.purchasePrice ? p.purchasePrice : ""; 
        document.getElementById('prod-gst').value = isNaN(p.gstPercent) ? "5" : p.gstPercent; 
        document.getElementById('prod-moq').value = isNaN(p.moq) ? "1" : p.moq; 
        document.getElementById('prod-stock').value = isNaN(p.inStock) ? "0" : p.inStock; 
    } 
    setTimeout(() => { formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
}

async function saveProduct() { 
    if(!isAdmin) return;
    const id = document.getElementById('prod-id').value; 
    const name = document.getElementById('prod-name').value; 
    const price = parseFloat(document.getElementById('prod-price').value); 
    const pPrice = parseFloat(document.getElementById('prod-purchase-price').value); 
    const gst = parseFloat(document.getElementById('prod-gst').value); 
    const moq = parseInt(document.getElementById('prod-moq').value); 
    const inStock = parseInt(document.getElementById('prod-stock').value) || 0;
    
    if (!name) return showCustomAlert("Please enter a product name."); 
    if (isNaN(price) || price <= 0) return showCustomAlert("Please enter a valid wholesale selling price."); 
    
    const p = { id: id === 'new' ? 'p' + Date.now() : id, name, price, gstPercent: gst, moq, inStock }; 
    if (!isNaN(pPrice)) p.purchasePrice = pPrice; 
    
    await db.collection("inventory").doc(p.id).set(p); 
    
    if (id === 'new') {
        appData.inventory.push(p); 
    } else { 
        const idx = appData.inventory.findIndex(x => x.id === id); 
        appData.inventory[idx] = p; 
    } 
    
    cancelProductEdit(); 
    renderProductList(); 
}

function cancelProductEdit() { 
    document.getElementById('product-form-container').style.display = 'none'; 
    document.getElementById('btn-add-product').style.display = isAdmin ? 'block' : 'none'; 
        }
    
