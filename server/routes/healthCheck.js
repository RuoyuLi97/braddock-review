import express from 'express';
import * as healthCheckController from '../controllers/healthCheckController.js';

const router = express.Router();

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

export default router;