/**
 * /api/checkout.js - Secure Hybrid Checkout Pipeline Router
 * Maps frontend cart states into Stripe payload line items and appends 
 * fulfillment metadata so automated print triggers can run accurately.
 */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    // 1. Enforce strict REST API request guardrails
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { cartItems } = req.body;

        if (!cartItems || cartItems.length === 0) {
            return res.status(400).json({ error: "Cannot process an empty shopping cart payload." });
        }

        // 2. Separate and evaluate multi-channel fulfillment vectors
        const inHouseItems = cartItems.filter(item => item.fulfillmentChannel === 'in-house');
        const printifyItems = cartItems.filter(item => item.fulfillmentChannel === 'printify');

        // 3. Transform frontend cart objects into formal Stripe line items
        const lineItems = cartItems.map(item => {
            // FIX 1: Safely strip away '$' symbols and alpha strings, converting the value to a raw numeric decimal float
            const cleanNumericPrice = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0;

            // FIX 2: Securely normalize the image path and provide a real-world placeholder fallback if running on localhost
            let stripeCompatibleImage = '';
            if (item.image) {
                if (item.image.startsWith('http')) {
                    stripeCompatibleImage = item.image;
                } else {
                    const hostOrigin = req.headers.origin || '';
                    // If running locally, fall back to a public image so Stripe's crawler doesn't reject the URL
                    stripeCompatibleImage = hostOrigin.includes('localhost') || hostOrigin.includes('127.0.0.1')
                        ? 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=200' 
                        : `${hostOrigin}${item.image.startsWith('/') ? '' : '/'}${item.image}`;
                }
            }

            return {
                price_data: {
                    currency: 'usd',
                    product_data: { 
                        name: item.title,
                        images: stripeCompatibleImage ? [stripeCompatibleImage] : []
                    },
                    // Securely calculate cents from our cleaned, parsed numeric float
                    unit_amount: Math.round(cleanNumericPrice * 100), 
                },
                quantity: item.quantity,
            };
        });

        // 4. Request an official encrypted session container from Stripe's cloud
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'GB'], 
            },

            metadata: {
                has_in_house: inHouseItems.length > 0 ? "true" : "false",
                has_printify: printifyItems.length > 0 ? "true" : "false",
                printify_order_data: JSON.stringify(printifyItems.map(i => ({ 
                    id: i.id, 
                    qty: i.quantity 
                })))
            },
            success_url: `${req.headers.origin}/success.html`,
            cancel_url: `${req.headers.origin}/cart.html`, // Redirect directly back to the active cart layout view
        });

        return res.status(200).json({ url: session.url });

    } catch (error) {
        console.error("❌ Stripe Session Generation Error Log:", error.message);
        return res.status(500).json({ error: "Transaction processing initialization failure." });
    }
};