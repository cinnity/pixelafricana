/**
 * Pixel Africana - Unified Store Engine & Hybrid Asset Router
 * Manages global cart state arrays, local storage configurations, 
 * asset path resolution handlers, and multi-fulfillment checkout tunnels.
 */

// =========================================================================
// 1. GLOBAL STATE & PATH RESOLUTION UTILITIES
// =========================================================================
let shoppingCartState = JSON.parse(localStorage.getItem('pixel_cart_items')) || [];
let inventoryMasterDataset = [];

/**
 * Universal Path Correction Utility
 * Resolves local image paths dynamically while allowing full external 
 * Printify CDN URLs to pass through untouched.
 */
function resolveAbsoluteImagePath(imgSrc) {
    if (!imgSrc) return '/images/placeholder.jpg';

    // Pass external Printify CDN routes through cleanly
    if (imgSrc.startsWith('http://') || imgSrc.startsWith('https://')) {
        return imgSrc;
    }

    let path = imgSrc;

    // Clean up leading dots and relative slash artifacts
    if (path.startsWith('./')) path = path.slice(2);
    if (path.startsWith('/')) path = path.slice(1);

    // Normalize legacy singular folder typos automatically
    if (path.startsWith('images/sculpture/')) {
        path = path.replace('images/sculpture/', 'images/sculptures/');
    }

    // Pass deep local structured paths right through safely
    if (path.startsWith('images/sculptures/') && path.split('/').length >= 4) {
        return '/' + path;
    }

    // Dynamic extraction of subfolder prefix names
    const filename = path.split('/').pop();
    const lowercaseFile = filename.toLowerCase();
    let targetSubfolder = lowercaseFile.split('_')[0].split('.')[0];

    // Orthographic fallback mapping rule for your singular spelling outlier
    if (targetSubfolder === 'ronke') {
        targetSubfolder = 'ronkeh';
    }

    if (targetSubfolder) {
        return `/images/sculptures/${targetSubfolder}/${filename}`;
    }

    return `/images/sculptures/${filename}`;
}

// =========================================================================
// 2. UNIFIED INITIALIZATION BOOTSTRAPPER
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    updateGlobalHeaderCartWidgets();

    const currentPath = window.location.pathname.toLowerCase();

    // Route 1: Product Detail Screen Controller
    if (currentPath.includes('product-detail') || document.getElementById('productDetailContainer')) {
        initializeProductDetailEngine();
        return;
    }

    // Route 2: Shopping Cart Display Hub
    if (currentPath.includes('cart.html') || document.getElementById('cartItemsTargetNode')) {
        renderActiveCartPageDisplay();
        return;
    }

    // Route 3: Checkout Processing Pipeline
    if (document.getElementById('checkoutForm')) {
        renderActiveCheckoutSummaryDisplay();
        setupCheckoutFormSubmission();
        return;
    }

    // Route 4: Index Homepage Metric Badges
    if (document.querySelector('.category-count-badge')) {
        calculateDynamicHomepageCounters();
    }

    // Route 5: Live Category Catalog Grid Loader
    if (document.getElementById('catalogProductInjectionNode')) {
        const urlParams = new URLSearchParams(window.location.search);
        const currentCategoryScope = urlParams.get('type') || 'sculpture';
        initializeCatalogProductDeck(currentCategoryScope);
    }

    // Route 6: QR Landing Poetry Verse Interfaces
    if (currentPath.includes('sculpture.html') || document.getElementById('sculpturePoeticProfileInjectionNode')) {
        initializePoeticProfileEngine();
        return;
    }
});

// =========================================================================
// 3. UNIVERSAL LOCAL STORAGE CONTROLLERS
// =========================================================================
function addItemToCart(productId, productTitle, productPrice, productImage, fulfillmentChannel = "in-house") {
    const existingItem = shoppingCartState.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        const numericPrice = parseFloat(productPrice.replace(/[^0-9.]/g, ''));
        shoppingCartState.push({
            id: productId,
            title: productTitle,
            price: numericPrice,
            image: productImage,
            quantity: 1,
            fulfillmentChannel: fulfillmentChannel // Save tracking tag into LocalStorage strings
        });
    }
    syncCartToStorage();
}

window.removeProductFromCart = function (productId) {
    shoppingCartState = shoppingCartState.filter(item => item.id !== productId);
    syncCartToStorage();
    if (document.getElementById('cartItemsTargetNode')) renderActiveCartPageDisplay();
};

window.updateProductQuantity = function (productId, newQuantity) {
    const targetItem = shoppingCartState.find(item => item.id === productId);
    if (!targetItem) return;

    targetItem.quantity = parseInt(newQuantity);
    if (targetItem.quantity <= 0) {
        window.removeProductFromCart(productId);
        return;
    }
    syncCartToStorage();
    if (document.getElementById('cartItemsTargetNode')) renderActiveCartPageDisplay();
};

function syncCartToStorage() {
    localStorage.setItem('pixel_cart_items', JSON.stringify(shoppingCartState));
    updateGlobalHeaderCartWidgets();
}

function updateGlobalHeaderCartWidgets() {
    const totalNode = document.querySelector('.cart-total');
    const countNode = document.querySelector('.cart-count');
    if (!totalNode || !countNode) return;

    let totalAccumulator = 0;
    let itemsAccumulator = 0;

    shoppingCartState.forEach(item => {
        totalAccumulator += (item.price * item.quantity);
        itemsAccumulator += item.quantity;
    });

    totalNode.innerText = `$${totalAccumulator.toFixed(2)}`;
    countNode.innerText = `${itemsAccumulator} item${itemsAccumulator === 1 ? '' : 's'}`;
}

// =========================================================================
// 4. CATALOG GRID TEMPLATE RENDERING
// =========================================================================
function initializeCatalogProductDeck(categoryScope) {
    fetch('productsData.json')
        .then(response => response.json())
        .then(data => {
            inventoryMasterDataset = data.products.filter(
                p => p.category && p.category.toLowerCase() === categoryScope.toLowerCase() && p.status === "active"
            );

            const formattedCategoryName = categoryScope.charAt(0).toUpperCase() + categoryScope.slice(1);
            document.title = `Pixel Africana - Premium ${formattedCategoryName} Collection`;

            const pageTitleNode = document.getElementById('catalogPageTitle');
            const breadcrumbNode = document.getElementById('catalogBreadcrumbTitle');

            if (pageTitleNode) pageTitleNode.innerText = `${categoryScope} Collection`;
            if (breadcrumbNode) breadcrumbNode.innerText = `${categoryScope} Collection`;

            renderProductCatalogGrid(inventoryMasterDataset);
            setupCatalogEventListeners();
        })
        .catch(err => console.error("Error executing dynamic grid:", err));
}

function renderProductCatalogGrid(productsList) {
    const containerGrid = document.getElementById('catalogProductInjectionNode');
    const counterString = document.getElementById('catalogResultsCount');
    if (!containerGrid || !counterString) return;

    containerGrid.innerHTML = "";
    counterString.innerText = `Showing all ${productsList.length} results`;

    productsList.forEach(item => {
        const channel = item.fulfillmentChannel || "in-house";
        const cardHTML = `
            <article class="product-card" data-fulfillment="${channel}">
                <div class="product-image-wrapper">
                    <a href="product-detail-${item.id.toLowerCase()}.html">
                        <img src="${resolveAbsoluteImagePath(item.image)}" alt="${item.altText}" class="product-img">
                    </a>
                </div>
                <div class="product-details">
                    <h2 class="product-title">
                        <a href="product-detail-${item.id.toLowerCase()}.html" style="text-decoration:none; color:inherit;">${item.title}</a>
                    </h2>
                    <div class="badge-row">${item.onSale ? '<span class="sale-badge">SALE!</span>' : ''}</div>
                    <div class="price-row">
                        ${item.onSale ? `<span class="price-original">${item.priceOriginal}</span>` : ''}
                        <span class="price-current">${item.priceCurrent}</span>
                    </div>
                    <button class="add-to-cart-btn" data-id="${item.id}">Add to cart</button>
                </div>
            </article>
        `;
        containerGrid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

function setupCatalogEventListeners() {
    const selectorNode = document.getElementById('sortEngineSelector');
    if (selectorNode) {
        selectorNode.addEventListener('change', (e) => {
            let manipulatedList = [...inventoryMasterDataset];
            const parseNumericPriceValue = (str) => parseFloat(str.replace(/[^0-9.]/g, ''));

            if (e.target.value === "price-low") {
                manipulatedList.sort((a, b) => parseNumericPriceValue(a.priceCurrent) - parseNumericPriceValue(b.priceCurrent));
            } else if (e.target.value === "price-high") {
                manipulatedList.sort((a, b) => parseNumericPriceValue(b.priceCurrent) - parseNumericPriceValue(a.priceCurrent));
            }
            renderProductCatalogGrid(manipulatedList);
        });
    }

    const injectionNode = document.getElementById('catalogProductInjectionNode');
    if (injectionNode) {
        injectionNode.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-to-cart-btn')) {
                const id = e.target.getAttribute('data-id');
                const card = e.target.closest('.product-card');
                const channel = card ? card.getAttribute('data-fulfillment') : "in-house";

                const match = inventoryMasterDataset.find(p => p.id === id);
                if (match) {
                    addItemToCart(match.id, match.title, match.priceCurrent, match.image, channel);
                    alert(`"${match.title}" added to your cart.`);
                }
            }
        });
    }
}

// =========================================================================
// 5. SHOPPING CART PAGE SYSTEM MODEL
// =========================================================================
function renderActiveCartPageDisplay() {
    const listContainer = document.getElementById('cartItemsTargetNode');
    const summaryContainer = document.getElementById('cartSummaryStatementTargetNode');
    const mainSplitGrid = document.getElementById('cartLayoutSplitGridContainer');
    if (!listContainer || !summaryContainer || !mainSplitGrid) return;

    if (shoppingCartState.length === 0) {
        mainSplitGrid.innerHTML = `
            <div style="padding: 60px 20px; text-align: center; grid-column: 1/-1;">
                <p style="color: #666; font-size: 1.15rem; margin-bottom: 20px;">Your cart is empty.</p>
                <a href="index.html" class="return-to-shop-btn">Return to shop</a>
            </div>`;
        return;
    }

    let listHTML = `<div class="table-header-row"><span class="col-lbl-product">PRODUCT</span><span class="col-lbl-total">TOTAL</span></div>`;
    let computedSubtotal = 0;

    shoppingCartState.forEach(item => {
        const rowTotal = item.price * item.quantity;
        computedSubtotal += rowTotal;

        listHTML += `
            <div class="cart-item-row" data-fulfillment="${item.fulfillmentChannel || 'in-house'}">
                <div class="product-meta-block">
                    <img src="${resolveAbsoluteImagePath(item.image)}" alt="${item.title}" class="cart-item-thumb">
                    <div class="product-identity-details">
                        <a href="product-detail-${item.id.toLowerCase()}.html" class="item-title-link">${item.title}</a>
                        <div class="item-pricing-stack"><span class="item-sale-price">$${item.price.toFixed(2)}</span></div>
                        <div class="qty-stepper-box">
                            <button class="stepper-btn" onclick="window.updateProductQuantity('${item.id}', ${item.quantity - 1})">−</button>
                            <input type="number" class="qty-input" value="${item.quantity}" min="1" onchange="window.updateProductQuantity('${item.id}', this.value)">
                            <button class="stepper-btn" onclick="window.updateProductQuantity('${item.id}', ${item.quantity + 1})">+</button>
                        </div>
                        <button class="remove-item-trigger" onclick="window.removeProductFromCart('${item.id}')">Remove item</button>
                    </div>
                </div>
                <div class="product-total-block"><span class="line-item-total">$${rowTotal.toFixed(2)}</span></div>
            </div>`;
    });

    listContainer.innerHTML = listHTML;
    summaryContainer.innerHTML = `
        <div class="statement-row metrics-row"><span class="metric-label">Subtotal</span><span class="metric-value font-highlight">$${computedSubtotal.toFixed(2)}</span></div>
        <div class="statement-row metrics-row adjustment-row"><span class="metric-label">Shipping</span><span class="metric-value text-right"><a href="#" class="inline-action-link">Calculated at checkout</a></span></div>
        <div class="statement-row grand-total-row"><span class="total-label">Total</span><span class="total-value">$${computedSubtotal.toFixed(2)} <span class="currency-code">USD</span></span></div>`;
}

// ==========================================
// 6. CHECKOUT PIPELINE HANDLERS
// ==========================================
function renderActiveCheckoutSummaryDisplay() {
    const accordionNode = document.querySelector('.summary-accordion-item.open .accordion-content');
    const metricsNode = document.querySelector('.summary-metrics-table');
    if (!accordionNode || !metricsNode) return;

    if (shoppingCartState.length === 0) {
        alert("Your shopping cart is currently empty. Redirecting back to store inventory.");
        window.location.href = "index.html";
        return;
    }

    let itemsHTML = "";
    let computedSubtotal = 0;

    shoppingCartState.forEach(item => {
        const rowTotal = item.price * item.quantity;
        computedSubtotal += rowTotal;

        itemsHTML += `
            <div class="summary-product-item" style="margin-bottom: 16px;" data-fulfillment="${item.fulfillmentChannel || 'in-house'}">
                <div class="thumb-badge-wrap">
                    <img src="${resolveAbsoluteImagePath(item.image)}" alt="${item.title}" class="item-thumb">
                    <span class="qty-badge">${item.quantity}</span>
                </div>
                <div class="item-meta">
                    <span class="item-name">${item.title}</span>
                    <div class="item-prices"><span class="current">$${item.price.toFixed(2)}</span></div>
                </div>
                <span class="item-row-total">$${rowTotal.toFixed(2)}</span>
            </div>`;
    });

    accordionNode.innerHTML = itemsHTML;
    metricsNode.innerHTML = `
        <div class="metric-line"><span>Subtotal</span><span class="value font-weight-600">$${computedSubtotal.toFixed(2)}</span></div>
        <div class="metric-line"><span>Shipping</span><span class="value italic-muted">Calculated securely via Stripe</span></div>
        <div class="metric-line total-line"><span>Total</span><span class="value">$${computedSubtotal.toFixed(2)} <small>USD</small></span></div>`;
}

function setupCheckoutFormSubmission() {
    const formNode = document.getElementById('checkoutForm');
    if (!formNode) return;

    formNode.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = formNode.querySelector('.place-order-btn');
        submitBtn.innerText = "Processing Transaction...";
        submitBtn.disabled = true;

        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cartItems: shoppingCartState })
            });

            const sessionData = await response.json();

            if (sessionData.url) {
                localStorage.removeItem('pixel_cart_items');
                window.location.href = sessionData.url;
            } else {
                throw new Error(sessionData.error || "Failed to initialize Stripe engine.");
            }
        } catch (err) {
            alert(`Checkout Error: ${err.message}`);
            submitBtn.innerText = "Place Order";
            submitBtn.disabled = false;
        }
    });
}

// ==========================================
// 7. PRODUCT DETAIL SCREEN VIEW BINDINGS
// ==========================================
function initializeProductDetailEngine() {
    const container = document.getElementById('productDetailContainer');
    if (!container) return;

    const productId = container.getAttribute('data-product-id');
    const channel = container.getAttribute('data-fulfillment') || "in-house";

    // Wire up events straight onto pre-rendered DOM structures
    bindProductDetailActions(productId, channel);
    bindPoemOverlayInteractions();
}

function bindProductDetailActions(productId, channel) {
    const addBtn = document.getElementById('detailAddToCartBtn');

    // Main Stage Click Switcher (Video vs Image Aware)
    window.syncMainStageImageFromThumbnail = function (thumbElement) {
        const currentStageMedia = document.getElementById('mainStageImage');
        if (!currentStageMedia || !thumbElement) return;

        const targetSrc = thumbElement.getAttribute('src');
        const isVideo = targetSrc.toLowerCase().endsWith('.mp4');

        if (isVideo) {
            const videoNode = document.createElement('video');
            videoNode.id = 'mainStageImage';
            videoNode.className = 'stage-img video-stage-asset';
            videoNode.src = targetSrc;
            videoNode.autoplay = true;
            videoNode.loop = true;
            videoNode.muted = true;
            videoNode.playsInline = true;
            videoNode.setAttribute('preload', 'auto');
            currentStageMedia.replaceWith(videoNode);
        } else {
            if (currentStageMedia.tagName === 'VIDEO') {
                const imgNode = document.createElement('img');
                imgNode.id = 'mainStageImage';
                imgNode.className = 'stage-img';
                imgNode.src = targetSrc;
                currentStageMedia.replaceWith(imgNode);
            } else {
                currentStageMedia.setAttribute('src', targetSrc);
            }
        }

        document.querySelectorAll('.thumb-node').forEach(t => t.classList.remove('active'));
        thumbElement.classList.add('active');
    };

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const qtyInput = document.getElementById('detailQtyInput');
            const qty = qtyInput ? parseInt(qtyInput.value) : 1;

            const priceElement = document.getElementById('productDisplayPrice');
            const priceText = priceElement ? priceElement.innerText : "$0.00";

            const stageImg = document.getElementById('mainStageImage');
            const imgSrc = stageImg ? new URL(stageImg.src).pathname : "";

            const titleElement = document.querySelector('.p-title');
            const productTitle = titleElement ? titleElement.innerText : "Premium Piece";

            for (let i = 0; i < qty; i++) {
                addItemToCart(productId, productTitle, priceText, imgSrc, channel);
            }
            alert(`Added (${qty}) "${productTitle}" item${qty === 1 ? '' : 's'} to your shopping cart.`);
        });
    }
}

window.adjustLocalQuantityInput = function (amount) {
    const input = document.getElementById('detailQtyInput');
    if (!input) return;
    let val = parseInt(input.value) + amount;
    if (val < 1) val = 1;
    input.value = val;
};

function bindPoemOverlayInteractions() {
    const openBtn = document.getElementById('openPoemTrigger');
    const closeBtn = document.getElementById('closePoemTrigger');
    const sheetOverlay = document.getElementById('poemOverlaySheet');

    if (!openBtn || !closeBtn || !sheetOverlay) return;

    openBtn.addEventListener('click', () => {
        sheetOverlay.classList.add('active');
    });

    closeBtn.addEventListener('click', () => {
        sheetOverlay.classList.remove('active');
    });
}

// ==========================================
// 8. HOMEPAGE FALLBACK COUNTERS
// ==========================================
function calculateDynamicHomepageCounters() {
    const badgeNodes = document.querySelectorAll('.category-count-badge');
    if (badgeNodes.length === 0) return;

    fetch('productsData.json')
        .then(response => response.json())
        .then(data => {
            badgeNodes.forEach(badge => {
                const targetCategory = badge.getAttribute('data-category') || "sculpture";
                const matchingItems = data.products.filter(
                    product => product.category && product.category.toLowerCase() === targetCategory.toLowerCase() && product.status === "active"
                );
                badge.innerText = `${matchingItems.length} item${matchingItems.length === 1 ? '' : 's'}`;
            });
        })
        .catch(err => console.log("Static HTML pre-rendering active. Skipping runtime counter fallback loops."));
}

// ==========================================
// 9. POETIC PROFILE ROUTE LOADER
// ==========================================
function initializePoeticProfileEngine() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetSculptureId = urlParams.get('id');
    if (!targetSculptureId) return;

    fetch('productsData.json')
        .then(response => response.json())
        .then(data => {
            const sculptureMatch = data.products.find(p => p.id.toLowerCase() === targetSculptureId.toLowerCase());
            if (sculptureMatch) buildPoeticProfileHTML(sculptureMatch);
        });
}

function buildPoeticProfileHTML(sculpture) {
    const targetNode = document.getElementById('sculpturePoeticProfileInjectionNode');
    if (!targetNode) return;

    let dynamicPoemLinesHTML = (sculpture.poem || []).map(line => {
        if (line.trim() === "") {
            return `<div class="poem-stanza-break" style="height: 1.5rem;"></div>`;
        }
        return `<p class="poem-stanza-line" style="margin: 0 0 4px 0;">${line}</p>`;
    }).join('');

    targetNode.innerHTML = `
        <div class="sculpture-img-wrapper">
            <img class="sculptureImg" src="${resolveAbsoluteImagePath(sculpture.profileImage)}" alt="${sculpture.title}">
        </div>
        <h1 class="sculpture-title">${sculpture.title}</h1>
        <div class="sculpture-meta">${sculpture.category}</div>
        <div class="divider"></div>
        <div class="poem-content">${dynamicPoemLinesHTML}</div>
    `;
}
