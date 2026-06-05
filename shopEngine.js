/**
 * Pixel Africana - Unified Store Engine (Fixed Client-Side Asset Resolution)
 * Manages global state arrays, local storage configurations, 
 * path resolution handlers, and page-specific layout render loops.
 */

// ==========================================
// 1. GLOBAL STATE & PATH RESOLUTION UTILITIES
// ==========================================
let shoppingCartState = JSON.parse(localStorage.getItem('pixel_cart_items')) || [];
let inventoryMasterDataset = [];

/**
 * Universal Path Correction Utility (DYNAMIC VERSION)
 * Eliminates all hardcoded names. Automatically extracts the correct 
 * subfolder directory right out of the filename prefix.
 */
function resolveAbsoluteImagePath(imgSrc) {
    if (!imgSrc) return '/images/placeholder.jpg';

    let path = imgSrc;

    // 1. Clean up leading dots and relative slash artifacts
    if (path.startsWith('./')) path = path.slice(2);
    if (path.startsWith('/')) path = path.slice(1);

    // 2. Normalize legacy singular folder typos automatically
    if (path.startsWith('images/sculpture/')) {
        path = path.replace('images/sculpture/', 'images/sculptures/');
    }

    // 3. If it's already a full, complete path, just pass it through safely
    if (path.startsWith('images/sculptures/') && path.split('/').length >= 4) {
        return '/' + path;
    }

    // 4. DYNAMIC RESOLVER: Grab the filename (e.g., "kesha_front_1.png")
    const filename = path.split('/').pop();
    const lowercaseFile = filename.toLowerCase();

    // Dynamically grab everything before the first underscore as the folder name!
    // "kesha_front_1.png" -> split('_') -> ["kesha", "front", "1.png"] -> [0] is "kesha"
    let targetSubfolder = lowercaseFile.split('_')[0].split('.')[0];

    // Quick fallback mapping rule for your singular spelling outlier: Ronke vs Ronkeh
    if (targetSubfolder === 'ronke') {
        targetSubfolder = 'ronkeh';
    }

    // 5. Build and return the absolute path dynamically
    if (targetSubfolder) {
        return `/images/sculptures/${targetSubfolder}/${filename}`;
    }

    // Ultimate safety baseline fallback
    return `/images/sculptures/${filename}`;
}// Unified Initialization Bootstrapper
document.addEventListener("DOMContentLoaded", () => {
    updateGlobalHeaderCartWidgets();

    const currentPath = window.location.pathname.toLowerCase();

    // 1. ROUTE CHECK: Product Detail View
    if (currentPath.includes('product-detail.html') || document.getElementById('productDetailContainer')) {
        initializeProductDetailEngine();
        return;
    }

    // 2. ROUTE CHECK: Shopping Cart Display Manager
    if (currentPath.includes('cart.html') || document.getElementById('cartItemsTargetNode')) {
        renderActiveCartPageDisplay();
        return;
    }

    // 3. ROUTE CHECK: Checkout Pipeline Terminal
    if (document.getElementById('checkoutForm')) {
        renderActiveCheckoutSummaryDisplay();
        setupCheckoutFormSubmission();
        return;
    }

    // 4. MULTI-ROUTE CHECK FOR INDEX & CATEGORY COMPATIBILITY
    if (document.querySelector('.category-count-badge')) {
        calculateDynamicHomepageCounters();
    }

    if (document.getElementById('catalogProductInjectionNode')) {
        const urlParams = new URLSearchParams(window.location.search);
        const currentCategoryScope = urlParams.get('type') || 'sculpture';
        initializeCatalogProductDeck(currentCategoryScope);
    }
});

// ==========================================
// 2. UNIVERSAL LOCAL STORAGE CONTROLLERS
// ==========================================
function addItemToCart(productId, productTitle, productPrice, productImage) {
    const existingItem = shoppingCartState.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        const numericPrice = parseFloat(productPrice.replace(/[^0-9.]/g, ''));
        shoppingCartState.push({
            id: productId,
            title: productTitle,
            price: numericPrice,
            image: productImage, // Store raw path; resolver dynamically builds deep absolute routes on render
            quantity: 1
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

// ==========================================
// 3. CATALOG GRID & TEMPLATE RENDERING
// ==========================================
function initializeCatalogProductDeck(categoryScope) {
    fetch('productsData.json')
        .then(response => response.json())
        .then(data => {
            inventoryMasterDataset = data.products.filter(
                p => p.category && p.category.toLowerCase() === categoryScope.toLowerCase()
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
        .catch(err => {
            console.error("Error running client-side dynamic template:", err);
        });
}

function renderProductCatalogGrid(productsList) {
    const containerGrid = document.getElementById('catalogProductInjectionNode');
    const counterString = document.getElementById('catalogResultsCount');
    if (!containerGrid || !counterString) return;

    containerGrid.innerHTML = "";
    counterString.innerText = `Showing all ${productsList.length} results`;

    productsList.forEach(item => {
        const cardHTML = `
            <article class="product-card">
                <div class="product-image-wrapper">
                    <a href="product-detail.html?id=${item.id}">
                        <img src="${resolveAbsoluteImagePath(item.image)}" alt="${item.altText}" class="product-img">
                    </a>
                </div>
                <div class="product-details">
                    <h2 class="product-title">
                        <a href="product-detail.html?id=${item.id}" style="text-decoration:none; color:inherit;">${item.title}</a>
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
                const match = inventoryMasterDataset.find(p => p.id === id);
                if (match) {
                    addItemToCart(match.id, match.title, match.priceCurrent, match.image);
                    alert(`"${match.title}" added to your cart.`);
                }
            }
        });
    }
}

// ==========================================
// 4. CART DISPLAY MODELLING WORKSPACE
// ==========================================
function renderActiveCartPageDisplay() {
    const listContainer = document.getElementById('cartItemsTargetNode');
    const summaryContainer = document.getElementById('cartSummaryStatementTargetNode');
    const mainSplitGrid = document.getElementById('cartLayoutSplitGridContainer');
    if (!listContainer || !summaryContainer || !mainSplitGrid) return;

    if (shoppingCartState.length === 0) {
        mainSplitGrid.innerHTML = `
            <div style="padding: 60px 20px; text-align: center; grid-column: 1/-1;">
                <p style="color: #666; font-size: 1.15rem; margin-bottom: 20px;">Your cart is empty.</p>
                <a href="index.html" style="display: inline-block; background-color: #2e2e2e; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 4px;">Return to shop</a>
            </div>`;
        return;
    }

    let listHTML = `<div class="table-header-row"><span class="col-lbl-product">PRODUCT</span><span class="col-lbl-total">TOTAL</span></div>`;
    let computedSubtotal = 0;

    shoppingCartState.forEach(item => {
        const rowTotal = item.price * item.quantity;
        computedSubtotal += rowTotal;

        listHTML += `
            <div class="cart-item-row">
                <div class="product-meta-block">
                    <img src="${resolveAbsoluteImagePath(item.image)}" alt="${item.title}" class="cart-item-thumb">
                    <div class="product-identity-details">
                        <a href="product-detail.html?id=${item.id}" class="item-title-link">${item.title}</a>
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
        <div class="statement-row metrics-row adjustment-row"><span class="metric-label">Shipping</span><span class="metric-value text-right"><a href="#" class="inline-action-link">Add address for options</a></span></div>
        <div class="statement-row grand-total-row"><span class="total-label">Total</span><span class="total-value">$${computedSubtotal.toFixed(2)} <span class="currency-code">USD</span></span></div>`;
}

// ==========================================
// 5. CHECKOUT SECURE RUNTIME PIPELINES
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
            <div class="summary-product-item" style="margin-bottom: 16px;">
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
        <div class="metric-line"><span>Shipping</span><span class="value italic-muted">No shipping options available</span></div>
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
// 6. PRODUCT DETAIL VIEW DYNAMIC ENGINES
// ==========================================
function initializeProductDetailEngine() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetProductId = urlParams.get('id');
    if (!targetProductId) return;

    fetch('productsData.json')
        .then(response => response.json())
        .then(data => {
            const productMatch = data.products.find(p => p.id.toLowerCase() === targetProductId.toLowerCase());

            if (!productMatch) {
                const detailContainer = document.getElementById('productDetailContainer');
                if (detailContainer) {
                    detailContainer.innerHTML = `<p style="grid-column: 1/-1; text-align:center; padding: 50px 0; color:#666;">Product not found. <a href="index.html">Return to Home.</a></p>`;
                }
                return;
            }

            const categoryLinkNode = document.getElementById('breadcrumbCategoryLink');
            const currentProductNode = document.getElementById('breadcrumbCurrentNode');

            if (categoryLinkNode) {
                categoryLinkNode.href = `category.html?type=${productMatch.category}`;
                categoryLinkNode.innerText = `${productMatch.category}`;
            }
            if (currentProductNode) {
                currentProductNode.innerText = productMatch.title;
            }

            buildProductDetailHTML(productMatch);
        })
        .catch(err => console.error("Error running detail engine safety pipeline:", err));
}

function buildProductDetailHTML(product) {
    const container = document.getElementById('productDetailContainer');
    if (!container) return;

    container.setAttribute('data-product-id', product.id);

    let galleryThumbsHTML = "";
    if (product.gallery && product.gallery.length > 0) {
        product.gallery.forEach((imgSrc, index) => {
            const absoluteSrc = resolveAbsoluteImagePath(imgSrc);
            // FIXED: Class named 'thumb-node', active state is 'active', click bindings synced
            galleryThumbsHTML += `<img src="${absoluteSrc}" alt="${product.title} view ${index + 1}" class="thumb-node ${index === 0 ? 'active' : ''}" onclick="window.syncMainStageImageFromThumbnail(this)">`;
        });
    } else {
        const absoluteDefaultSrc = resolveAbsoluteImagePath(product.image);
        galleryThumbsHTML = `<img src="${absoluteDefaultSrc}" class="thumb-node active" onclick="window.syncMainStageImageFromThumbnail(this)">`;
    }
    let poemLinesHTML = "";
    if (product.poem && product.poem.length > 0) {
        product.poem.forEach(line => {
            poemLinesHTML += `<p class="poem-stanza-line">${line}</p>`;
        });
    } else {
        poemLinesHTML = `<p class="poem-stanza-line">Premiuum cultural art token documentation.</p>`;
    }

    container.innerHTML = `
        <div class="product-gallery-column">
            <div class="main-stage-image-wrap">
                <button class="stage-nav-arrow left-arrow" id="prevStageImageBtn" aria-label="Previous image">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>

                <img src="${resolveAbsoluteImagePath(product.image)}" alt="${product.title}" id="mainStageImage" class="stage-img">
                
                <button class="stage-nav-arrow right-arrow" id="nextStageImageBtn" aria-label="Next image">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>

                <button class="zoom-overlay-trigger" aria-label="Zoom view">
                    <svg viewBox="0 0 24 24" class="action-vector-icon">
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                </button>

                <button class="poem-overlay-trigger" id="openPoemTrigger" aria-label="Read piece profile">
                    <svg viewBox="0 0 24 24" class="action-vector-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 9V7a2 2 0 0 1 2-2h2M15 5h2a2 2 0 0 1 2 2v2M5 15v2a2 2 0 0 0 2 2h2M15 19h2a2 2 0 0 0 2-2v-2" />
                        <path d="M9 9h6M9 12h6M9 15h4" />
                    </svg>
                </button>

                <button id="customizeSculptureBtn" class="customize-overlay-trigger customize-btn-circle" data-tooltip="Request Bespoke Variation" aria-label="Request Bespoke Variation">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles inline-icon">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z"/>
                        <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5Z"/>
                        <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z"/>
                    </svg>
                </button>

                <div class="art-poem-overlay-sheet" id="poemOverlaySheet">
                    <button class="poem-close-btn" id="closePoemTrigger" aria-label="Close sheet">&times;</button>
                    <div class="poem-text-content">
                        <h3>${product.title}</h3>
                        ${poemLinesHTML}
                    </div>
                </div>
            </div>
            <div class="gallery-thumbnails-strip">${galleryThumbsHTML}</div>
        </div>

        <div class="product-purchase-column">
            <h1 class="p-title">${product.title}</h1>
            <div class="p-reviews-row"><span class="stars-gold">★★★★★</span><span class="reviews-count">(0 customer reviews)</span></div>
            <div class="p-technical-ledger">
                <div class="ledger-line"><span class="lbl">SKU:</span> <span class="val">N/A</span></div>
                <div class="ledger-line"><span class="lbl">Category:</span> <span class="val"><a href="category.html?type=${product.category}" style="text-transform: capitalize;">${product.category}</a></span></div>
                <div class="ledger-line"><span class="lbl">Tag:</span> <span class="val">Premium</span></div>
            </div>
            <div class="p-price-display" id="productDisplayPrice">${product.priceCurrent}</div>
            <div class="model-spec-badge-card">
                <span class="ref-code">REF 0652/168/800</span>
                <p class="spec-text">Standard Premium cultural pieces.</p>
            </div>
            <div class="purchase-actions-row">
                <div class="qty-stepper-box">
                    <button class="stepper-btn" onclick="window.adjustLocalQuantityInput(-1)">−</button>
                    <input type="number" id="detailQtyInput" class="qty-input" value="1" min="1" aria-label="Quantity">
                    <button class="stepper-btn" onclick="window.adjustLocalQuantityInput(1)">+</button>
                </div>
                <button class="add-to-cart-action-btn" id="detailAddToCartBtn">Add To Cart</button>
            </div>
        </div>`;

    bindProductDetailActions(product);
    bindPoemOverlayInteractions();
}
/**
 * Binds Add-To-Cart actions on the dynamic product details sheet template panel
 */
/**
 * Action Interfaces & Event Closure Controllers
 * FIXED: Passed 'product' into parameters to eliminate the ReferenceError,
 * and normalized the guard clause to ensure chevron bindings run flawlessly.
 */
function bindProductDetailActions(product) { // <--- FIXED: Added product parameter
    const addBtn = document.getElementById('detailAddToCartBtn');

    // =========================================================================
    // GLOBAL THUMBNAIL CLICK SWITCHER (VIDEO & MP4 AWARE)
    // =========================================================================
    window.syncMainStageImageFromThumbnail = function (thumbElement) {
        const currentStageMedia = document.getElementById('mainStageImage');
        if (!currentStageMedia || !thumbElement) return;

        const targetSrc = thumbElement.getAttribute('src');
        const isVideo = targetSrc.toLowerCase().endsWith('.mp4');

        if (isVideo) {
            // 1. If thumbnail is an MP4, construct a hardware-accelerated looping Video Player
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
            videoNode.play().catch(err => console.log("Autoplay context initialization blocked:", err));
        } else {
            // 2. If thumbnail is a standard image, revert back to an <img> element
            if (currentStageMedia.tagName === 'VIDEO') {
                const imgNode = document.createElement('img');
                imgNode.id = 'mainStageImage';
                imgNode.className = 'stage-img';
                imgNode.src = targetSrc;
                imgNode.alt = product && product.title ? product.title : "Sculpture Gallery View";

                currentStageMedia.replaceWith(imgNode);
            } else {
                // If it's already an image tag, just smoothly swap the source path tracking route
                currentStageMedia.setAttribute('src', targetSrc);
            }
        }
        // Sync active styling rings across the thumbnail strip elements
        
        document.querySelectorAll('.thumb-node').forEach(t => t.classList.remove('active'));
        thumbElement.classList.add('active');

        // CRUCIAL SYNC: Update the global carousel index tracker so chevrons don't jump backwards
        const prevBtn = document.getElementById('prevStageImageBtn');
        const nextBtn = document.getElementById('nextStageImageBtn');
        if (product && product.gallery && product.gallery.length > 1) {
            const galleryPaths = product.gallery.map(img => resolveAbsoluteImagePath(img));
            let currentSrc = targetSrc;
            if (currentSrc.startsWith(window.location.origin)) {
                currentSrc = currentSrc.replace(window.location.origin, "");
            }
            const updateCarouselIndex = galleryPaths.indexOf(currentSrc);
            if (updateCarouselIndex !== -1) {
                // This forces the chevron memory index to align with what you just clicked!
                window.currentCarouselImgIndex = updateCarouselIndex;
            }
        }
    };
    // Bind Add to Cart only if the button exists, without blocking the rest of the script
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            const qtyInput = document.getElementById('detailQtyInput');
            const qty = qtyInput ? parseInt(qtyInput.value) : 1;

            const priceElement = document.getElementById('productDisplayPrice');
            const priceText = priceElement ? priceElement.innerText : "$0.00";

            const stageImg = document.getElementById('mainStageImage');
            const imgSrc = stageImg ? new URL(stageImg.src).pathname : "";

            const detailContainer = document.getElementById('productDetailContainer');
            const productId = detailContainer ? detailContainer.getAttribute('data-product-id') : "unknown";

            const titleElement = document.querySelector('.p-title');
            const productTitle = titleElement ? titleElement.innerText : "Premium Piece";

            // Loop and add the items to our active shopping cart session
            for (let i = 0; i < qty; i++) {
                if (typeof addItemToCart === 'function') {
                    addItemToCart(productId, productTitle, priceText, imgSrc);
                }
            }
            alert(`Added (${qty}) "${productTitle}" item${qty === 1 ? '' : 's'} to your shopping cart.`);
        });
    }

    // =========================================================================
    // 3. CAROUSEL CHEVRON NAVIGATION LOGIC ENGINE (DEBUGGED & ROBUST)
    // =========================================================================
    // =========================================================================
    // 3. CAROUSEL CHEVRON NAVIGATION LOGIC ENGINE (FULLY SYNCED RIM FIX)
    // =========================================================================
    const prevBtn = document.getElementById('prevStageImageBtn');
    const nextBtn = document.getElementById('nextStageImageBtn');
    const mainStageImg = document.getElementById('mainStageImage');

    if (prevBtn && nextBtn && mainStageImg) {
        const rawGallery = (product && product.gallery && product.gallery.length > 0)
            ? product.gallery
            : [product.image];

        const galleryPaths = rawGallery.map(img => resolveAbsoluteImagePath(img));

        let currentSrc = mainStageImg.getAttribute('src') || "";
        if (currentSrc.startsWith(window.location.origin)) {
            currentSrc = currentSrc.replace(window.location.origin, "");
        }

        // Initialize or update a persistent global index tracker
        window.currentCarouselImgIndex = galleryPaths.indexOf(currentSrc);
        if (window.currentCarouselImgIndex === -1) window.currentCarouselImgIndex = 0;

        // Automatically hide navigation arrows if there is only one image asset
        if (galleryPaths.length <= 1) {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
        }

        function updateCarouselStageImage(newIndex) {
            // Update our globally tracked state pointer
            window.currentCarouselImgIndex = newIndex;

            if (window.currentCarouselImgIndex < 0) {
                window.currentCarouselImgIndex = galleryPaths.length - 1;
            }
            if (window.currentCarouselImgIndex >= galleryPaths.length) {
                window.currentCarouselImgIndex = 0;
            }

            const targetPath = galleryPaths[window.currentCarouselImgIndex];
            const isVideo = targetPath.toLowerCase().endsWith('.mp4');
            const currentStageMedia = document.getElementById('mainStageImage');

            // 1. Dynamic media node reconstruction (handles MP4 vs JPG transitions)
            if (isVideo) {
                if (currentStageMedia.tagName !== 'VIDEO') {
                    const videoNode = document.createElement('video');
                    videoNode.id = 'mainStageImage';
                    videoNode.className = 'stage-img video-stage-asset';
                    videoNode.autoplay = true;
                    videoNode.loop = true;
                    videoNode.muted = true;
                    videoNode.playsInline = true;
                    videoNode.src = targetPath;
                    currentStageMedia.replaceWith(videoNode);
                } else {
                    currentStageMedia.src = targetPath;
                }
            } else {
                if (currentStageMedia.tagName === 'VIDEO') {
                    const imgNode = document.createElement('img');
                    imgNode.id = 'mainStageImage';
                    imgNode.className = 'stage-img';
                    imgNode.src = targetPath;
                    imgNode.alt = product.title || "Sculpture View";
                    currentStageMedia.replaceWith(imgNode);
                } else {
                    currentStageMedia.setAttribute('src', targetPath);
                }
            }

            // 2. FIXED: Core Thumbnail active rim synchronization loop tracker
            const thumbnails = document.querySelectorAll('.thumb-node');
            thumbnails.forEach((thumb, idx) => {
                if (idx === window.currentCarouselImgIndex) {
                    thumb.classList.add('active');
                } else {
                    thumb.classList.remove('active');
                }
            });
        }

        // Attach absolute boundary progression parameters onto navigation buttons
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            updateCarouselStageImage(window.currentCarouselImgIndex - 1);
        });

        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            updateCarouselStageImage(window.currentCarouselImgIndex + 1);
        });
    }
}

window.updateStageView = function (thumbnailElement) {
    document.querySelectorAll('.thumb-node').forEach(t => t.classList.remove('active'));
    thumbnailElement.classList.add('active');

    const stageImg = document.getElementById('mainStageImage');
    if (stageImg) {
        stageImg.src = thumbnailElement.src;
    }

    const sheetOverlay = document.getElementById('poemOverlaySheet');
    if (sheetOverlay) {
        sheetOverlay.classList.remove('active');
    }
};

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
// 7. HOMEPAGE DYNAMIC INVENTORY COUNTERS
// ==========================================
function calculateDynamicHomepageCounters() {
    const badgeNodes = document.querySelectorAll('.category-count-badge');
    if (badgeNodes.length === 0) return;

    fetch('productsData.json')
        .then(response => {
            if (!response.ok) throw new Error("Network issues reading JSON stream.");
            return response.json();
        })
        .then(data => {
            const masterProductsList = data.products || [];

            badgeNodes.forEach(badge => {
                const targetCategory = badge.getAttribute('data-category');
                if (!targetCategory) return;

                const matchingItems = masterProductsList.filter(
                    product => product.category && product.category.toLowerCase() === targetCategory.toLowerCase()
                );

                const countAmount = matchingItems.length;
                badge.innerText = `${countAmount} item${countAmount === 1 ? '' : 's'}`;

                // CONDITIONAL LOGIC ENGINE: Target the parent card component wrapper 
                const parentCard = badge.closest('.collection-card');
                if (parentCard) {
                    if (countAmount === 0) {
                        parentCard.classList.add('card-empty');
                    } else {
                        parentCard.classList.remove('card-empty');
                    }
                }
            });
        })
        .catch(err => {
            console.error("Error calculating runtime collection badges:", err);
            badgeNodes.forEach(badge => badge.innerText = "Explore Collection");
        });
}