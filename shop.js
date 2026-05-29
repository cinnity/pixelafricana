/**
 * Pixel Africana - Catalog Controller Engine
 * Decoupled logic router for parsing and rendering JSON inventory files
 */

let inventoryMasterDataset = [];
const targetedCategoryScope = "objets"; // Filter identifier matches product dataset array node

document.addEventListener("DOMContentLoaded", () => {
    fetch('productsData.json')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP status error: ${response.status}`);
            return response.json();
        })
        .then(data => {
            // Extract and filter the products matching this specific catalog page view
            inventoryMasterDataset = data.products.filter(p => p.category === targetedCategoryScope);
            renderProductCatalogDeck(inventoryMasterDataset);
            setupInterfaceEventHandlers();
        })
        .catch(err => console.error("Critical error parsing e-commerce dataset record layers:", err));
});

// DOM Rendering Grid Generator Engine
function renderProductCatalogDeck(productsList) {
    const containerGrid = document.getElementById('catalogProductInjectionNode');
    const counterString = document.getElementById('catalogResultsCount');
    
    // Safety check to ensure target nodes exist in current DOM scope
    if (!containerGrid || !counterString) return;

    // Clear current presentation deck layout frames
    containerGrid.innerHTML = "";
    counterString.innerText = `Showing all ${productsList.length} results`;

    if (productsList.length === 0) {
        containerGrid.innerHTML = `<p style="grid-column: 1/-1; color: #777;">No collection pieces found in this category section template.</p>`;
        return;
    }

    productsList.forEach(item => {
        const cardHTML = `
            <article class="product-card" data-id="${item.id}">
                <div class="product-image-wrapper">
                    <img src="${item.image}" alt="${item.altText}" class="product-img" loading="lazy">
                </div>
                <div class="product-details">
                    <h2 class="product-title">${item.title}</h2>
                    <div class="badge-row">
                        ${item.onSale ? '<span class="sale-badge">SALE!</span>' : ''}
                    </div>
                    <div class="price-row">
                        ${item.onSale ? `<span class="price-original">${item.priceOriginal}</span>` : ''}
                        <span class="price-current">${item.priceCurrent}</span>
                    </div>
                    <button class="add-to-cart-btn" data-product-id="${item.id}">Add to cart</button>
                </div>
            </article>
        `;
        containerGrid.insertAdjacentHTML('beforeend', cardHTML);
    });
}

// Processing Logic Handling Filter Select Routines
function setupInterfaceEventHandlers() {
    const selectorNode = document.getElementById('sortEngineSelector');
    if (!selectorNode) return;

    selectorNode.addEventListener('change', (e) => {
        let manipulatedListArray = [...inventoryMasterDataset];
        const activeCriterionValue = e.target.value;

        // Function helpers extracting number metric float calculations from target value string elements
        const parseNumericPriceValue = (str) => parseFloat(str.replace(/[^0-9.]/g, ''));

        if (activeCriterionValue === "price-low") {
            manipulatedListArray.sort((a, b) => parseNumericPriceValue(a.priceCurrent) - parseNumericPriceValue(b.priceCurrent));
        } else if (activeCriterionValue === "price-high") {
            manipulatedListArray.sort((a, b) => parseNumericPriceValue(b.priceCurrent) - parseNumericPriceValue(a.priceCurrent));
        }

        renderProductCatalogDeck(manipulatedListArray);
    });

    // Delegated click listener to safely intercept dynamically generated "Add to Cart" button actions
    document.getElementById('catalogProductInjectionNode').addEventListener('click', (e) => {
        if (e.target.classList.contains('add-to-cart-btn')) {
            const id = e.target.getAttribute('data-product-id');
            executeCartInsertionHandler(id);
        }
    });
}

// Placeholder Action Hook for Shopping Cart Subsystems 
function executeCartInsertionHandler(productId) {
    const itemMatch = inventoryMasterDataset.find(p => p.id === productId);
    if (itemMatch) {
        alert(`Added "${itemMatch.title}" to checkout processing sequence layout.`);
    }
}