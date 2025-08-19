const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');

/**
 * @route   GET /api/visits
 * @desc    Get all visits with associated group info
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery(`
        SELECT v.*, g.name as groupName
        FROM crm_cri.Visits v
        JOIN crm_cri.EconomicGroups g ON v.groupId = g.id
        ORDER BY v.nextVisitDate ASC
    `);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error while fetching visits');
  }
});

module.exports = router;