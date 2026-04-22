// js/5-inventory.js

function renderProductList() { 
    const list = document.getElementById("products-list");
    list.innerHTML = appData.inventory.map(p => { 
        let priceDisplay = isNaN(p.price) ? "Error" : p.price.toFixed(2); 
        let stockDisplay = p.inStock ? p.inStock : 0;
        
        let codeIcons = '';
        if (p.barcode || p.qrcode) {
            codeIcons = `<div class="mt-1">
                ${p.barcode ? `<span class="badge border text-dark bg-white" style="font-size:10px;">|||| Barcode</span>` : ''}
                ${p.qrcode ? `<span class="badge border text-dark bg-white" style="font-size:10px;">⬛ QR</span>` : ''}
            </div>`;
        }
        
        let deleteBtn = '';
        if (isAdmin) {
            if (stockDisplay === 0) {
                deleteBtn = `<button class="btn btn-danger btn-sm shadow-sm" onclick="promptDeleteProduct('${p.id}')">🗑️</button>`;
            } else {
                deleteBtn = `<button class="btn btn-secondary btn-sm shadow-sm opacity-50" onclick="showCustomAlert('Cannot delete items that have stock remaining. Please adjust the stock to 0 first.', 'Action Blocked', '🔒')">🗑️</button>`;
            }
        }
        
        return `
        <div class="list-item">
            <div>
                <strong style="color:#0b2a5c;">${p.name}</strong><br>
                <small class="text-muted">Sell: ₹${priceDisplay} | GST: ${p.gstPercent}%</small><br>
                <span class="badge ${stockDisplay > 0 ? 'bg-success' : 'bg-danger'} mt-1">In Stock: ${stockDisplay}</span>
                ${codeIcons}
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
    if((product.inStock || 0) > 0) { showCustomAlert("Cannot delete items with active stock.", "Blocked", "🔒"); return; }
    showCustomConfirm(`Are you sure you want to permanently delete "${product.name}"?`, () => executeDeleteProduct(id), "Yes, Delete");
}

async function executeDeleteProduct(id) {
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = "Deleting Item...";
    try {
        await db.collection("inventory").doc(id).delete();
        appData.inventory = appData.inventory.filter(p => p.id !== id);
        renderProductList(); 
        showCustomAlert("Item deleted from inventory.", "Success", "✅");
    } catch (error) { 
        showCustomAlert("Failed to delete item.", "Error", "🔴"); 
    } finally { 
        document.getElementById('loading-overlay').style.display = 'none'; 
    }
}

// 🌟 NEW: Live Barcode & QR Code Generators
function renderBarcodePreview() {
    const val = document.getElementById('prod-barcode').value.trim();
    const svg = document.querySelector("#barcode-preview");
    if (val && typeof JsBarcode !== 'undefined') {
        try {
            JsBarcode(svg, val, { format: "CODE128", width: 1.5, height: 40, displayValue: true, margin: 0 });
            svg.style.display = "block";
        } catch(e) { svg.style.display = "none"; }
    } else { svg.style.display = "none"; }
}

function renderQRPreview() {
    const val = document.getElementById('prod-qrcode').value.trim();
    const container = document.getElementById('qrcode-preview');
    container.innerHTML = "";
    if (val && typeof QRCode !== 'undefined') {
        new QRCode(container, { text: val, width: 64, height: 64, colorDark: "#0b2a5c", colorLight: "#ffffff" });
    } else {
        container.innerHTML = '<span class="text-muted small">No QR Data</span>';
    }
}

function generateRandomCode(type) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(100 + Math.random() * 900);
    
    if (type === 'barcode') {
        document.getElementById('prod-barcode').value = `890${timestamp}${random}`;
        renderBarcodePreview();
    } else {
        document.getElementById('prod-qrcode').value = `NN-QR-${timestamp}-${random}`;
        renderQRPreview();
    }
}

function editProduct(id) { 
    if(!isAdmin) return;
    const formContainer = document.getElementById('product-form-container');
    formContainer.style.display = 'block'; 
    document.getElementById('btn-add-product').style.display = 'none';
    
    for(let i=0; i<5; i++) { document.getElementById(`prod-img-${i}`).value = ""; }

    if (id === 'new') { 
        document.getElementById('prod-id').value = 'new'; 
        document.getElementById('prod-name').value = ''; 
        document.getElementById('prod-barcode').value = ''; 
        document.getElementById('prod-qrcode').value = ''; 
        document.getElementById('prod-price').value = ''; 
        document.getElementById('prod-purchase-price').value = '';
        document.getElementById('prod-gst').value = '5'; 
        document.getElementById('prod-moq').value = '1'; 
        document.getElementById('prod-stock').value = '0';
    } else { 
        const p = appData.inventory.find(x => x.id === id); 
        document.getElementById('prod-id').value = p.id; 
        document.getElementById('prod-name').value = p.name; 
        document.getElementById('prod-barcode').value = p.barcode || ''; 
        document.getElementById('prod-qrcode').value = p.qrcode || ''; 
        document.getElementById('prod-price').value = isNaN(p.price) ? "" : p.price; 
        document.getElementById('prod-purchase-price').value = p.purchasePrice ? p.purchasePrice : ""; 
        document.getElementById('prod-gst').value = isNaN(p.gstPercent) ? "5" : p.gstPercent; 
        document.getElementById('prod-moq').value = isNaN(p.moq) ? "1" : p.moq; 
        document.getElementById('prod-stock').value = isNaN(p.inStock) ? "0" : p.inStock; 
    } 
    
    // Trigger the previews!
    renderBarcodePreview(); 
    renderQRPreview();
    
    setTimeout(() => { formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
}

async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = e => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500;
                const scale = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            }
        };
    });
}

async function saveProduct() { 
    if(!isAdmin) return;
    const id = document.getElementById('prod-id').value; 
    const name = document.getElementById('prod-name').value.trim(); 
    const barcode = document.getElementById('prod-barcode').value.trim(); 
    const qrcode = document.getElementById('prod-qrcode').value.trim(); 
    const price = parseFloat(document.getElementById('prod-price').value); 
    const pPrice = parseFloat(document.getElementById('prod-purchase-price').value); 
    const gst = parseFloat(document.getElementById('prod-gst').value); 
    const moq = parseInt(document.getElementById('prod-moq').value); 
    const inStock = parseInt(document.getElementById('prod-stock').value) || 0;
    
    // 🌟 ENFORCE MANDATORY CODES
    if (!name || isNaN(price) || price <= 0 || !barcode || !qrcode) {
        return showCustomAlert("Please fill all mandatory fields, including the Barcode and QR Code.", "Missing Data", "⚠️"); 
    }

    document.getElementById('btn-save-product').innerText = "Compressing Images...";
    document.getElementById('btn-save-product').disabled = true;

    const existingProduct = appData.inventory.find(x => x.id === id);
    let imagesArray = [];

    for(let i=0; i<5; i++) {
        let fileInput = document.getElementById(`prod-img-${i}`);
        if (fileInput && fileInput.files && fileInput.files[0]) {
            let b64 = await compressImage(fileInput.files[0]);
            imagesArray.push(b64);
        } else if (existingProduct && existingProduct.images && existingProduct.images[i]) {
            imagesArray.push(existingProduct.images[i]);
        }
    }
    
    const p = { id: id === 'new' ? 'p' + Date.now() : id, name, barcode, qrcode, price, gstPercent: gst, moq, inStock, images: imagesArray }; 
    if (!isNaN(pPrice)) p.purchasePrice = pPrice; 
    
    document.getElementById('btn-save-product').innerText = "Saving to Cloud...";

    try {
        await db.collection("inventory").doc(p.id).set(p); 
        if (id === 'new') appData.inventory.push(p); 
        else { const idx = appData.inventory.findIndex(x => x.id === id); appData.inventory[idx] = p; } 
        
        cancelProductEdit(); 
        renderProductList(); 
    } catch(err) {
        showCustomAlert("Error saving product to cloud.");
    } finally {
        document.getElementById('btn-save-product').innerText = "Save to Cloud";
        document.getElementById('btn-save-product').disabled = false;
    }
}

function cancelProductEdit() { 
    document.getElementById('product-form-container').style.display = 'none'; 
    document.getElementById('btn-add-product').style.display = isAdmin ? 'block' : 'none'; 
}

function populateDropdowns() { 
    const custHtml = `<option value="">-- Select --</option>` + appData.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById("customer-select").innerHTML = custHtml; 
    document.getElementById("po-vendor-select").innerHTML = custHtml;
    
    const prodHtml = `<option value="">-- Choose Item --</option>` + appData.inventory.map(p => `<option value="${p.id}">${p.name} [Stock: ${p.inStock || 0}]</option>`).join('');
    document.getElementById("product-select").innerHTML = prodHtml; 
    document.getElementById("po-product-select").innerHTML = prodHtml;
}