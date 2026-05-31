/**
 * Pixel Africana - Unified Store Engine
 * Manages universal state variables, local storage, tracking, 
 * and page-specific layout render loops in one single file.
 */

// ==========================================
// 1. GLOBAL STATE & TRACKING ARCHITECTURE
// ==========================================
let shoppingCartState = JSON.parse(localStorage.getItem('pixel_cart_items')) || [];
let inventoryMasterDataset = [];

// Unified Initialization Bootstrapper
document.addEventListener("DOMContentLoaded", () => {
    // Run header updates instantly across all views
    updateGlobalHeaderCartWidgets();

    // Check A: Are we on the generic Category template page?
    const catalogGridNode = document.getElementById('catalogProductInjectionNode');
    if (catalogGridNode) {
        const urlParams = new URLSearchParams(window.location.search);
        const currentCategoryScope = urlParams.get('type') || 'objets'; 
        initializeCatalogProductDeck(currentCategoryScope);
    }

    // Check B: Are we on the structural Cart processing page?
    if (document.getElementById('cartItemsTargetNode')) {
        renderActiveCartPageDisplay();
    }

    // Check C: Are we on the functional Checkout page?
    if (document.getElementById('checkoutForm')) {
        renderActiveCheckoutSummaryDisplay();
        setupCheckoutFormSubmission(); 
    }

    // Check D: Are we on the dynamic Product Detail View page?
    if (document.getElementById('productDetailContainer')) {
        initializeProductDetailEngine();
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
            image: productImage,
            quantity: 1
        });
    }
    syncCartToStorage();
}

function removeProductFromCart(productId) {
    shoppingCartState = shoppingCartState.filter(item => item.id !== productId);
    syncCartToStorage();
    if (document.getElementById('cartItemsTargetNode')) renderActiveCartPageDisplay();
}

function updateProductQuantity(productId, newQuantity) {
    const targetItem = shoppingCartState.find(item => item.id === productId);
    if (!targetItem) return;

    targetItem.quantity = parseInt(newQuantity);
    if (targetItem.quantity <= 0) {
        removeProductFromCart(productId);
        return;
    }
    syncCartToStorage();
    if (document.getElementById('cartItemsTargetNode')) renderActiveCartPageDisplay();
}

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
            inventoryMasterDataset = data.products.filter(p => p.category === categoryScope);
            
            // Dynamically update headings out of URL values
            const pageTitleNode = document.getElementById('catalogPageTitle');
            const breadcrumbNode = document.getElementById('catalogBreadcrumbTitle');
            
            if (pageTitleNode) pageTitleNode.innerText = `${categoryScope}`;
            if (breadcrumbNode) breadcrumbNode.innerText = `${categoryScope}`;

            renderProductCatalogGrid(inventoryMasterDataset);
            setupCatalogEventListeners();
        })
        .catch(err => console.error("Error running template deck:", err));
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
                        <img src="${item.image}" alt="${item.altText}" class="product-img">
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

    document.getElementById('catalogProductInjectionNode').addEventListener('click', (e) => {
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

        console.log(item)
        listHTML += `
            <div class="cart-item-row">
                <div class="product-meta-block">
                    <img src="${item.image}" alt="${item.title}" class="cart-item-thumb">
                    <div class="product-identity-details">
                        <a href="#" class="item-title-link">${item.title}</a>
                        <div class="item-pricing-stack"><span class="item-sale-price">$${item.price.toFixed(2)}</span></div>
                        <div class="qty-stepper-box">
                            <button class="stepper-btn" onclick="updateProductQuantity('${item.id}', ${item.quantity - 1})">−</button>
                            <input type="number" class="qty-input" value="${item.quantity}" min="1" onchange="updateProductQuantity('${item.id}', this.value)">
                            <button class="stepper-btn" onclick="updateProductQuantity('${item.id}', ${item.quantity + 1})">+</button>
                        </div>
                        <button class="remove-item-trigger" onclick="removeProductFromCart('${item.id}')">Remove item</button>
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
                    <img src="${item.image}" alt="${item.title}" class="item-thumb">
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
//