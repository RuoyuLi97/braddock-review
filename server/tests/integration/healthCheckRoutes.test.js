import {describe, it, expect, afterAll} from '@jest/globals';
import request from 'supertest';
import app from '../../index.js';
import * as db from '../../db.js';

describe('Health Check Routes Integration Test', () => {
    afterAll(async() => {
        if (db.closePool) {
            await db.closePool();
        }
    });

    describe('GET /api/healthcheck', () => {
        it('should return basic health status', async() => {
            const response = await request(app).get('/api/healthcheck');
            
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/application\/json/);    

            expect(response.body).toEqual({
                status: 'healthy',
                timestamp: expect.any(String),
                uptime: expect.any(Number),
                environment: expect.any(String),
                version: expect.any(String)
            });

            expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
            expect(response.body.uptime).toBeGreaterThan(0);
        });

        it('should return consistent data structure', async() => {
            const response = await request(app).get('/api/healthcheck');
            
            expect(response.status).toBe(200);
            
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('environment');
            expect(response.body).toHaveProperty('version');

            expect(typeof response.body.status).toBe('string');
            expect(typeof response.body.timestamp).toBe('string');
            expect(typeof response.body.uptime).toBe('number');
            expect(typeof response.body.environment).toBe('string');
            expect(typeof response.body.version).toBe('string');
        });

        it('should have valid environment and version info', async() => {
            const response = await request(app).get('/api/healthcheck');
            
            expect(response.status).toBe(200);
            
            // Environment validataion
            expect(response.body.environment).toBeDefined();
            expect(response.body.environment.trim()).toBeTruthy();
            expect(['development', 'production', 'staging', 'test']).toContain(response.body.environment);

            // Version validataion
            expect(response.body.version).toBeDefined();
            expect(response.body.version).toMatch(/^\d+\.\d+\.\d+$/);
        });
    });

    describe('GET /api/healthcheck/connection', () => {
        it('should return connection health status', async() => {
            const response = await request(app).get('/api/healthcheck/connection');

            expect([200, 503]).toContain(response.status);
            expect(response.headers['content-type']).toMatch(/application\/json/);  
            
            expect(response.body).toEqual({
                status: expect.stringMatching(/^(healthy|unhealthy)$/),
                timestamp: expect.any(String),
                uptime: expect.any(Number),
                environment: expect.any(String),
                version: expect.any(String),
                responseTime: expect.stringMatching(/^\d+ms$/),
                dependencies: {
                    database: expect.objectContaining({
                        status: expect.stringMatching(/^(healthy|unhealthy)$/)
                    }),
                    s3: expect.objectContaining({
                        status: expect.stringMatching(/^(healthy|unhealthy)$/)
                    })
                }
            });

            expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });

        it('should have correct dependency structure', async() => {
            const response = await request(app).get('/api/healthcheck/connection');

            expect([200, 503]).toContain(response.status);
            const {dependencies} = response.body;
            
            expect(dependencies.database).toHaveProperty('status');
            if (dependencies.database.status === 'healthy') {
                expect(dependencies.database).toHaveProperty('message');
            } else {
                expect(dependencies.database).toHaveProperty('error');
            }

            expect(dependencies.s3).toHaveProperty('status');
            if (dependencies.s3.status === 'healthy') {
                expect(dependencies.s3).toHaveProperty('message');
            } else {
                expect(dependencies.s3).toHaveProperty('error');
            }
        });

        it('should have consistent status logic', async() => {
            const response = await request(app).get('/api/healthcheck/connection');

            const {status, dependencies} = response.body;
            const dbHealthy = dependencies.database.status === 'healthy';
            const s3Healthy = dependencies.s3.status === 'healthy';

            if (dbHealthy && s3Healthy) {
                expect(status).toBe('healthy');
                expect(response.status).toBe(200);
            } else {
                expect(status).toBe('unhealthy');
                expect(response.status).toBe(503);
            }
        });
    });

    describe('Error handling', () => {
        it('should handle non-existing routes', async() => {
            const response = await request(app).get('/api/healthcheck/nonexistent');
            expect(response.status).toBe(404);
        });

        it('should return 405 non-GET methods', async() => {
            const postResponse = await request(app).post('/api/healthcheck');
            expect(postResponse.status).toBe(405);
            expect(postResponse.body).toEqual({
                error: 'Method not allowed!',
                message: 'POST method is not supported on this endpoint!',
                allowedMethods: ['GET']
            });

            const deleteResponse = await request(app).delete('/api/healthcheck');
            expect(deleteResponse.status).toBe(405);
            expect(deleteResponse.body).toEqual({
                error: 'Method not allowed!',
                message: 'DELETE method is not supported on this endpoint!',
                allowedMethods: ['GET']
            });

            const putResponse = await request(app).put('/api/healthcheck/connection');
            expect(putResponse.status).toBe(405);
            expect(putResponse.body).toEqual({
                error: 'Method not allowed!',
                message: 'PUT method is not supported on this endpoint!',
                allowedMethods: ['GET']
            });

            const patchResponse = await request(app).patch('/api/healthcheck/connection');
            expect(patchResponse.status).toBe(405);
            expect(patchResponse.body).toEqual({
                error: 'Method not allowed!',
                message: 'PATCH method is not supported on this endpoint!',
                allowedMethods: ['GET']
            });
        });
    });

    describe('Performance tests', () => {
        it('should handle concurrent requests', async() => {
            const promises = Array(5).fill().map(() => 
                request(app).get('/api/healthcheck')
            );

            const responses = await Promise.all(promises);

            responses.forEach(response => {
                expect(response.status).toBe(200);
                expect(response.body.status).toBe('healthy');
            });
        });

        it('should response within reasonable time', async() => {
            const startTime = Date.now();

            const response = await request(app).get('/api/healthcheck/connection');
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect([200, 503]).toContain(response.status);
            expect(responseTime).toBeLessThan(5000);
        });
    });
});