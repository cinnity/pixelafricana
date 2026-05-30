// /api/checkout.js
// Vercel serverless function execution routine to securely generate Stripe sessions
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { cartItems } = req.body;

        // Map your frontend array variable into Stripe's official line item architecture
        const lineItems = cartItems.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: { name: item.title, images: [item.image] },
                unit_amount: Math.round(item.price * 100), // Stripe counts transactions strictly in cents
            },
            quantity: item.quantity,
        }));

        // Request a certified hosted payment session boundary from Stripe's cloud
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${req.headers.origin}/success.html`,
            cancel_url: `${req.headers.origin}/checkout.html`,
        });

        return res.status(200).json({ url: session.url });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};