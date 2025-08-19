const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');

/**
 * @route   GET /api/appraisals
 * @desc    Get all appraisals with associated group info
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery(`
        SELECT a.*, g.name as groupName
        FROM crm_cri.Appraisals a
        JOIN crm_cri.EconomicGroups g ON a.groupId = g.id
        ORDER BY a.date DESC
    `);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error while fetching appraisals');
  }
});

module.exports = router;