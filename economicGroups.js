const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');

/**
 * @route   GET /api/economic-groups
 * @desc    Get all economic groups
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const result = await executeQuery('SELECT * FROM crm_cri.EconomicGroups ORDER BY name');
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error while fetching economic groups');
  }
});

/**
 * @route   GET /api/economic-groups/:id/details
 * @desc    Get all details for a single economic group
 * @access  Public
 */
router.get('/:id/details', async (req, res) => {
    const groupId = req.params.id;
    try {
        // Fetch all data in parallel
        const [groupResult, operationsResult, timelineResult, propertiesResult, reviewResult] = await Promise.all([
            executeQuery('SELECT * FROM crm_cri.EconomicGroups WHERE id = ?', [groupId]),
            executeQuery(`
                SELECT o.*, t.id as titulo_id, t.operationId as titulo_operationId, t.codigo_cetip, t.indexador, t.taxa, t.rating as titulo_rating, t.vencimento, t.nextPmt as titulo_nextPmt, t.securitizadora, t.agente_fiduciario, t.volume_total
                FROM crm_cri.Operations o
                LEFT JOIN crm_cri.Titulos t ON o.id = t.operationId
                WHERE o.groupId = ?
                ORDER BY o.dueDate DESC
            `, [groupId]),
            executeQuery('SELECT * FROM crm_cri.TimelineEvents WHERE groupId = ? ORDER BY date DESC', [groupId]),
            executeQuery('SELECT * FROM crm_cri.PropertyGuarantees WHERE groupId = ?', [groupId]),
            executeQuery('SELECT status FROM crm_cri.Reviews WHERE groupId = ?', [groupId])
        ]);

        if (groupResult.length === 0) {
            return res.status(404).json({ msg: 'Group not found' });
        }
        
        // Structure operations with their nested titulos
        const operationsMap = {};
        operationsResult.forEach(row => {
            if (!operationsMap[row.id]) {
                operationsMap[row.id] = {
                    id: row.id,
                    groupId: row.groupId,
                    description: row.description,
                    volume: row.volume,
                    rating: row.rating,
                    dueDate: row.dueDate,
                    nextPmt: row.nextPmt,
                    guarantees: row.guarantees,
                    titulos: []
                };
            }
            if (row.titulo_id) {
                operationsMap[row.id].titulos.push({
                    id: row.titulo_id,
                    operationId: row.titulo_operationId,
                    codigo_cetip: row.codigo_cetip,
                    indexador: row.indexador,
                    taxa: row.taxa,
                    rating: row.titulo_rating,
                    vencimento: row.vencimento,
                    nextPmt: row.titulo_nextPmt,
                    securitizadora: row.securitizadora,
                    agente_fiduciario: row.agente_fiduciario,
                    volume_total: row.volume_total
                });
            }
        });
        const operations = Object.values(operationsMap);

        const response = {
            group: groupResult[0],
            operations: operations,
            timeline: timelineResult,
            properties: propertiesResult,
            review: reviewResult[0] || { status: 'ok' }
        };

        res.json(response);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error while fetching group details');
    }
});

/**
 * @route   POST /api/economic-groups/:groupId/timeline-events
 * @desc    Create a new timeline event for a group
 * @access  Public
 */
router.post('/:groupId/timeline-events', async (req, res) => {
    const { groupId } = req.params;
    const { title, summary, fullDescription, responsible, type } = req.body;
    
    if (!title || !summary || !fullDescription || !responsible || !type) {
        return res.status(400).json({ msg: 'Please provide all required fields.' });
    }

    try {
        // NOTE: Databricks doesn't have an easy way to return the inserted row like SQL Server's OUTPUT clause.
        // We will insert and then re-fetch the latest event for that group as a simple workaround.
        const insertQuery = `
            INSERT INTO crm_cri.TimelineEvents (groupId, date, title, summary, fullDescription, responsible, type)
            VALUES (?, CURRENT_DATE(), ?, ?, ?, ?, ?)
        `;
        await executeQuery(insertQuery, [groupId, title, summary, fullDescription, responsible, type]);

        // Re-fetch the newly created event
        const result = await executeQuery(
            'SELECT * FROM crm_cri.TimelineEvents WHERE groupId = ? ORDER BY id DESC LIMIT 1',
            [groupId]
        );
        
        res.status(201).json(result[0]);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error while creating timeline event.');
    }
});

/**
 * @route   POST /api/economic-groups/:groupId/watchlist-event
 * @desc    Create a watchlist event and update the group's watchlist status
 * @access  Public
 */
router.post('/:groupId/watchlist-event', async (req, res) => {
    const { groupId } = req.params;
    const { title, fullDescription, responsible, newStatus } = req.body;
    
    if (!title || !fullDescription || !responsible || !newStatus) {
        return res.status(400).json({ msg: 'Please provide all required fields for the watchlist event.' });
    }

    try {
        // 1. Update the Economic Group's watchlistStatus
        await executeQuery(
            'UPDATE crm_cri.EconomicGroups SET watchlistStatus = ? WHERE id = ?',
            [newStatus, groupId]
        );

        // 2. Insert the new timeline event
        const summary = `Status de watchlist atualizado para: ${newStatus.toUpperCase()}. Motivo: ${title}`;
        const insertEventQuery = `
            INSERT INTO crm_cri.TimelineEvents (groupId, date, title, summary, fullDescription, responsible, type)
            VALUES (?, CURRENT_DATE(), ?, ?, ?, ?, 'watchlist')
        `;
        await executeQuery(insertEventQuery, [groupId, title, summary, fullDescription, responsible]);
        
        // Re-fetch the newly created event
        const eventResult = await executeQuery(
            "SELECT * FROM crm_cri.TimelineEvents WHERE groupId = ? AND type = 'watchlist' ORDER BY id DESC LIMIT 1",
            [groupId]
        );

        res.status(201).json(eventResult[0]);

    } catch (err) {
        console.error('Operation failed:', err);
        res.status(500).send('Server error during watchlist event creation.');
    }
});

module.exports = router;
