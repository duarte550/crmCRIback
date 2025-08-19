const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');

/**
 * @route   GET /api/search?term=...
 * @desc    Perform a global search across multiple tables
 * @access  Public
 */
router.get('/', async (req, res) => {
    const { term } = req.query;

    if (!term || term.trim() === '') {
        return res.json({ groups: [], events: [] });
    }

    try {
        const searchTerm = `%${term}%`;

        // Search in parallel
        const [groupResults, eventResults] = await Promise.all([
            executeQuery(
                `
                    SELECT 
                        id, 
                        name as title, 
                        'Grupo Econômico' as type, 
                        description as snippet, 
                        id as groupId
                    FROM crm_cri.EconomicGroups
                    WHERE name LIKE ? OR description LIKE ?
                `,
                [searchTerm, searchTerm]
            ),
            executeQuery(
                `
                    SELECT 
                        e.id, 
                        e.title, 
                        'Evento' as type, 
                        g.name as snippet, 
                        e.groupId
                    FROM crm_cri.TimelineEvents e
                    JOIN crm_cri.EconomicGroups g ON e.groupId = g.id
                    WHERE e.title LIKE ? OR e.summary LIKE ?
                `,
                [searchTerm, searchTerm]
            )
        ]);

        res.json({
            groups: groupResults,
            events: eventResults
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error while performing search');
    }
});

module.exports = router;