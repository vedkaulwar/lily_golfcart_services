const express = require('express');
const path = require('path');
const indexRoutes = require('./routes/indexRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

// Configure EJS and static folder
app.set('view engine', 'ejs');
// Resolve the views directory correctly relative to src/
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/', indexRoutes);
app.use('/api', apiRoutes);

module.exports = app;
