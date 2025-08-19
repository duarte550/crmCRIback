// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// --- Import Route Files ---
const economicGroupsRoutes = require('./routes/economicGroups');
const reviewsRoutes = require('./routes/reviews');
const visitsRoutes = require('./routes/visits');
const insurancesRoutes = require('./routes/insurances');
const appraisalsRoutes = require('./routes/appraisals');
const watchlistRoutes = require('./routes/watchlist');
const dashboardRoutes = require('./routes/dashboard');
const eventsRoutes = require('./routes/events');
const rulesRoutes = require('./routes/rules');
const searchRoutes = require('./routes/search');


const app = express();
// Use the port defined in the environment, or 3001 as a default
const port = process.env.PORT || 3001;

// --- Middlewares ---
// Enable Cross-Origin Resource Sharing for all routes, allowing the frontend to communicate with this server
app.use(cors());
// Enable the server to parse incoming requests with JSON payloads
app.use(express.json());

// --- API Routes ---
// Health check route for the API root
app.get('/', (req, res) => {
  res.send('CRM de Crédito API is running!');
});

// All routes starting with /api/ will be handled by our specialized routers
app.use('/api/economic-groups', economicGroupsRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/visits', visitsRoutes);
app.use('/api/insurances', insurancesRoutes);
app.use('/api/appraisals', appraisalsRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/rules', rulesRoutes);
app.use('/api/search', searchRoutes);


// Start the server and listen for incoming connections
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});