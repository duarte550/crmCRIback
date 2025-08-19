const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');

/**
 * @route   GET /api/insurances
 * @desc    Get all insurances with associated group info
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery(`
        SELECT i.*, g.name as groupName
        FROM crm_cri.Insurances i
        JOIN crm_cri.EconomicGroups g ON i.groupId = g.id
        ORDER BY i.expirationDate ASC
    `);
    res.json(result);
  } catch (err)
 {
    console.error(err);
    res.status(500).send('Server error while fetching insurances');
  }
});

module.exports = router;