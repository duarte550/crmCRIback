const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');

// Map database types to frontend event types and icons
const ICONS = {
    reviews: "M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-5 3c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm4 8H7l2.5-3.5 2 2.5 1.5-2z",
    visits: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
    settings: "M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49 1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59-1.69.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22-.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z",
    task: "M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zm0-8h14V7H7v2z",
};

/**
 * @route   GET /api/events
 * @desc    Get all upcoming events (reviews, visits, rules, tasks)
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        // Query all event sources. We only fetch future events for the calendar.
        const result = await executeQuery(`
            SELECT 
                'rev-' || CAST(r.id AS VARCHAR) as id, 
                r.nextReviewDate as date, 
                'Revisão' as title, 
                g.name as groupName, 
                g.id as groupId, 
                'Revisão' as type, 
                '${ICONS.reviews}' as icon 
            FROM crm_cri.Reviews r 
            JOIN crm_cri.EconomicGroups g ON r.groupId = g.id 
            WHERE r.nextReviewDate >= CURRENT_DATE()
            
            UNION ALL
            
            SELECT 
                'vis-' || CAST(v.id AS VARCHAR) as id, 
                v.nextVisitDate as date, 
                'Visita' as title, 
                g.name as groupName, 
                g.id as groupId, 
                'Visita' as type, 
                '${ICONS.visits}' as icon 
            FROM crm_cri.Visits v 
            JOIN crm_cri.EconomicGroups g ON v.groupId = g.id 
            WHERE v.nextVisitDate >= CURRENT_DATE()
            
            UNION ALL

            SELECT 
                'rul-' || CAST(id AS VARCHAR) as id, 
                nextExecution as date, 
                name as title, 
                'Sistema' as groupName, 
                NULL as groupId, 
                'Regra' as type, 
                '${ICONS.settings}' as icon 
            FROM crm_cri.Rules 
            WHERE nextExecution >= CURRENT_DATE()

            UNION ALL

            SELECT 
                'task-' || CAST(t.id AS VARCHAR) as id,
                t.date,
                t.title,
                g.name as groupName,
                g.id as groupId,
                'Tarefa' as type,
                '${ICONS.task}' as icon
            FROM crm_cri.Tasks t
            JOIN crm_cri.EconomicGroups g ON t.groupId = g.id
            WHERE t.date >= CURRENT_DATE() AND t.status = 'Pendente'

            ORDER BY date ASC
        `);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error while fetching events');
    }
});

/**
 * @route   POST /api/events/tasks
 * @desc    Create a new custom task
 * @access  Public
 */
router.post('/tasks', async (req, res) => {
    const { date, groupId, priority, type, responsible, title } = req.body;
    
    if (!date || !groupId || !title) {
        return res.status(400).json({ msg: 'Please provide all required fields.' });
    }

    try {
        const insertQuery = `
            INSERT INTO crm_cri.Tasks (date, groupId, priority, type, responsible, title)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await executeQuery(insertQuery, [date, groupId, priority, type, responsible, title]);

        // Re-fetch the newly created task
        const result = await executeQuery(
            'SELECT * FROM crm_cri.Tasks WHERE groupId = ? AND title = ? ORDER BY id DESC LIMIT 1',
            [groupId, title]
        );
        
        res.status(201).json(result[0]);

    } catch (err) {
        console.error(err);
        res.status(500).send('Server error while creating task.');
    }
});

module.exports = router;