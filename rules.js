const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');

/**
 * @route   GET /api/rules
 * @desc    Get all rules
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM crm_cri.Rules ORDER BY priority, nextExecution');
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error while fetching rules');
  }
});

module.exports = router;