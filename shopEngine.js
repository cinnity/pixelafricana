/**
 * PixelAfricana - Frontend Core Runtime Engine (Production Build)
 */

window.adjustLocalQuantityInput = (factor) => {
    const el = document.getElementById('detailQtyInput');
    if (el) el.value = Math.max(1, (parseInt(el.value, 10) || 1) + factor);
};

window.syncMainStageImageFromThumbnail = (thumb) => {
    if (!thumb) return;
    document.getElementById('mainStageImage').src = thumb.src;
    document.querySelectorAll('.thumb-node').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
};

document.addEventListener('DOMContentLoaded', () => {
    initializeCartWidgetState();
    initializeHeadlessVariantManager();
    
    // Core Click Delegator (Cart actions, poetry triggers, gallery panels)
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart-btn')) {
            executeAddToCartSequence(e.target.getAttribute('data-id'), 1, null);
        }
        if (e.target.id === 'detailAddToCartBtn') {
            const qty = parseInt(document.getElementById('detailQtyInput')?.value, 10) || 1;
            executeAddToCartSequence(e.target.getAttribute('data-id'), qty, e.target.getAttribute('data-selected-variant'));
        }
        if (e.target.id === 'mainStageImage') document.getElementById('poemOverlaySheet')?.classList.add('open');
        if (e.target.id === 'closePoemTrigger') { e.stopPropagation(); document.getElementById('poemOverlaySheet')?.classList.remove('open'); }
    });
});

/**
 * HEADLESS VARIANT MANAGER: Injects dimension drop-downs & filters carousels live
 */
function initializeHeadlessVariantManager() {
    const container = document.getElementById('productDetailContainer');
    if (!container) return;
    
    if (container.getAttribute('data-fulfillment') !== 'printify') {
        return; 
    }

    const mountNode = document.getElementById('variantDropdownMountInjectionNode');
    if (!mountNode) return;

    const rawVariants = container.getAttribute('data-variants');
    let variants = [];
    
    try {
        if (rawVariants && rawVariants !== "[]") {
            // UNIFIED LOOKUP: Grab variants that have valid SKUs OR are explicitly flagged active/enabled
            variants = JSON.parse(rawVariants).filter(v => 
                (v.sku && v.sku.trim() !== "") || v.is_enabled === true || v.id === 101419
            );
        }
    } catch (e) {
        console.error("Variant parsing failed:", e);
    }

    // EMERGENCY DROPDOWN GENERATOR ARCHITECTURE
    if (variants.length === 0) {
        console.log("ℹ️ Matrix empty. Reverting to automated catalog size configuration mapping.");
        variants = [
            { id: 91657, title: "12″ x 12″ Premium Canvas", price: 4223, sku: "22219955600275457604" },
            { id: 91659, title: "16″ x 16″ Premium Canvas", price: 5127, sku: "31938862247277933666" },
            { id: 91661, title: "24″ x 24″ Premium Canvas", price: 8888, sku: "21534860454495100530" },
            { id: 101419, title: "36″ x 36″ Masterpiece Canvas", price: 22273, sku: "19205149300301844053" }
        ];
    }

    let optionsHtml = variants.map(v => {
        const cleanTitle = v.title.split(' / ')[0];
        const readablePrice = v.price ? `$${(v.price / 100).toFixed(2)}` : "$42.23";
        return `<option value="${v.id}" data-price="${readablePrice}" data-sku="${v.sku || 'N/A'}">${cleanTitle}</option>`;
    }).join('');
    
    mountNode.innerHTML = `
        <div class="size-selector-wrapper" style="margin: 1.5rem 0;">
            <label for="sizeVariantSelect" style="display:block; font-weight:600; margin-bottom:0.5rem; font-family:'Quicksand'; color:#111;">Select Size:</label>
            <select id="sizeVariantSelect" class="catalog-sort-select" style="width:100%; max-width:400px; padding:0.75rem; border:1px solid #e1ded7; background-color:#fff; font-family:'Quicksand'; cursor:pointer; font-size:1rem; border-radius:4px;">
                ${optionsHtml}
            </select>
        </div>`;

    const selectEl = document.getElementById('sizeVariantSelect');
    if (!selectEl) return;

    selectEl.addEventListener('change', (e) => {
        const opt = selectEl.options[selectEl.selectedIndex];
        if (!opt) return;

        document.getElementById('productDisplayPrice').innerText = opt.getAttribute('data-price');
        document.getElementById('variantSkuDisplay').innerText = opt.getAttribute('data-sku');
        document.getElementById('detailAddToCartBtn')?.setAttribute('data-selected-variant', e.target.value);

        const rawImages = container.getAttribute('data-images');
        if (rawImages && rawImages !== "[]") {
            const images = JSON.parse(rawImages);
            const matchingImgs = images.filter(img => img.variant_ids.includes(parseInt(e.target.value, 10)));
            const thumbStrip = document.getElementById('detailThumbnailsStrip');
            
            if (thumbStrip && matchingImgs.length > 0) {
                thumbStrip.innerHTML = matchingImgs.map((img, idx) => `
                    <img src="${img.src}" alt="Angle ${idx + 1}" class="thumb-node ${idx === 0 ? 'active' : ''}" onclick="window.syncMainStageImageFromThumbnail(this)">
                `).join('');
                document.getElementById('mainStageImage').src = matchingImgs[0].src;
            }
        }
    });
    
    // Synch presentation interface values baseline state on initial script injection
    selectEl.dispatchEvent(new Event('change'));
}
/**
 * CART MATRIX SYSTEM: Handles LocalStorage state metrics pipelines
 */
function initializeCartWidgetState() {
    const cart = JSON.parse(localStorage.getItem('pixel_cart_items') || '[]');
    let totalItems = 0, totalPrice = 0;

    cart.forEach(item => {
        totalItems += item.quantity;
        totalPrice += (parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0) * item.quantity;
    });

    document.querySelectorAll('.cart-count').forEach(n => n.innerText = `${totalItems} item${totalItems !== 1 ? 's' : ''}`);
    document.querySelectorAll('.cart-total').forEach(n => n.innerText = `$${totalPrice.toFixed(2)}`);
}

function executeAddToCartSequence(productId, quantity, variantId) {
    const cart = JSON.parse(localStorage.getItem('pixel_cart_items') || '[]');
    const sig = variantId ? `${productId}_${variantId}` : productId;
    const existingIndex = cart.findIndex(item => item.basketSignature === sig);

    if (existingIndex > -1) {
        cart[existingIndex].quantity += quantity;
    } else {
        cart.push({
            basketSignature: sig,
            id: productId,
            variantId: variantId,
            title: document.querySelector('.p-title')?.innerText || "Pixel Merch Item Token",
            price: document.getElementById('productDisplayPrice')?.innerText || "$0.00",
            image: document.getElementById('mainStageImage')?.src || "/images/placeholder.jpg",
            quantity: quantity
        });
    }

    localStorage.setItem('pixel_cart_items', JSON.stringify(cart));
    initializeCartWidgetState();
    console.log(`🛒 Basket updated with signatures token id: [${sig}]`);
}