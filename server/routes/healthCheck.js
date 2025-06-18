const express = require('express');
const router = express.Router();
const healthCheckController = require('../controllers/healthCheckController');

router.get('/', healthCheckController.getHealthStatus);
router.get('/connection', healthCheckController.getConnectionHealthStatus);

module.exports = router