const express = require('express');
const routes = require('./routes');

const app = express();

// Standard Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', routes);

const errorHandler = require('./middleware/errorHandler');

// Global Error Handler Middleware
app.use(errorHandler);

module.exports = app;
