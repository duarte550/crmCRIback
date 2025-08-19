const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { getConnection } = require('../config/db');

/**
 * @route   GET /api/economic-groups
 * @desc    Get all economic groups
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT * FROM crm_cri.EconomicGroups ORDER BY name');
    res.json(result.recordset);
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
        const pool = await getConnection();

        // Fetch all data in parallel
        const [groupResult, operationsResult, timelineResult, propertiesResult, reviewResult] = await Promise.all([
            pool.request().input('id', sql.Int, groupId).query('SELECT * FROM crm_cri.EconomicGroups WHERE id = @id'),
            pool.request().input('groupId', sql.Int, groupId).query(`
                SELECT o.*, t.id as titulo_id, t.operationId as titulo_operationId, t.codigo_cetip, t.indexador, t.taxa, t.rating as titulo_rating, t.vencimento, t.nextPmt as titulo_nextPmt, t.securitizadora, t.agente_fiduciario, t.volume_total
                FROM crm_cri.Operations o
                LEFT JOIN crm_cri.Titulos t ON o.id = t.operationId
                WHERE o.groupId = @groupId
                ORDER BY o.dueDate DESC
            `),
            pool.request().input('groupId', sql.Int, groupId).query('SELECT * FROM crm_cri.TimelineEvents WHERE groupId = @groupId ORDER BY date DESC'),
            pool.request().input('groupId', sql.Int, groupId).query('SELECT * FROM crm_cri.PropertyGuarantees WHERE groupId = @groupId'),
            pool.request().input('groupId', sql.Int, groupId).query('SELECT status FROM crm_cri.Reviews WHERE groupId = @groupId')
        ]);

        if (groupResult.recordset.length === 0) {
            return res.status(404).json({ msg: 'Group not found' });
        }
        
        // Structure operations with their nested titulos
        const operationsMap = {};
        operationsResult.recordset.forEach(row => {
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
            group: groupResult.recordset[0],
            operations: operations,
            timeline: timelineResult.recordset,
            properties: propertiesResult.recordset,
            review: reviewResult.recordset[0] || { status: 'ok' }
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
    
    // Basic validation
    if (!title || !summary || !fullDescription || !responsible || !type) {
        return res.status(400).json({ msg: 'Please provide all required fields.' });
    }

    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('groupId', sql.Int, groupId)
            .input('date', sql.Date, new Date())
            .input('title', sql.NVarChar, title)
            .input('summary', sql.NVarChar, summary)
            .input('fullDescription', sql.NVarChar, fullDescription)
            .input('responsible', sql.NVarChar, responsible)
            .input('type', sql.NVarChar, type)
            .query(`
                INSERT INTO crm_cri.TimelineEvents (groupId, date, title, summary, fullDescription, responsible, type)
                OUTPUT INSERTED.*
                VALUES (@groupId, @date, @title, @summary, @fullDescription, @responsible, @type)
            `);
        
        res.status(201).json(result.recordset[0]);

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

    let transaction;
    try {
        const pool = await getConnection();
        transaction = new sql.Transaction(pool);
        await transaction.begin();

        const request = new sql.Request(transaction);

        // 1. Update the Economic Group's watchlistStatus
        await request
            .input('groupId_update', sql.Int, groupId)
            .input('newStatus', sql.NVarChar, newStatus)
            .query('UPDATE crm_cri.EconomicGroups SET watchlistStatus = @newStatus WHERE id = @groupId_update');

        // 2. Insert the new timeline event
        const summary = `Status de watchlist atualizado para: ${newStatus.toUpperCase()}. Motivo: ${title}`;
        const eventResult = await request
            .input('groupId_insert', sql.Int, groupId)
            .input('date', sql.Date, new Date())
            .input('title', sql.NVarChar, title)
            .input('summary', sql.NVarChar, summary)
            .input('fullDescription', sql.NVarChar, fullDescription)
            .input('responsible', sql.NVarChar, responsible)
            .input('type', sql.NVarChar, 'watchlist')
            .query(`
                INSERT INTO crm_cri.TimelineEvents (groupId, date, title, summary, fullDescription, responsible, type)
                OUTPUT INSERTED.*
                VALUES (@groupId_insert, @date, @title, @summary, @fullDescription, @responsible, @type)
            `);

        await transaction.commit();
        res.status(201).json(eventResult.recordset[0]);

    } catch (err) {
        if (transaction) {
            await transaction.rollback();
        }
        console.error('Transaction failed:', err);
        res.status(500).send('Server error during watchlist event creation.');
    }
});


module.exports = router;
