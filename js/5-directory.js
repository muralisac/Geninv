function renderCustomerList() { 
    const list = document.getElementById("customers-list");
    list.innerHTML = appData.customers.map(c => `
        <div class="list-item">
            <div>
                <strong style="color:#0b2a5c;">${c.name}</strong><br>
                <small class="text-muted">GST: ${c.gstin}</small>
            </div>
            ${isAdmin ? `<button class="btn btn-light action-btn border shadow-sm" onclick="editCustomer('${c.id}')">Edit</button>` : ''}
        </div>
    `).join(''); 
    populateDropdowns(); 
}

function editCustomer(id) { 
    if(!isAdmin) return;
    const formContainer = document.getElementById('customer-form-container');
    formContainer.style.display = 'block'; 
    document.getElementById('btn-add-customer').style.display = 'none';
    
    if (id === 'new') { 
        document.getElementById('cust-id').value = 'new'; 
        document.getElementById('cust-name').value = ''; 
        document.getElementById('cust-address').value = ''; 
        document.getElementById('cust-gstin').value = ''; 
        document.getElementById('cust-state').value = '33'; 
    } else { 
        const c = appData.customers.find(x => x.id === id); 
        document.getElementById('cust-id').value = c.id; 
        document.getElementById('cust-name').value = c.name; 
        document.getElementById('cust-address').value = c.address.replace(/<br>/g, '\n'); 
        document.getElementById('cust-gstin').value = c.gstin; 
        document.getElementById('cust-state').value = isNaN(c.stateCode) ? "" : c.stateCode; 
    }
    setTimeout(() => { formContainer.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
}

async function saveCustomer() { 
    if(!isAdmin) return;
    const id = document.getElementById('cust-id').value; 
    const name = document.getElementById('cust-name').value; 
    const address = document.getElementById('cust-address').value.replace(/\n/g, '<br>'); 
    const gstin = document.getElementById('cust-gstin').value; 
    const stateCode = parseInt(document.getElementById('cust-state').value); 
    
    if (!name) return showCustomAlert("Please enter a business name."); 
    
    const c = { id: id === 'new' ? 'c' + Date.now() : id, name, address, gstin, stateCode }; 
    
    await db.collection("customers").doc(c.id).set(c); 
    
    if (id === 'new') {
        appData.customers.push(c); 
    } else { 
        const idx = appData.customers.findIndex(x => x.id === id); 
        appData.customers[idx] = c; 
    } 
    
    cancelCustomerEdit(); 
    renderCustomerList(); 
}

function cancelCustomerEdit() { 
    document.getElementById('customer-form-container').style.display = 'none'; 
    document.getElementById('btn-add-customer').style.display = isAdmin ? 'block' : 'none'; 
}