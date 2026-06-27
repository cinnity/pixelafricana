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
            // Securely normalize the product mockup image URL for Stripe's checkout window
            let stripeCompatibleImage = '';
            if (item.image) {
                stripeCompatibleImage = item.image.startsWith('http') 
                    ? item.image 
                    : `${req.headers.origin}${item.image.startsWith('/') ? '' : '/'}${item.image}`;
            }

            return {
                price_data: {
                    currency: 'usd',
                    product_data: { 
                        name: item.title,
                        images: stripeCompatibleImage ? [stripeCompatibleImage] : []
                    },
                    // Stripe requires values strictly wrapped as integers in cents
                    unit_amount: Math.round(item.price * 100), 
                },
                // Pass quantity integers directly
                quantity: item.quantity,
            };
        });

        // 4. Request an official encrypted session container from Stripe's cloud
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            
            // Allow Stripe to capture full address metrics required for shipping execution
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'GB'], 
            },

            // CRUCIAL DATA ENGINE LINK: Append state tracking metadata flags to the payment record
            metadata: {
                has_in_house: inHouseItems.length > 0 ? "true" : "false",
                has_printify: printifyItems.length > 0 ? "true" : "false",
                // Compress the Printify order profiles into a tight, lightweight string payload
                printify_order_data: JSON.stringify(printifyItems.map(i => ({ 
                    id: i.id, 
                    qty: i.quantity 
                })))
            },
            success_url: `${req.headers.origin}/success.html`,
            cancel_url: `${req.headers.origin}/checkout.html`,
        });

        // 5. Send the encrypted portal route directly back to your shopEngine script trigger
        return res.status(200).json({ url: session.url });

    } catch (error) {
        console.error("❌ Stripe Session Generation Error Log:", error.message);
        return res.status(500).json({ error: "Transaction processing initialization failure." });
    }
};