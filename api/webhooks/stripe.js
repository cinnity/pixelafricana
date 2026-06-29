/**
 * /api/webhooks/stripe.js - Automated Print Fulfill Integration
 * Listens for verified Stripe checkout completions and automatically 
 * transmits production orders directly into the Printify merchant api.
 */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch'); // Ensure node-fetch is in package.json if on Node < 18

// Vercel serverless configuration to read the raw request body required for cryptograph signature verification
export const config = {
    api: {
        bodyParser: false,
    },
};

// Helper function to read raw stream data safely
async function buffer(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];
    let event;

    // 1. Authenticate that the incoming message came cryptographically from Stripe
    try {
        event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`❌ Webhook Signature Fraud Guard Triggered: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 2. Process successful transaction completions exclusively
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        console.log(`💰 Verified Payment Captured! Processing Session ID: ${session.id}`);

        // Extract metadata flags we appended during checkout initialization
        const metadata = session.metadata || {};
        const hasPrintify = metadata.has_printify === "true";

        if (hasPrintify && metadata.printify_order_data) {
            try {
                // Parse the compact canvas items configuration list back into a clean array
                const printifyItems = JSON.parse(metadata.printify_order_data);
                
                // Extract shipping address properties parsed directly by Stripe's checkout form matrix
                const shippingDetails = session.shipping_details || {};
                const addr = shippingDetails.address || {};
                const nameParts = shippingDetails.name ? shippingDetails.name.split(' ') : ['Guest', 'Customer'];
                
                // 3. Structure the standardized delivery array payload required by the Printify API
                const printifyPayload = {
                    external_id: session.id, // Links Stripe Transaction ID cleanly to your Printify dashboard record
                    label: `Order via Stripe Session ${session.id.slice(-6)}`,
                    line_items: printifyItems.map(item => ({
                        product_id: item.id.split('_')[0], // Extract pure raw product id string
                        variant_id: parseInt(item.id.split('_')[1], 10) || item.id, // Grab specific structural size id integer
                        quantity: parseInt(item.qty, 10)
                    })),
                    shipping_method: 1, // Standard Global Mail Routing Class
                    send_shipping_notification: true,
                    address_to: {
                        first_name: nameParts[0],
                        last_name: nameParts.slice(1).join(' ') || 'Customer',
                        email: session.customer_details?.email || 'no-email@pixelafricana.com',
                        phone: session.customer_details?.phone || '',
                        address1: addr.line1,
                        address2: addr.line2 || '',
                        city: addr.city,
                        region: addr.state,
                        country: addr.country,
                        zip: addr.postal_code
                    }
                };

                console.log("✈️ Transmitting fulfillment instruction sets to Printify infrastructure...");

                // 4. Securely fire the background POST request to your automated Printify shop panel
                const printifyResponse = await fetch(`https://api.printify.com/v1/shops/${process.env.PRINTIFY_SHOP_ID}/orders.json`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.PRINTIFY_API_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(printifyPayload)
                });

                const responseData = await printifyResponse.json();

                if (!printifyResponse.ok) {
                    throw new Error(`Printify API Error Response: ${JSON.stringify(responseData)}`);
                }

                console.log(`✅ Success! Printify Order Generated Securely. ID: ${responseData.id}`);

            } catch (error) {
                console.error("❌ Printify Dispatch Critical Automation Failure:", error.message);
                // Return a 200 status back to Stripe even on internal failures so Stripe doesn't infinitely hammer your endpoint
                return res.status(200).json({ error: "Printify injection sequence broke, manual review needed." });
            }
        }
    }

    // Acknowledge the safe structural receipt of the event string block back to Stripe core cloud servers
    return res.status(200).json({ received: true });
};