function renderProductList() { 
    const list = document.getElementById("products-list");
    list.innerHTML = appData.inventory.map(p => { 
        let priceDisplay = isNaN(p.price) ? "Error" : p.price.toFixed(2); 
        let pPriceDisplay = p.purchasePrice ? `| Purch: ₹${p.purchasePrice.toFixed(2)}` : "";
        let stockDisplay = p.inStock ? p.inStock : 0;
        
        return `
        <div class="list-item">
            <div>
                <strong style="color:#0b2a5c;">${p.name}</strong><br>
                <small class="text-muted">Sell: ₹${priceDisplay} ${pPriceDisplay} | GST: ${p.gstPercent}%</small><br>
                <span class="badge ${stockDisplay > 0 ? 'bg-success' : 'bg-danger'} mt-1">In Stock: ${stockDisplay}</span>
            </div>
            ${isAdmin ? `<button class="btn btn-light action-btn border shadow-sm" onclick="editProduct('${p.id}')">Edit</button>` : ''}
        </div>`; 
    }).join(''); 
    populateDropdowns(); 
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