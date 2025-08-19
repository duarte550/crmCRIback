const express = require('express');
const router = express.Router();
const { getConnection } = require('../config/db');

/**
 * @route   GET /api/reviews
 * @desc    Get all reviews with associated group info
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
        SELECT r.*, g.name as groupName, g.currentVolume 
        FROM crm_cri.Reviews r
        JOIN crm_cri.EconomicGroups g ON r.groupId = g.id
        ORDER BY r.nextReviewDate ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error while fetching reviews');
  }
});

module.exports = router;
