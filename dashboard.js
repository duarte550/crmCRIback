const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/db');

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
    // Fetch metrics and upcoming events in parallel
    const [metricsResult, eventsResult] = await Promise.all([
        executeQuery(`
            SELECT 
                (SELECT COUNT(*) FROM crm_cri.Operations) as totalOperations,
                (SELECT COUNT(*) FROM crm_cri.Tasks WHERE status = 'Pendente' AND date < CURRENT_DATE()) as overdueTasks,
                (SELECT SUM(currentVolume) FROM crm_cri.EconomicGroups WHERE watchlistStatus IN ('ok')) as healthyVolume,
                (SELECT SUM(currentVolume) FROM crm_cri.EconomicGroups WHERE watchlistStatus IN ('attention', 'problem', 'critical')) as watchlistVolume
        `),
        executeQuery(`
            SELECT date, title FROM (
                SELECT nextReviewDate as date, 'Próxima Revisão - ' || g.name as title FROM crm_cri.Reviews r JOIN crm_cri.EconomicGroups g ON r.groupId = g.id WHERE nextReviewDate >= CURRENT_DATE()
                UNION ALL
                SELECT nextVisitDate as date, 'Próxima Visita - ' || g.name as title FROM crm_cri.Visits v JOIN crm_cri.EconomicGroups g ON v.groupId = g.id WHERE nextVisitDate >= CURRENT_DATE()
                UNION ALL
                SELECT nextExecution as date, name as title FROM crm_cri.Rules WHERE nextExecution >= CURRENT_DATE()
                UNION ALL
                SELECT date, title FROM crm_cri.Tasks WHERE date >= CURRENT_DATE() AND status = 'Pendente'
            ) as upcoming_events
            ORDER BY date ASC
            LIMIT 3
        `)
    ]);

    const metricsData = metricsResult[0];
    const dashboardData = {
        metrics: [
            { title: 'Volume total de operações saudáveis', value: formatToMillionsBRL(metricsData.healthyVolume) },
            { title: 'Volume total de operações watchlist', value: formatToMillionsBRL(metricsData.watchlistVolume) },
            { title: 'Total de operações', value: String(metricsData.totalOperations) },
            { title: 'Eventos do mês', value: '12' }, // Mocked for now
            { title: 'Tarefas em atraso', value: String(metricsData.overdueTasks) },
        ],
        upcomingEvents: eventsResult
    };

    res.json(dashboardData);

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error while fetching dashboard data');
  }
});

module.exports = router;