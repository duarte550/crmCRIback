const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');

/**
 * @route   GET /api/reports/volume-by-rating
 * @desc    Get aggregated volume by rating from Databricks
 * @access  Public
 */
router.get('/volume-by-rating', async (req, res) => {
    try {
        // NOTE: Replace 'hive_metastore.crm_cri_bronze.operations' with your actual catalog, schema, and table name in Databricks.
        const query = `
            SELECT 
                rating, 
                SUM(volume) as total_volume
            FROM crm_cri.Operations
            GROUP BY rating
            ORDER BY total_volume DESC
        `;
        
        const result = await executeQuery(query);
        res.json(result);

    } catch (err) {
        console.error('Error executing query on Databricks:', err);
        res.status(500).send('Server error while fetching reports from Databricks');
    }
});

module.exports = router;
