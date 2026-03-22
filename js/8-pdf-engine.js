function renderInvoiceHTML(cart, type, buyer, docNum, docDate) {
    let subTotal = 0, totalGst = 0, mainGstRate = 0; 
    cart.forEach((item) => { 
        let baseAmt = item.qty * item.price; 
        let gstAmt = baseAmt * (item.gstPercent / 100); 
        subTotal += baseAmt; 
        totalGst += gstAmt; 
        mainGstRate = item.gstPercent; 
    }); 
    const exactGrandTotal = subTotal + totalGst; 
    const roundedGrandTotal = Math.round(exactGrandTotal); 
    const roundOffAmt = roundedGrandTotal - exactGrandTotal; 
    const roundedGst = Math.round(totalGst);

    let chunks = [];
    const ITEMS_PER_PAGE = 18; 
    
    for (let i = 0; i < cart.length; i += ITEMS_PER_PAGE) {
        chunks.push(cart.slice(i, i + ITEMS_PER_PAGE));
    }
    if (chunks.length === 0) chunks.push([]); 

    let html = '';
    const headerClass = type === 'po' ? 'th-po' : '';
    const waveClass = type === 'po' ? 'wave-po' : '';
    const titleColor = type === 'po' ? '#d97706' : '#0b2a5c';
    const titleText = type === 'po' ? 'PURCHASE ORDER' : 'INVOICE';
    const billToLabel = type === 'po' ? 'VENDOR' : 'BILL TO';
    const billFromLabel = type === 'po' ? 'PURCHASER' : 'BILL FROM';

    chunks.forEach((chunk, cIdx) => {
        let isLast = cIdx === chunks.length - 1;
        let pageBreak = cIdx > 0 ? 'page-break' : '';
        
        let tbody = '';
        chunk.forEach((item, idx) => {
            let actualIdx = (cIdx * ITEMS_PER_PAGE) + idx;
            let baseAmt = item.qty * item.price; 
            let gstAmt = baseAmt * (item.gstPercent / 100); 
            let padClass = cart.length <= 5 ? 'py-3-custom' : (cart.length <= 12 ? 'py-2-custom' : 'py-1-custom');

            tbody += `<tr>
                <td class="${padClass}">${actualIdx + 1}</td>
                <td class="${padClass} fw-medium">${item.name}</td>
                <td class="${padClass} text-center">${item.qty}</td>
                <td class="${padClass} text-end">₹${item.price.toFixed(2)}</td>
                <td class="${padClass} text-end text-muted">₹${gstAmt.toFixed(2)} <span style="font-size:10px;">(${item.gstPercent}%)</span></td>
                <td class="${padClass} text-end fw-bold" style="color:#0b2a5c;">₹${(baseAmt + gstAmt).toFixed(2)}</td>
            </tr>`;
        });

        let taxRows = '';
        if (SELLER_STATE === buyer.stateCode) { 
            taxRows = `<div class="totals-row"><span>SGST @ ${mainGstRate/2}%</span> <span>₹${(totalGst/2).toFixed(2)}</span></div>
                       <div class="totals-row"><span>CGST @ ${mainGstRate/2}%</span> <span>₹${(totalGst/2).toFixed(2)}</span></div>`; 
        } else { 
            taxRows = `<div class="totals-row"><span>IGST @ ${mainGstRate}%</span> <span>₹${totalGst.toFixed(2)}</span></div>`; 
        }

        let totalsHTML = isLast ? `
            <div class="row totals-section pt-4 mt-auto">
                <div class="col-7 pe-md-4">
                    <h4 class="h6 fw-bold mb-2 text-uppercase" style="color: ${titleColor};">Amount in Words</h4>
                    <p class="font-13 mb-4 text-capitalize fw-medium">${numberToWords(roundedGrandTotal)}</p>
                    <h4 class="h6 fw-bold mb-2 text-uppercase" style="color: ${titleColor};">Terms & Conditions</h4>
                    <p class="font-13 mb-0 text-muted">Thanks for doing business with us.</p>
                </div>
                <div class="col-5">
                    <div class="totals-box mb-2">
                        <div class="totals-row"><span>Sub Total:</span> <span>₹${subTotal.toFixed(2)}</span></div>
                        ${taxRows}
                        <div class="totals-row"><span>Total GST</span> <span>₹${totalGst.toFixed(2)} (Rounded: ₹${roundedGst})</span></div>
                        <div class="totals-row text-muted" style="font-size: 11px; border-top: 1px dashed #cbd5e1;"><span>Round Off</span> <span>${roundOffAmt >= 0 ? '+' : ''}₹${roundOffAmt.toFixed(2)}</span></div>
                    </div>
                    <div class="grand-total-box ${type === 'po' ? 'grand-po' : ''}">
                        <span>TOTAL</span> <span>₹${roundedGrandTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        ` : `<div class="mt-auto text-end text-muted font-13 fw-bold pe-4 pt-4 border-top">Continued on next page...</div>`;

        html += `
        <div class="invoice-page ${pageBreak}">
            <div class="wave-top ${waveClass}"></div>
            <div class="invoice-header-wrapper-abs">
                <img src="NNlogo-removebg-preview.png" alt="Logo" class="flex-shrink-0" style="height: 45px; width: auto; margin-right: 15px;">
                <h2 class="invoice-header-title text-white m-0" style="font-size:24px;">SRI TOTATRI AGRO FOODS PVT LTD</h2>
            </div>
            <div class="content-wrapper d-flex flex-column" style="padding: 130px 8% 40px 8%; flex-grow: 1; height: 100%;">
                <div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3" style="border-color:#cbd5e1!important;">
                    <h1 class="m-0" style="letter-spacing: 1px; color: ${titleColor}; font-weight: 900; font-size: 32px; line-height: 1;">${titleText}</h1>
                    <div class="text-muted font-13">Number: <strong class="text-dark">${docNum}</strong></div>
                    <div class="text-muted font-13">Date: <strong class="text-dark">${docDate}</strong></div>
                </div>
                <div class="row mb-4">
                    <div class="col-6">
                        <h3 class="h6 pb-2 fw-bold text-uppercase" style="color: ${titleColor}; border-bottom: 1px solid #cbd5e1;">${billToLabel}</h3>
                        <div class="font-13 lh-base mt-2"><span class="fw-bold" style="font-size: 14px;">${buyer.name}</span><br>${buyer.address}<br><span class="text-muted mt-1 d-block">GST # ${buyer.gstin}</span></div>
                    </div>
                    <div class="col-6">
                        <h3 class="h6 pb-2 fw-bold text-uppercase" style="color: ${titleColor}; border-bottom: 1px solid #cbd5e1;">${billFromLabel}</h3>
                        <div class="font-13 lh-base mt-2">Sri Totatri Agro Foods Pvt Ltd<br>5/209 Thazaikulam Rd,<br>Naguneri, Tirunelveli.<br>GST # 33ABICS3082J1Z6</div>
                    </div>
                </div>
                <div class="border rounded-3 overflow-hidden ${isLast ? '' : 'mb-4'}" style="border-color:#cbd5e1!important;">
                    <table class="table custom-table mb-0 ${cart.length > 5 ? 'table-sm' : ''}">
                        <thead>
                            <tr>
                                <th width="5%" class="${headerClass}">#</th>
                                <th width="35%" class="${headerClass}">Description</th>
                                <th width="10%" class="text-center ${headerClass}">Qty</th>
                                <th width="15%" class="text-end ${headerClass}">Price</th>
                                <th width="15%" class="text-end ${headerClass}">GST</th>
                                <th width="20%" class="text-end ${headerClass}">Amount</th>
                            </tr>
                        </thead>
                        <tbody>${tbody}</tbody>
                    </table>
                </div>
                ${totalsHTML}
            </div>
        </div>
        `;
    });
    return { html, roundedGrandTotal };
}

function downloadPDF() { 
    document.getElementById('app-controls').style.display = 'none'; 
    const payoutBox = document.getElementById('payout-status-container'); 
    const payoutWasVisible = payoutBox.style.display === 'block'; 
    payoutBox.style.display = 'none'; 
    
    const scrollWrappers = document.querySelectorAll('.table-scroll-wrapper, .invoice-scroll-wrapper');
    scrollWrappers.forEach(tw => { tw.style.overflowX = 'visible'; tw.scrollLeft = 0; });
    
    const element = document.getElementById('invoice-content'); 
    element.classList.add('pdf-mode'); 
    
    const opt = { 
        margin: 0, 
        filename: `${tempDocNumber}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2, useCORS: true, windowWidth: 800, width: 800, scrollX: 0, scrollY: 0 }, 
        jsPDF: { unit: 'px', format: [800, 1122], orientation: 'portrait' } 
    }; 
    
    html2pdf().set(opt).from(element).save().then(() => { 
        document.getElementById('app-controls').style.display = 'block'; 
        if(payoutWasVisible) payoutBox.style.display = 'block'; 
        element.classList.remove('pdf-mode'); 
        scrollWrappers.forEach(tw => { tw.style.overflowX = 'auto'; });
    }); 
}