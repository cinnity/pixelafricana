/**
 * Pixel Africana - Dual-Stream Build Engine (Printify API + In-House Local Data)
 * Run this script prior to deployment (`node generateCatalog.js`)
 * Generates static, crawlable html views fully optimized for SEO and AI discovery scrapers.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Target paths
const dataPath = path.join(__dirname, 'productsData.json');

/**
 * Universal absolute asset resolver mimicking frontend shopEngine logic.
 * Safely passes external Printify CDN URLs straight through.
 */
function resolvePath(imgSrc) {
    if (!imgSrc) return '/images/placeholder.jpg';
    if (imgSrc.startsWith('http://') || imgSrc.startsWith('https://')) return imgSrc;
    
    let clean = imgSrc.startsWith('./') ? imgSrc.slice(2) : imgSrc.startsWith('/') ? imgSrc.slice(1) : imgSrc;
    if (clean.startsWith('images/sculpture/')) clean = clean.replace('images/sculpture/', 'images/sculptures/');
    if (clean.startsWith('images/sculptures/') && clean.split('/').length >= 4) return '/' + clean;
    
    const filename = clean.split('/').pop();
    let subfolder = filename.toLowerCase().split('_')[0].split('.')[0];
    if (subfolder === 'ronke') subfolder = 'ronkeh';
    return subfolder ? `/images/sculptures/${subfolder}/${filename}` : `/images/sculptures/${filename}`;
}

async function startBuildEngine() {
    console.log('🌐 Ingesting catalog datasets from local database and live Printify API streams...');
    
    // Stream 1: Gather your custom, premium in-house fine art masterpieces
    let inHouseItems = [];
    try {
        const localCatalog = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
        inHouseItems = localCatalog.products.filter(p => p.status === 'active').map(item => ({
            ...item,
            fulfillmentChannel: item.fulfillmentChannel || "in-house" // Default fallback tracking metric
        }));
        console.log(` ✅ Loaded ${inHouseItems.length} active fine art masterpieces from local JSON.`);
    } catch (err) {
        console.error("❌ Critical Error reading local productsData.json file:", err.message);
        process.exit(1);
    }

    // Stream 2: Pull your automated canvas merchandising prints via Printify API
    let printifyItems = [];
    const token = process.env.PRINTIFY_API_TOKEN;
    const shopId = process.env.PRINTIFY_SHOP_ID;

    if (token && shopId) {
        try {
            const res = await axios.get(`https://api.printify.com/v1/shops/${shopId}/products.json`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json;charset=utf-8'
                }
            });
            
            // Map Printify's schema array into your frontend data structures
            printifyItems = res.data.data.filter(p => p.visible).map(product => ({
                id: product.id,
                category: "wall-art", // Maps external products directly into your wall-art grid templates
                title: product.title,
                status: "active",
                fulfillmentChannel: "printify",
                priceCurrent: `$${(product.variants[0].price / 100).toFixed(2)}`, // Converts cents into decimal strings
                image: product.images[0].src,
                gallery: product.images.map(img => img.src),
                poem: [product.description || "Premium canvas merchandise collection data tokens."],
                altText: product.title
            }));
            console.log(` ✅ Ingested ${printifyItems.length} active canvas listings from Printify API.`);
        } catch (err) {
            console.log('⚠️ Printify connection skipped or offline. Building in-house assets only.');
        }
    } else {
        console.log('💡 Printify API environment tokens not detected in this runtime context. Building local assets only.');
    }

    // Merge streams into one master unified layout catalog configuration array
    const unifiedCatalog = [...inHouseItems, ...printifyItems];

    buildStaticDetailPages(unifiedCatalog);
    buildStaticCategoryViews(unifiedCatalog);
    console.log('🚀 Optimization process complete! Storefront is pre-rendered for search networks and AI scrapers.');
}

/**
 * PHASE 1: Generate Self-Contained, Static Product Detail HTML Pages
 */
function buildStaticDetailPages(products) {
    console.log('📦 Generating static product detail templates...');
    const templatePath = path.join(__dirname, 'product-detail.html');
    if (!fs.existsSync(templatePath)) {
        console.error("❌ Error: product-detail.html layout template missing from directory tree.");
        return;
    }
    const templateHtml = fs.readFileSync(templatePath, 'utf8');

    products.forEach(product => {
        let pageHtml = templateHtml;
        
        // Unroll layout thumbnail strips safely
        let thumbsHtml = '';
        if (product.gallery && product.gallery.length > 0) {
            product.gallery.forEach((img, i) => {
                thumbsHtml += `<img src="${resolvePath(img)}" alt="${product.title} view ${i + 1}" class="thumb-node ${i === 0 ? 'active' : ''}" onclick="window.syncMainStageImageFromThumbnail(this)">`;
            });
        } else {
            thumbsHtml = `<img src="${resolvePath(product.image)}" class="thumb-node active" onclick="window.syncMainStageImageFromThumbnail(this)">`;
        }

        // Unroll poem line containers safely
        const poemHtml = product.poem && product.poem.length > 0 && product.poem[0] !== ""
            ? product.poem.map(line => `<p class="poem-stanza-line">${line}</p>`).join('')
            : `<p class="poem-stanza-line">Premium cultural art token documentation variables.</p>`;

        const staticDetailViewMarkup = `
        <div class="product-split-grid" id="productDetailContainer" data-product-id="${product.id}" data-fulfillment="${product.fulfillmentChannel}">
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
                    <div class="ledger-line"><span class="lbl">Category:</span> <span class="val"><a href="category-${product.category.toLowerCase()}.html" style="text-transform: capitalize;">${product.category}</a></span></div>
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

        // Inject dynamic titles and pre-bake static content tokens
        pageHtml = pageHtml.replace('<title>Pixel Africana - Product Detail</title>', `<title>PixelAfricana - ${product.title}</title>`);
        pageHtml = pageHtml.replace('<span class="current-trail-node" id="breadcrumbCurrentNode">Product Detail View</span>', `<span class="current-trail-node" id="breadcrumbCurrentNode">${product.title}</span>`);
        pageHtml = pageHtml.replace('<a href="category.html" id="breadcrumbCategoryLink" style="text-transform: capitalize;">Collections</a>', `<a href="category-${product.category.toLowerCase()}.html" id="breadcrumbCategoryLink" style="text-transform: capitalize;">${product.category}</a>`);
        pageHtml = pageHtml.replace('<div class="product-split-grid" id="productDetailContainer"></div>', staticDetailViewMarkup);

        const outputFileName = `product-detail-${product.id.toLowerCase()}.html`;
        fs.writeFileSync(path.join(__dirname, outputFileName), pageHtml, 'utf8');
    });
}

/**
 * PHASE 2: Inject Pre-rendered Category Views and Enforce RegEx Navigation Patching
 */
function buildStaticCategoryViews(products) {
    console.log('📂 Compiling pre-rendered grid components into collection views...');
    const categories = [...new Set(products.map(p => p.category.toLowerCase()))];
    const categoryTemplatePath = path.join(__dirname, 'category.html');
    if (!fs.existsSync(categoryTemplatePath)) return;
    const categoryTemplateHtml = fs.readFileSync(categoryTemplatePath, 'utf8');

    categories.forEach(cat => {
        const matchingProducts = products.filter(p => p.category.toLowerCase() === cat);
        
        let gridHtml = '';
        matchingProducts.forEach(item => {
            gridHtml += `
            <article class="product-card" data-fulfillment="${item.fulfillmentChannel}">
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
        outputHtml = outputHtml.replace('<span class="results-counter-string" id="catalogResultsCount">Loading item logs...</span>', `<span class="results-counter-string" id="catalogResultsCount">Showing all ${matchingProducts.length} results</span>`);
        outputHtml = outputHtml.replace('<span class="current-trail-node" id="catalogBreadcrumbTitle"></span>', `<span class="current-trail-node" id="catalogBreadcrumbTitle" style="text-transform: capitalize;">${cat} Collection</span>`);
        
        // Ensure menu links on sub-category pages point directly to your primary static collection page
        outputHtml = outputHtml.replace(/href=["']category\.html\s*["']/gi, 'href="category-sculpture.html"');

        const outputFileName = `category-${cat}.html`;
        fs.writeFileSync(path.join(__dirname, outputFileName), outputHtml, 'utf8');
    });

    // Patch structural counter badges on the primary index homepage file layout 
    console.log('🏠 Running RegEx routing updates on homepage templates...');
    const indexTemplatePath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexTemplatePath)) {
        let indexHtml = fs.readFileSync(indexTemplatePath, 'utf8');
        
        const totalSculptures = products.filter(p => p.category === 'sculpture').length;
        indexHtml = indexHtml.replace(/<span class="category-count-badge">.*?<\/span>/i, `<span class="category-count-badge">${totalSculptures} Items</span>`);

        // Force both direct links and query configurations to fall back directly to your compiled static files
        indexHtml = indexHtml.replace(/href=["']category\.html\?type=sculpture\s*["']/gi, 'href="category-sculpture.html"');
        indexHtml = indexHtml.replace(/href=["']category\.html\s*["']/gi, 'href="category-sculpture.html"');

        fs.writeFileSync(indexTemplatePath, indexHtml, 'utf8');
    }
}

// Execute compilation pipeline sequences
startBuildEngine();