const express = require('express');
const router = express.Router();
const { getConnection } = require('../config/db');

const formatToMillionsBRL = (value) => {
  if (value === undefined || value === null) return 'N/A';
  if (value < 1000000) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  }
  const millions = value / 1000000;
  const formatted = millions.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `R$ ${formatted}M`;
};

/**
 * @route   GET /api/dashboard
 * @desc    Get consolidated data for the dashboard view
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Fetch metrics and upcoming events in parallel
    const [metricsResult, eventsResult] = await Promise.all([
        pool.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM crm_cri.Operations) as totalOperations,
                (SELECT COUNT(*) FROM crm_cri.Tasks WHERE status = 'Pendente' AND date < GETDATE()) as overdueTasks,
                (SELECT SUM(currentVolume) FROM crm_cri.EconomicGroups WHERE watchlistStatus IN ('ok')) as healthyVolume,
                (SELECT SUM(currentVolume) FROM crm_cri.EconomicGroups WHERE watchlistStatus IN ('attention', 'problem', 'critical')) as watchlistVolume
        `),
        pool.request().query(`
            SELECT TOP 3 date, title FROM (
                SELECT nextReviewDate as date, 'Próxima Revisão - ' + g.name as title FROM crm_cri.Reviews r JOIN crm_cri.EconomicGroups g ON r.groupId = g.id WHERE nextReviewDate >= GETDATE()
                UNION ALL
                SELECT nextVisitDate as date, 'Próxima Visita - ' + g.name as title FROM crm_cri.Visits v JOIN crm_cri.EconomicGroups g ON v.groupId = g.id WHERE nextVisitDate >= GETDATE()
                UNION ALL
                SELECT nextExecution as date, name as title FROM crm_cri.Rules WHERE nextExecution >= GETDATE()
                UNION ALL
                SELECT date, title FROM crm_cri.Tasks WHERE date >= GETDATE() AND status = 'Pendente'
            ) as upcoming_events
            ORDER BY date ASC
        `)
    ]);

    const metricsData = metricsResult.recordset[0];
    const dashboardData = {
        metrics: [
            { title: 'Volume total de operações saudáveis', value: formatToMillionsBRL(metricsData.healthyVolume) },
            { title: 'Volume total de operações watchlist', value: formatToMillionsBRL(metricsData.watchlistVolume) },
            { title: 'Total de operações', value: metricsData.totalOperations.toString() },
            { title: 'Eventos do mês', value: '12' }, // Mocked for now
            { title: 'Tarefas em atraso', value: metricsData.overdueTasks.toString() },
        ],
        upcomingEvents: eventsResult.recordset
    };

    res.json(dashboardData);

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error while fetching dashboard data');
  }
});

module.exports = router;
