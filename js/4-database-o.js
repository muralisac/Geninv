async function fetchCloudData() {
    try {
        const metaDoc = await db.collection("metadata").doc("invoiceData").get();
        if (metaDoc.exists) { 
            appData.lastInvoiceNum = metaDoc.data().lastNum || 22; 
            appData.lastPoNum = metaDoc.data().lastPoNum || 5; 
        } else { 
            await db.collection("metadata").doc("invoiceData").set({ lastNum: 22, lastPoNum: 5 }); 
        }

        const invSnap = await db.collection("inventory").get(); 
        appData.inventory = invSnap.docs.map(doc => doc.data());
        
        const custSnap = await db.collection("customers").get(); 
        appData.customers = custSnap.docs.map(doc => doc.data());
        
        const histSnap = await db.collection("history").orderBy("timestamp", "desc").get(); 
        appData.history = histSnap.docs.map(doc => doc.data());
        
        const poSnap = await db.collection("purchaseOrders").orderBy("timestamp", "desc").get(); 
        appData.purchaseOrders = poSnap.docs.map(doc => {
            let data = doc.data();
            if (!data.status) data.status = 'converted';
            return data;
        });

        document.getElementById('loading-overlay').style.display = 'none';
        switchScreen('screen-history'); 
        
        // These functions will exist in modules 5, 6, and 7
        renderCustomerList(); 
        renderProductList(); 
        renderHistoryList(); 
        renderPOList(); 
        populateDropdowns();
    } catch (error) {
        console.error("Error connecting to Firebase:", error);
        document.getElementById('loading-text').innerText = "Database error. Please refresh.";
        document.querySelector('.spinner').style.display = 'none';
    }
}

function populateDropdowns() { 
    const custHtml = `<option value="">-- Select --</option>` + appData.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    document.getElementById("customer-select").innerHTML = custHtml; 
    document.getElementById("po-vendor-select").innerHTML = custHtml;
    
    const prodHtml = `<option value="">-- Choose Item --</option>` + appData.inventory.map(p => `<option value="${p.id}">${p.name} [Stock: ${p.inStock || 0}]</option>`).join('');
    document.getElementById("product-select").innerHTML = prodHtml; 
    document.getElementById("po-product-select").innerHTML = prodHtml;
}