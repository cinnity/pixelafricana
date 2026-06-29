/**
 * PixelAfricana - Frontend Core Runtime Engine (Production Consolidated Build)
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

// GLOBAL QUANTITY ADJUSTERS FOR INTERNAL CART ROW MUTATIONS
window.updateCartItemQuantity = function(signature, delta) {
    let cart = JSON.parse(localStorage.getItem('pixel_cart_items') || '[]');
    const idx = cart.findIndex(item => item.basketSignature === signature);
    if (idx === -1) return;
    
    cart[idx].quantity += delta;
    if (cart[idx].quantity <= 0) cart.splice(idx, 1);
    
    localStorage.setItem('pixel_cart_items', JSON.stringify(cart));
    initializeCartWidgetState();
    renderCartPageTable();
};

window.removeSingleCartItem = function(signature) {
    let cart = JSON.parse(localStorage.getItem('pixel_cart_items') || '[]');
    cart = cart.filter(item => item.basketSignature !== signature);
    localStorage.setItem('pixel_cart_items', JSON.stringify(cart));
    
    // Memory Reset: Clears lingering variant state targets on active buy buttons
    const cartBtn = document.getElementById('detailAddToCartBtn');
    if (cartBtn && cartBtn.getAttribute('data-selected-variant') === signature.split('_')[1]) {
        const selectEl = document.getElementById('sizeVariantSelect');
        cartBtn.setAttribute('data-selected-variant', selectEl ? selectEl.value : '');
    }

    initializeCartWidgetState();
    renderCartPageTable();
};

// BULLETPROOF RUNTIME INITIALIZER BOOTLOADER
function bootStorefrontEngine() {
    initializeCartWidgetState();
    if (document.getElementById('productDetailContainer')) {
        initializeHeadlessVariantManager();
    }
    renderCartPageTable();
    renderCheckoutSummary();
    
    // RUNTIME INVENTORY & INTERACTION ENGINE EXTENSIONS
    syncHomeCategoryBadges();
    initializeCatalogSorting();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootStorefrontEngine);
} else {
    bootStorefrontEngine();
}

// GLOBAL CLICK DELEGATOR TREE
document.body.addEventListener('click', (e) => {
    if (e.target.classList.contains('add-to-cart-btn')) {
        executeAddToCartSequence(e.target.getAttribute('data-id'), 1, null);
    }
    if (e.target.id === 'detailAddToCartBtn') {
        const qty = parseInt(document.getElementById('detailQtyInput')?.value, 10) || 1;
        executeAddToCartSequence(e.target.getAttribute('data-id'), qty, e.target.getAttribute('data-selected-variant'));
    }
    // FLOATING CIRCULAR POEM BUTTON TRIGGERS
    if (e.target.id === 'openPoemTrigger' || e.target.closest('#openPoemTrigger')) {
        document.getElementById('poemOverlaySheet')?.classList.add('open');
    }
    if (e.target.id === 'closePoemTrigger') { 
        e.stopPropagation(); 
        document.getElementById('poemOverlaySheet')?.classList.remove('open'); 
    }
});

/**
 * HEADLESS VARIANT MANAGER: Parses datasets safely and unrolls drop-down selectors
 */
function initializeHeadlessVariantManager() {
    const container = document.getElementById('productDetailContainer');
    if (!container || container.getAttribute('data-fulfillment') !== 'printify') return;

    const mountNode = document.getElementById('variantDropdownMountInjectionNode');
    if (!mountNode) return;

    let rawVariants = container.dataset.variants || container.getAttribute('data-variants');
    let variants = [];
    
    try {
        if (rawVariants && rawVariants !== "[]") {
            if (rawVariants.includes('&quot;')) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = rawVariants;
                rawVariants = tempDiv.textContent || tempDiv.innerText;
            }
            variants = JSON.parse(rawVariants).filter(v => v.sku && v.sku.trim() !== "");
        }
    } catch (e) {
        console.error("Variant data parse extraction blocked:", e);
    }

    if (variants.length === 0) {
        variants = [
            { id: 91657, title: "12″ x 12″ Canvas", price: 4223, sku: "22219955600275457604" },
            { id: 91659, title: "16″ x 16″ Canvas", price: 5127, sku: "31938862247277933666" },
            { id: 91661, title: "24″ x 24″ Canvas", price: 8888, sku: "21534860454495100530" },
            { id: 101419, title: "36″ x 36″ Canvas", price: 22273, sku: "19205149300301844053" }
        ];
    }

    let optionsHtml = variants.map(v => {
        return `<option value="${v.id}" data-price="$${(v.price / 100).toFixed(2)}" data-sku="${v.sku}">${v.title.split(' / ')[0]}</option>`;
    }).join('');
    
    mountNode.innerHTML = `
        <div class="size-selector-wrapper" style="margin: 1.5rem 0;">
            <label for="sizeVariantSelect" style="display:block; font-weight:600; margin-bottom:0.5rem; font-family:'Quicksand', sans-serif; color:#111; font-size: 0.95rem;">Select Size:</label>
            <select id="sizeVariantSelect" class="catalog-sort-select" style="width:100%; max-width:400px; padding:0.75rem; border:1px solid #e1ded7; background-color:#fff; font-family:'Quicksand', sans-serif; font-weight:500; color:#333; cursor:pointer; font-size:1rem; border-radius:4px; outline:none;">
                ${optionsHtml}
            </select>
        </div>`;

    const selectEl = document.getElementById('sizeVariantSelect');
    selectEl.addEventListener('change', (e) => {
        const opt = selectEl.options[selectEl.selectedIndex];
        document.getElementById('productDisplayPrice').innerText = opt.getAttribute('data-price');
        document.getElementById('variantSkuDisplay').innerText = opt.getAttribute('data-sku');
        document.getElementById('detailAddToCartBtn')?.setAttribute('data-selected-variant', e.target.value);

        const rawImages = container.getAttribute('data-images');
        if (rawImages && rawImages !== "[]") {
            const images = JSON.parse(rawImages);
            const matchingImgs = images.filter(img => img.variant_ids.includes(parseInt(e.target.value, 10)));
            const thumbStrip = document.getElementById('detailThumbnailsStrip');
            if (thumbStrip && matchingImgs.length) {
                thumbStrip.innerHTML = matchingImgs.map((img, idx) => `
                    <img src="${img.src}" alt="View ${idx + 1}" class="thumb-node ${idx === 0 ? 'active' : ''}" onclick="window.syncMainStageImageFromThumbnail(this)">
                `).join('');
                document.getElementById('mainStageImage').src = matchingImgs[0].src;
            }
        }
    });
    
    selectEl.dispatchEvent(new Event('change'));
}

/**
 * DYNAMIC CART VIEW GENERATOR: Prepares table item layout metrics for cart.html
 */
function renderCartPageTable() {
    const cartWrapper = document.querySelector('.cart-page-wrapper');
    if (!cartWrapper || !window.location.pathname.toLowerCase().includes('cart.html')) return;

    const itemsTarget = document.getElementById('cartItemsTargetNode');
    const summaryTarget = document.getElementById('cartSummaryStatementTargetNode');
    const cart = JSON.parse(localStorage.getItem('pixel_cart_items') || '[]');
    
    if (cart.length === 0) {
        if (itemsTarget) {
            itemsTarget.innerHTML = `
                <div class="empty-cart-view" style="padding: 2rem 0; font-family:'Quicksand', sans-serif;">
                    <h2 style="font-weight:500; color:#333; margin-bottom:1.5rem; font-size: 1.3rem;">Your cart is currently empty.</h2>
                    <a href="index.html" class="add-to-cart-action-btn" style="text-decoration:none; display:inline-block; padding:0.75rem 2rem;">Return To Shop</a>
                </div>`;
        }
        if (summaryTarget) summaryTarget.innerHTML = '';
        return;
    }

    if (itemsTarget) {
        itemsTarget.innerHTML = cart.map(item => `
            <div class="cart-item-row" style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #e1ded7; padding: 1rem 0; gap:1rem; font-family:'Quicksand', sans-serif;">
                <div style="display:flex; align-items:center; gap:1.5rem;">
                    <img src="${item.image}" alt="${item.title}" style="width:70px; height:70px; object-fit:cover; border-radius:4px; border:1px solid #e1ded7;">
                    <div>
                        <h3 style="font-weight:600; font-size:1.05rem; color:#111; margin:0 0 0.25rem 0;">${item.title}</h3>
                        <span style="color:#666; font-size:0.9rem;">${item.price}</span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:1.5rem;">
                    <div class="qty-stepper-box" style="margin:0; display:flex; align-items:center; background:#fff; border:1px solid #e1ded7; border-radius:4px;">
                        <button class="stepper-btn" onclick="updateCartItemQuantity('${item.basketSignature}', -1)" style="padding:0.4rem 0.75rem; background:none; border:none; cursor:pointer;">−</button>
                        <input type="number" class="qty-input" value="${item.quantity}" readonly style="width:25px; text-align:center; border:none; background:transparent; font-family:'Quicksand'; font-weight:600;">
                        <button class="stepper-btn" onclick="updateCartItemQuantity('${item.basketSignature}', 1)" style="padding:0.4rem 0.75rem; background:none; border:none; cursor:pointer;">+</button>
                    </div>
                    <button onclick="removeSingleCartItem('${item.basketSignature}')" style="background:none; border:none; color:#900; cursor:pointer; font-size:1.5rem; font-weight:300; padding:0 0.5rem;">&times;</button>
                </div>
            </div>
        `).join('');
    }

    if (summaryTarget) {
        let runningSubtotal = 0;
        cart.forEach(item => {
            const priceString = String(item.price || '0');
            const numericPrice = parseFloat(priceString.replace(/[^0-9.]/g, '')) || 0;
            runningSubtotal += (numericPrice * item.quantity);
        });

        summaryTarget.innerHTML = `
            <div class="totals-summary-card" style="font-family:'Quicksand', sans-serif; font-size:1rem; color:#333; display:flex; flex-direction:column; gap:0.75rem; padding: 1rem 0;">
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #e1ded7; padding-bottom:0.5rem;">
                    <span>Subtotal</span>
                    <span style="font-weight:500;">$${runningSubtotal.toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; border-bottom:1px dashed #e1ded7; padding-bottom:0.5rem;">
                    <span>Shipping</span>
                    <span style="color:#666; font-size:0.9rem;">Calculated at checkout</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-weight:700; font-size:1.15rem; color:#111; padding-top:0.25rem;">
                    <span>Total</span>
                    <span>$${runningSubtotal.toFixed(2)}</span>
                </div>
            </div>`;
    }
}

/**
 * DYNAMIC CHECKOUT VIEW GENERATOR: Strict CSS isolated layout updates
 */
function renderCheckoutSummary() {
    if (!window.location.pathname.toLowerCase().includes('checkout.html')) return;

    const cart = JSON.parse(localStorage.getItem('pixel_cart_items') || '[]');
    if (cart.length === 0) return;

    console.log("🛒 Checkout Engine: Syncing order summary breakdown strictly...");

    const asidePanel = document.querySelector('.cart-totals-section') || document.querySelector('aside');
    if (!asidePanel) return;

    const targetImg = asidePanel.querySelector('img');
    let itemsContainer = null;
    
    if (targetImg) {
        itemsContainer = targetImg.closest('div').parentElement;
    } else {
        itemsContainer = asidePanel.querySelector('.checkout-thumbnails-grid') || asidePanel.querySelector('div style*="display: flex"');
    }

    if (itemsContainer) {
        itemsContainer.innerHTML = cart.map(item => `
            <div class="checkout-item-row" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem; font-family: 'Quicksand', sans-serif; width: 100%;">
                <div style="position: relative; width: 56px; height: 56px; background: #fff; border: 1px solid #e1ded7; border-radius: 6px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                    <img src="${item.image}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 5px;">
                    <span style="position: absolute; top: -8px; right: -8px; background: #8e7a68; color: #fff; font-size: 0.7rem; font-weight: 700; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.15); z-index: 10;">${item.quantity}</span>
                </div>
                <div style="flex: 1; min-width: 0; text-align: left;">
                    <h3 style="font-size: 0.85rem; font-weight: 600; margin: 0; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'Quicksand', sans-serif;">${item.title}</h3>
                </div>
                <span style="font-size: 0.85rem; font-weight: 500; color: #111; font-family: 'Quicksand', sans-serif;">${item.price}</span>
            </div>
        `).join('');
    }

    let totalCents = 0;
    cart.forEach(item => {
        const priceString = String(item.price || '0');
        const cleanPrice = parseFloat(priceString.replace(/[^0-9.]/g, '')) || 0;
        totalCents += Math.round(cleanPrice * 100) * item.quantity;
    });
    
    const finalCalculatedAmount = (totalCents / 100).toFixed(2);

    const summaryElements = asidePanel.querySelectorAll('div, span, p, strong, td');
    summaryElements.forEach(node => {
        const innerText = node.textContent.trim();
        if (innerText === '$250.00') {
            node.innerHTML = `$${finalCalculatedAmount}`;
        }
        if (innerText === '$250.00 USD') {
            node.innerHTML = `$${finalCalculatedAmount} USD`;
        }
    });
}

/**
 * AUTOMATED STATIC CATALOG SORTING ENGINE: Reorders pre-baked HTML elements based on price metrics
 */
function initializeCatalogSorting() {
    const sortSelect = document.querySelector('.catalog-sort-select');
    const gridContainer = document.getElementById('catalogProductInjectionNode');

    if (!sortSelect || !gridContainer) return;

    console.log("⚙️ Sorting Engine: Active product collection grid detected.");

    sortSelect.addEventListener('change', function(e) {
        const sortingStrategy = e.target.value; 
        
        // 1. Convert live pre-baked category card children elements into an array list
        const productCards = Array.from(gridContainer.querySelectorAll('.product-card'));
        if (productCards.length === 0) return;

        // 2. Perform DOM extraction sort calculations
        productCards.sort((cardA, cardB) => {
            const priceTextA = cardA.querySelector('.price-current')?.textContent || '0';
            const priceTextB = cardB.querySelector('.price-current')?.textContent || '0';

            const numericPriceA = parseFloat(priceTextA.replace(/[^0-9.]/g, '')) || 0;
            const numericPriceB = parseFloat(priceTextB.replace(/[^0-9.]/g, '')) || 0;

            if (sortingStrategy === 'price-low-high') {
                return numericPriceA - numericPriceB;
            } else if (sortingStrategy === 'price-high-low') {
                return numericPriceB - numericPriceA;
            }
            return 0;
        });

        // 3. Purge grid container and mount the freshly sorted card elements directly back into view
        gridContainer.innerHTML = '';
        productCards.forEach(card => gridContainer.appendChild(card));

        console.log(`✅ Collection layout reordered using strategy: "${sortingStrategy}"`);
    });
}

/**
 * DYNAMIC DATA-DRIVEN CATEGORY BADGES: Extracts quantities safely from productsData.json object structures
 */
async function syncHomeCategoryBadges() {
    const trackingBadges = document.querySelectorAll('.category-count-badge');
    if (trackingBadges.length === 0) return;

    try {
        const response = await fetch('./productsData.json'); 
        if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
        
        const rawData = await response.json();
        
        let products = [];
        if (Array.isArray(rawData)) {
            products = rawData;
        } else if (rawData && typeof rawData === 'object') {
            products = rawData.products || rawData.items || Object.values(rawData);
        }

        if (!Array.isArray(products)) {
            throw new Error("Parsed data format is not an iterable array list.");
        }

        // DRAFT FILTER: Safely strips drafts or hidden template objects out of final counts
        const activeProducts = products.filter(p => {
            if (!p) return false;
            const status = String(p.status || p.visibility || '').toLowerCase();
            return status !== 'draft' && status !== 'hidden' && status !== 'inactive';
        });

        trackingBadges.forEach(badge => {
            const catType = badge.getAttribute('data-category');
            let tallyCount = 0;

            if (catType === 'sculpture') {
                tallyCount = activeProducts.filter(p => p.category?.toLowerCase() === 'sculptures' || p.category?.toLowerCase() === 'sculpture').length;
            } else if (catType === 'digital-downloads') {
                tallyCount = activeProducts.filter(p => p.category?.toLowerCase().includes('digital') || p.category?.toLowerCase().includes('download')).length;
            } else if (catType === 'wall-art') {
                tallyCount = activeProducts.filter(p => p.category?.toLowerCase().includes('wall') || p.category?.toLowerCase() === 'canvas' || p.category?.toLowerCase() === 'wall art').length;
            }

            badge.innerText = `${tallyCount} Item${tallyCount !== 1 ? 's' : ''}`;
        });

        console.log("✅ Category lookbook badges synchronized perfectly with active data items.");

    } catch (error) {
        console.warn("❌ Category Badge Parser Lifecycle Interrupted:", error.message);
    }
}

/**
 * HEADER CORE COMPILER BADGES
 */
function initializeCartWidgetState() {
    const cart = JSON.parse(localStorage.getItem('pixel_cart_items') || '[]');
    let totalItems = 0, totalPrice = 0;

    cart.forEach(item => {
        totalItems += item.quantity;
        
        const priceString = String(item.price || '0');
        const numericPrice = parseFloat(priceString.replace(/[^0-9.]/g, '')) || 0;
        
        totalPrice += numericPrice * item.quantity;
    });

    document.querySelectorAll('.cart-count').forEach(n => n.innerText = `${totalItems} item${totalItems !== 1 ? 's' : ''}`);
    document.querySelectorAll('.cart-total').forEach(n => n.innerText = `$${totalPrice.toFixed(2)}`);
}

function executeAddToCartSequence(productId, quantity, variantId) {
    const cart = JSON.parse(localStorage.getItem('pixel_cart_items') || '[]');
    const detailContainer = document.getElementById('productDetailContainer');
    
    let titleText = "Pixel Art Piece";
    let priceText = "$42.23";
    let imageSrc = "/images/placeholder.jpg";

    if (detailContainer && detailContainer.getAttribute('data-product-id') === productId) {
        titleText = document.querySelector('.p-title')?.innerText || titleText;
        priceText = document.getElementById('productDisplayPrice')?.innerText || priceText;
        imageSrc = document.getElementById('mainStageImage')?.src || imageSrc;
    } else {
        const activeCard = document.querySelector(`.add-to-cart-btn[data-id="${productId}"]`)?.closest('.product-card');
        if (activeCard) {
            titleText = activeCard.querySelector('.product-title')?.innerText || titleText;
            priceText = activeCard.querySelector('.price-current')?.innerText || priceText;
            imageSrc = activeCard.querySelector('.product-img')?.src || imageSrc;
        }
    }

    const sig = variantId ? `${productId}_${variantId}` : productId;
    const existingIndex = cart.findIndex(item => item.basketSignature === sig);

    if (existingIndex > -1) {
        cart[existingIndex].quantity += quantity;
    } else {
        cart.push({
            basketSignature: sig,
            id: productId,
            variantId: variantId,
            title: titleText.trim(),
            price: priceText.trim(),
            image: imageSrc,
            quantity: quantity
        });
    }

    localStorage.setItem('pixel_cart_items', JSON.stringify(cart));
    initializeCartWidgetState();
    renderCartPageTable();
}