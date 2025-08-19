const express = require('express');
const router = express.Router();
const { getConnection } = require('../config/db');

/**
 * @route   GET /api/rules
 * @desc    Get all rules
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT * FROM crm_cri.Rules ORDER BY priority, nextExecution');
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error while fetching rules');
  }
});

module.exports = router;
