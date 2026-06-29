/**
 * Pixel Africana - Dual-Stream Unified Build Engine (Production Asset Synchronization)
 * Run this script prior to deployment (`node generateCatalog.js`)
 * Generates static, crawlable HTML views optimized for SEO and AI discovery scrapers.
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

    let masterCatalog = { products: [] };
    try {
        masterCatalog = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (err) {
        console.error("❌ Critical Error reading local productsData.json file:", err.message);
        process.exit(1);
    }

    // Stream 1: Isolate native, premium fine art collections
    const inHouseItems = masterCatalog.products.filter(p => p.status === 'active' && p.fulfillmentChannel === 'in-house');

    // Stream 2: Isolate Printify line items waiting for live asset enrichment mapping
    const printifyLedgerItems = masterCatalog.products.filter(p => p.status === 'active' && p.fulfillmentChannel === 'printify');

    let enrichedPrintifyItems = [];
    const token = process.env.PRINTIFY_API_TOKEN;
    const shopId = process.env.PRINTIFY_SHOP_ID;

    if (token && shopId && printifyLedgerItems.length > 0) {
        try {
            const res = await axios.get(`https://api.printify.com/v1/shops/${shopId}/products.json`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json;charset=utf-8'
                }
            });

            const upstreamProducts = res.data.data;
            let databaseFileChanged = false;

            // CORE MERGING LAYER: Cross-references local ledger configurations with live Printify properties
            printifyLedgerItems.forEach(ledgerItem => {
                const liveMatch = upstreamProducts.find(p => p.id === ledgerItem.printifyProductId);

                if (liveMatch) {
                    // 1. EXTRACT VARIANT IDs THAT CONTAIN VALID, NON-EMPTY SKUs
                    const activeVariantIds = liveMatch.variants
                        .filter(v => v.sku && v.sku.trim() !== "")
                        .map(v => v.id);

                    // 2. FILTER IMAGES TO INCLUDE ONLY THOSE BOUND TO ACTIVE SKUs
                    const filteredImages = liveMatch.images.filter(img => {
                        return img.variant_ids.some(id => activeVariantIds.includes(id));
                    });

                    // 3. SAFEGUARD FALLBACK: If everything is blank, fall back to default images
                    const finalImagesArray = filteredImages.length > 0 ? filteredImages : liveMatch.images;
                    const liveMockupSrc = finalImagesArray[0].src;

                    const activePrice = liveMatch.variants.find(v => activeVariantIds.includes(v.id))?.price
                        || liveMatch.variants[0].price;

                    // 4. WRITE UPDATED STRINGS DIRECTLY TO YOUR LOCAL MASTER JSON OBJECT IN MEMORY
                    const masterCatalogProductItem = masterCatalog.products.find(p => p.id === ledgerItem.id);
                    if (masterCatalogProductItem) {
                        let itemUpdated = false;

                        if (masterCatalogProductItem.image !== liveMockupSrc) {
                            masterCatalogProductItem.image = liveMockupSrc;
                            itemUpdated = true;
                        }

                        if (masterCatalogProductItem.profileImage !== liveMockupSrc) {
                            masterCatalogProductItem.profileImage = liveMockupSrc;
                            itemUpdated = true;
                        }

                        if (itemUpdated) {
                            databaseFileChanged = true;
                        }
                    }

                    enrichedPrintifyItems.push({
                        ...ledgerItem,
                        priceCurrent: `$${(activePrice / 100).toFixed(2)}`,
                        image: liveMockupSrc,
                        profileImage: liveMockupSrc,
                        gallery: finalImagesArray.map(img => img.src),
                        altText: ledgerItem.altText || liveMatch.title,
                        // Pass options down to the static product details constructor
                        rawVariants: liveMatch.variants,
                        rawImages: liveMatch.images
                    });
                } else {
                    console.log(`⚠️ Warning: Local item "${ledgerItem.title}" product ID matches no active items on Printify.`);
                }
            });

            // 5. DISK COMMIT LAYER: Overwrite productsData.json permanently if values shifted
            if (databaseFileChanged) {
                fs.writeFileSync(dataPath, JSON.stringify(masterCatalog, null, 2), 'utf8');
                console.log('💾 Local productsData.json has been automatically normalized and saved to disk.');
            }

            console.log(` ✅ Successfully filtered, merged, and enriched ${enrichedPrintifyItems.length} print items via API.`);
        } catch (err) {
            console.log('⚠️ Printify connection skipped or offline. Falling back to default ledger properties.');
            enrichedPrintifyItems = printifyLedgerItems;
        }
    } else {
        console.log('💡 Printify API environment tokens not detected or ledger empty. Using local properties only.');
        enrichedPrintifyItems = printifyLedgerItems;
    }

    // Combine separate arrays into a single source of truth layout catalog
    const unifiedCatalog = [...inHouseItems, ...enrichedPrintifyItems];

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

        // Unroll poem line containers with structural stanza break spacing handles
        const poemHtml = product.poem && product.poem.length > 0 && product.poem[0] !== ""
            ? product.poem.map(line => {
                if (line.trim() === "") {
                    return `<div class="poem-stanza-break" style="height: 1.5rem;"></div>`;
                }
                return `<p class="poem-stanza-line" style="margin: 0 0 4px 0;">${line}</p>`;
            }).join('')
            : `<p class="poem-stanza-line">Premium cultural art token documentation variables.</p>`;

        // Replace the old JSON encoding variables inside generateCatalog.js with this explicit safety path:
        const escapeHtmlAttr = (str) => {
            if (!str) return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        };

        // CRITICAL DATA PASS: Ensure it tries product.variants directly if rawVariants is missing
        const variantsArray = product.rawVariants || product.variants || [];
        const imagesArray = product.rawImages || product.images || [];

        const variantsDataAttr = escapeHtmlAttr(JSON.stringify(variantsArray));
        const imagesDataAttr = escapeHtmlAttr(JSON.stringify(imagesArray));

        const staticDetailViewMarkup = `
        <div class="product-split-grid" id="productDetailContainer" 
             data-product-id="${product.id}" 
             data-fulfillment="${product.fulfillmentChannel}"
             data-variants="${variantsDataAttr}"
             data-images="${imagesDataAttr}">
            
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
                <div class="gallery-thumbnails-strip" id="detailThumbnailsStrip">${thumbsHtml}</div>
            </div>
            
            <div class="product-purchase-column">
                <h1 class="p-title">${product.title}</h1>
                
                <div class="p-reviews-row">
                    <span class="stars-gold">★★★★★</span>
                    <span class="reviews-count">(0 customer reviews)</span>
                </div>
                
                <div class="p-technical-ledger">
                    <div class="ledger-line"><span class="lbl">SKU:</span> <span class="val" id="variantSkuDisplay">${product.printifyProductId || 'N/A'}</span></div>
                    <div class="ledger-line">
                        <span class="lbl">Category:</span> 
                        <span class="val">
                            <a href="category-${product.category.toLowerCase()}.html" style="text-transform: capitalize; text-decoration: none; color: inherit; font-weight: 500;">${product.category}</a>
                        </span>
                    </div>
                    <div class="ledger-line"><span class="lbl">Fulfillment:</span> <span class="val" style="text-transform: uppercase; font-size: 0.8rem; letter-spacing: 0.5px;">${product.fulfillmentChannel}</span></div>
                </div>

                <div class="variant-selection-container" id="variantDropdownMountInjectionNode"></div>
                
                <div class="p-price-display" id="productDisplayPrice">${product.priceCurrent}</div>
                
                <div class="purchase-actions-row">
                    <div class="qty-stepper-box">
                        <button class="stepper-btn" onclick="window.adjustLocalQuantityInput(-1)">−</button>
                        <input type="number" id="detailQtyInput" class="qty-input" value="1" min="1" aria-label="Quantity">
                        <button class="stepper-btn" onclick="window.adjustLocalQuantityInput(1)">+</button>
                    </div>
                    <button class="add-to-cart-action-btn" id="detailAddToCartBtn" data-id="${product.id}" data-selected-variant="">Add To Cart</button>
                </div>
            </div>
        </div>`;

        // Inject dynamic titles and pre-bake static content tokens
        pageHtml = pageHtml.replace('<title>Pixel Africana - Product Detail</title>', `<title>PixelAfricana - ${product.title}</title>`);
        pageHtml = pageHtml.replace('<span class="current-trail-node" id="breadcrumbCurrentNode">Product Detail View</span>', `<span class="current-trail-node" id="breadcrumbCurrentNode">${product.title}</span>`);
        pageHtml = pageHtml.replace('<a href="category.html" id="breadcrumbCategoryLink" style="text-transform: capitalize;">Collections</a>', `<a href="category-${product.category.toLowerCase()}.html" id="breadcrumbCategoryLink" style="text-transform: capitalize;">${product.category} Collection</a>`);
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
            const isSale = item.onsale || false;

            gridHtml += `
            <article class="product-card" data-fulfillment="${item.fulfillmentChannel}">
                <div class="product-image-wrapper">
                    <a href="product-detail-${item.id.toLowerCase()}.html">
                        <img src="${resolvePath(item.image)}" alt="${item.altText || item.title}" class="product-img">
                    </a>
                </div>
                <div class="product-details">
                    <h2 class="product-title">
                        <a href="product-detail-${item.id.toLowerCase()}.html" style="text-decoration:none; color:inherit;">${item.title}</a>
                    </h2>
                    <div class="badge-row">
                        ${isSale ? '<span class="sale-badge">SALE!</span>' : ''}
                    </div>
                    <div class="price-row">
                        ${isSale && item.priceOriginal ? `<span class="price-original">${item.priceOriginal}</span>` : ''}
                        <span class="price-current">${item.priceCurrent}</span>
                    </div>
                    <button class="add-to-cart-btn" data-id="${item.id}">Add to cart</button>
                </div>
            </article>`;
        });

        let outputHtml = categoryTemplateHtml;
        outputHtml = outputHtml.replace('<div class="product-grid-layout" id="catalogProductInjectionNode"></div>', `<div class="product-grid-layout" id="catalogProductInjectionNode">${gridHtml}</div>`);
        outputHtml = outputHtml.replace('Loading item logs...', `Showing all ${matchingProducts.length} results`);
        outputHtml = outputHtml.replace('<span class="current-trail-node" id="catalogBreadcrumbTitle"></span>', `<span class="current-trail-node" id="catalogBreadcrumbTitle" style="text-transform: capitalize;">${cat} Collection</span>`);

        // Strict anchor limits ensure standalone menu links fallback to sculpture without corrupting dynamic category routing
        outputHtml = outputHtml.replace(/href=["']category\.html["']/gi, 'href="category-sculpture.html"');

        const outputFileName = `category-${cat}.html`;
        fs.writeFileSync(path.join(__dirname, outputFileName), outputHtml, 'utf8');
    });

    // Patch structural counter badges on primary index homepage layout
    console.log('🏠 Running RegEx routing updates on homepage templates...');
    const indexTemplatePath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexTemplatePath)) {
        let indexHtml = fs.readFileSync(indexTemplatePath, 'utf8');

        const totalSculptures = products.filter(p => p.category === 'sculpture').length;
        indexHtml = indexHtml.replace(/<span class="category-count-badge" data-category="sculpture">.*?<\/span>/i, `<span class="category-count-badge" data-category="sculpture">${totalSculptures} Items</span>`);

        // Strict boundary configurations protect clean hardcoded paths like category-wall-art.html from deletion
        indexHtml = indexHtml.replace(/href=["']category\.html\?type=sculpture\s*["']/gi, 'href="category-sculpture.html"');
        indexHtml = indexHtml.replace(/href=["']category\.html["']/gi, 'href="category-sculpture.html"');

        fs.writeFileSync(indexTemplatePath, indexHtml, 'utf8');
    }
}

// Execute pipeline sequences
startBuildEngine();