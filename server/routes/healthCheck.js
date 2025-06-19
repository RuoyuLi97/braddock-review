const express = require('express');
const router = express.Router();
const healthCheckController = require('../controllers/healthCheckController');

router.route('/')
        .get(healthCheckController.getHealthStatus)
        .all((req, res) => {
            res.set('Allow', 'GET');
            res.status(405).json({
                error: 'Method not allowed!',
                message: `${req.method} method is not supported on this endpoint!`,
                allowedMethods: ['GET']
            });
        });

router.route('/connection')
        .get(healthCheckController.getConnectionHealthStatus)
        .all((req, res) => {
            res.set('Allow', 'GET');
            res.status(405).json({
                error: 'Method not allowed!',
                message: `${req.method} method is not supported on this endpoint!`,
                allowedMethods: ['GET']
            });
        });

module.exports = router