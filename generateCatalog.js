/**
 * Pixel Africana - Static Site Generation (SSG) Build-Time SEO Engine
 * Run this script prior to deployment (`node generateCatalog.js`)
 */
const fs = require('fs');
const path = require('path');

// Target paths
const dataPath = path.join(__dirname, 'productsData.json');
const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 1. FILTER ACTIVE PRODUCTS IMMEDIATELY
const activeProducts = rawData.products.filter(p => p.status === 'active');

/**
 * Universal absolute asset resolver mimicking frontend shopEngine logic
 */
function resolvePath(imgSrc) {
    if (!imgSrc) return '/images/placeholder.jpg';
    let clean = imgSrc.startsWith('./') ? imgSrc.slice(2) : imgSrc.startsWith('/') ? imgSrc.slice(1) : imgSrc;
    if (clean.startsWith('images/sculpture/')) clean = clean.replace('images/sculpture/', 'images/sculptures/');
    if (clean.startsWith('images/sculptures/') && clean.split('/').length >= 4) return '/' + clean;
    const filename = clean.split('/').pop();
    let subfolder = filename.toLowerCase().split('_')[0].split('.')[0];
    if (subfolder === 'ronke') subfolder = 'ronkeh';
    return subfolder ? `/images/sculptures/${subfolder}/${filename}` : `/images/sculptures/${filename}`;
}

/**
 * PHASE 1: Generate Static Product Detail Pages
 */
function buildStaticDetailPages() {
    console.log('📦 Starting generation of static product detail view templates...');
    
    // Read your master layout file as the structural frame wrapper
    const templatePath = path.join(__dirname, 'product-detail.html');
    let templateHtml = fs.readFileSync(templatePath, 'utf8');

    activeProducts.forEach(product => {
        let pageHtml = templateHtml;
        
        // Unroll gallery thumbnails
        let thumbsHtml = '';
        if (product.gallery && product.gallery.length > 0) {
            product.gallery.forEach((img, i) => {
                thumbsHtml += `<img src="${resolvePath(img)}" alt="${product.title} view ${i + 1}" class="thumb-node ${i === 0 ? 'active' : ''}" onclick="window.syncMainStageImageFromThumbnail(this)">`;
            });
        } else {
            thumbsHtml = `<img src="${resolvePath(product.image)}" class="thumb-node active" onclick="window.syncMainStageImageFromThumbnail(this)">`;
        }

        // Unroll poem line wrappers
        const poemHtml = product.poem && product.poem.length > 0 && product.poem[0] !== ""
            ? product.poem.map(line => `<p class="poem-stanza-line">${line}</p>`).join('')
            : `<p class="poem-stanza-line">Premium cultural art token documentation.</p>`;

        // Build core static markup block injected on initial request load
        const staticDetailViewMarkup = `
        <div class="product-split-grid" id="productDetailContainer" data-product-id="${product.id}">
            <div class="product-gallery-column">
                <div class="main-stage-image-wrap">
                    <button class="stage-nav-arrow left-arrow" id="prevStageImageBtn" aria-label="Previous image">
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <img src="${resolvePath(product.image)}" alt="${product.title}" id="mainStageImage" class="stage-img">
                    <button class="stage-nav-arrow right-arrow" id="nextStageImageBtn" aria-label="Next image">
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                    <div class="art-poem-overlay-sheet" id="poemOverlaySheet">
                        <button class="poem-close-btn" id="closePoemTrigger" aria-label="Close sheet">&times;</button>
                        <div class="poem-text-content">
                            <h3>${product.title}</h3>
                            ${poemHtml}
                        </div>
                    </div>
                </div>
                <div class="gallery-thumbnails-strip">${thumbsHtml}</div>
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
                <div class="purchase-actions-row">
                    <div class="qty-stepper-box">
                        <button class="stepper-btn" onclick="window.adjustLocalQuantityInput(-1)">−</button>
                        <input type="number" id="detailQtyInput" class="qty-input" value="1" min="1" aria-label="Quantity">
                        <button class="stepper-btn" onclick="window.adjustLocalQuantityInput(1)">+</button>
                    </div>
                    <button class="add-to-cart-action-btn" id="detailAddToCartBtn">Add To Cart</button>
                </div>
            </div>
        </div>`;

        // Inject dynamic breadcrumbs and replace the runtime target container with static markup
        pageHtml = pageHtml.replace('<title>Pixel Africana - Product Detail</title>', `<title>PixelAfricana - ${product.title}</title>`);
        pageHtml = pageHtml.replace('<span class="current-trail-node" id="breadcrumbCurrentNode">Product Detail View</span>', `<span class="current-trail-node" id="breadcrumbCurrentNode">${product.title}</span>`);
        pageHtml = pageHtml.replace('<a href="category.html" id="breadcrumbCategoryLink" style="text-transform: capitalize;">Collections</a>', `<a href="category.html?type=${product.category}" id="breadcrumbCategoryLink" style="text-transform: capitalize;">${product.category}</a>`);
        pageHtml = pageHtml.replace('<div class="product-split-grid" id="productDetailContainer"></div>', staticDetailViewMarkup);

        // Save file down to a flat, crawlable path structure: e.g., /product-detail-zainab.html
        const outputFileName = `product-detail-${product.id.toLowerCase()}.html`;
        fs.writeFileSync(path.join(__dirname, outputFileName), pageHtml, 'utf8');
        console.log(` ✅ Generated static target: ${outputFileName}`);
    });
}

/**
 * PHASE 2: Inject Pre-rendered Collection Grids into Category and Index Layout Blocks
 */
function buildStaticCategoryViews() {
    console.log('📂 Pre-rendering collection grids into layout pipelines...');
    
    const categories = [...new Set(activeProducts.map(p => p.category.toLowerCase()))];
    const categoryTemplatePath = path.join(__dirname, 'category.html');
    let categoryTemplateHtml = fs.readFileSync(categoryTemplatePath, 'utf8');

    categories.forEach(cat => {
        const structuralScopeList = activeProducts.filter(p => p.category.toLowerCase() === cat);
        
        let gridHtml = '';
        structuralScopeList.forEach(item => {
            gridHtml += `
            <article class="product-card">
                <div class="product-image-wrapper">
                    <a href="product-detail-${item.id.toLowerCase()}.html">
                        <img src="${resolvePath(item.image)}" alt="${item.altText}" class="product-img">
                    </a>
                </div>
                <div class="product-details">
                    <h2 class="product-title">
                        <a href="product-detail-${item.id.toLowerCase()}.html" style="text-decoration:none; color:inherit;">${item.title}</a>
                    </h2>
                    <div class="badge-row"></div>
                    <div class="price-row"><span class="price-current">${item.priceCurrent}</span></div>
                    <button class="add-to-cart-btn" data-id="${item.id}">Add to cart</button>
                </div>
            </article>`;
        });

        let outputHtml = categoryTemplateHtml;
        outputHtml = outputHtml.replace('<div class="product-grid-layout" id="catalogProductInjectionNode"></div>', `<div class="product-grid-layout" id="catalogProductInjectionNode">${gridHtml}</div>`);
        outputHtml = outputHtml.replace('<span class="results-counter-string" id="catalogResultsCount">Loading item logs...</span>', `<span class="results-counter-string" id="catalogResultsCount">Showing all ${structuralScopeList.length} results</span>`);
        outputHtml = outputHtml.replace('<span class="current-trail-node" id="catalogBreadcrumbTitle"></span>', `<span class="current-trail-node" id="catalogBreadcrumbTitle" style="text-transform: capitalize;">${cat} Collection</span>`);

        const outputFileName = `category-${cat}.html`;
        fs.writeFileSync(path.join(__dirname, outputFileName), outputHtml, 'utf8');
        console.log(` ✅ Generated static category node view: ${outputFileName}`);
    });

    // Update Home Index Counters Static Layout elements
    console.log('🏠 Updating homepage counter metrics dynamically...');
    const indexTemplatePath = path.join(__dirname, 'index.html');
    let indexHtml = fs.readFileSync(indexTemplatePath, 'utf8');

    const totalSculptures = activeProducts.filter(p => p.category === 'sculpture').length;
    indexHtml = indexHtml.replace('<span class="category-count-badge">7 Items</span>', `<span class="category-count-badge">${totalSculptures} Items</span>`);
    indexHtml = indexHtml.replace('href="category.html?type=sculpture"', 'href="category-sculpture.html"');

    fs.writeFileSync(indexTemplatePath, indexHtml, 'utf8');
    console.log(' ✅ Homepage template counters patched successfully!');
}

// Execute execution workflow paths
buildStaticDetailPages();
buildStaticCategoryViews();
console.log('🚀 Build optimization complete. Storefront is fully optimized for SEO and AI Discovery Engines.');