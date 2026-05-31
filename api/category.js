// api/category.js
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
    // 1. Grab the type parameter from the request query string (?type=sculpture)
    const { type } = req.query;
    const categoryScope = type || 'objets';

    try {
        // 2. Read your master products data from the disk
        const jsonPath = path.join(process.cwd(), 'productsData.json');
        const fileContents = fs.readFileSync(jsonPath, 'utf8');
        const data = JSON.parse(fileContents);

        // 3. Filter your inventory securely on the server side
        const filteredProducts = data.products.filter(
            p => p.category.toLowerCase() === categoryScope.toLowerCase()
        );

        // 4. Return the calculated data to your front-end
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate'); // Fast caching edge advantage
        return res.status(200).json({
            category: categoryScope,
            products: filteredProducts
        });
    } catch (error) {
        return res.status(500).json({ error: "Failed to read backend data matrix." });
    }
}