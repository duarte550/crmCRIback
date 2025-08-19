const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');

/**
 * @route   GET /api/watchlist
 * @desc    Get all groups that are in 'attention' or 'critical' status
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery(`
        SELECT id, name, watchlistStatus, currentVolume 
        FROM crm_cri.EconomicGroups 
        WHERE watchlistStatus IN ('attention', 'problem', 'critical')
    `);
    
    // Add a mock observation based on status for demo purposes
    const groups = result.map(g => ({
        ...g,
        lastObservation: g.watchlistStatus === 'critical' 
            ? 'Atraso recorrente no envio de covenants.' 
            : 'Queda de 15% no faturamento do último trimestre.'
    }));

    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error while fetching watchlist groups');
  }
});

/**
 * @route   GET /api/watchlist/summary
 * @desc    Get a count of groups by watchlist status
 * @access  Public
 */
router.get('/summary', async (req, res) => {
  try {
    const result = await executeQuery(`
        SELECT 
            SUM(CASE WHEN watchlistStatus = 'ok' THEN 1 ELSE 0 END) as ok,
            SUM(CASE WHEN watchlistStatus IN ('attention', 'problem') THEN 1 ELSE 0 END) as attention,
            SUM(CASE WHEN watchlistStatus = 'critical' THEN 1 ELSE 0 END) as critical
        FROM crm_cri.EconomicGroups
    `);
    res.json(result[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error while fetching watchlist summary');
  }
});


module.exports = router;