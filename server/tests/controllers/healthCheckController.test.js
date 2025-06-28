import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

const mockTestDatabaseConnection = jest.fn();
const mockTestS3Connection = jest.fn();

jest.unstable_mockModule('../../db.js', () => ({
    testDatabaseConnection: mockTestDatabaseConnection,
    query: jest.fn(),
    connect: jest.fn(),
    pool: {},
    closePool: jest.fn()
}));

jest.unstable_mockModule('../../utils/s3Client.js', () => ({
    testS3Connection: mockTestS3Connection,
    s3: {}
}));

const {getHealthStatus, getConnectionHealthStatus} = await import('../../controllers/healthCheckController.js');

describe('Health Check Controller', () => {
    let mockReq, mockRes;
    
    beforeEach(() => {
        jest.clearAllMocks();

        mockReq = {};
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        jest.spyOn(process, 'uptime').mockReturnValue(3600);

        process.env.NODE_ENV = 'test';
        process.env.npm_package_version = '1.0.0';
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getHealthStatus', () => {
        it('should return healthy status with basic info', async() => {
            await getHealthStatus(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                status: 'healthy',
                timestamp: expect.any(String),
                uptime: 3600,
                environment: 'test',
                version: '1.0.0'
            });
        });

        it('should handle error when failed', async() => {
            jest.spyOn(process, 'uptime').mockImplementation(() => {
                throw new Error('Process error');
            });

            await getHealthStatus(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                status: 'unhealthy',
                timestamp: expect.any(String),
                error: 'Process error'
            });
        });
    });

    describe('getConnectionHealthStatus', () => {
        it('should return healthy status when both connections are healthy', async() => {
            mockTestDatabaseConnection.mockResolvedValue({
                status: 'healthy', 
                message: 'Database connection succeeded!'
            });

            mockTestS3Connection.mockResolvedValue({
                status: 'healthy', 
                message: 'S3 connection succeeded!'
            });

            await getConnectionHealthStatus(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'healthy',
                    uptime: 3600,
                    environment: 'test',
                    version: '1.0.0',
                    dependencies: {
                        database: {
                            status: 'healthy', 
                            message: 'Database connection succeeded!'
                        },
                        s3: {
                            status: 'healthy', 
                            message: 'S3 connection succeeded!'
                        }
                    }
                })
            );

            expect(mockTestDatabaseConnection).toHaveBeenCalledTimes(1);
            expect(mockTestS3Connection).toHaveBeenCalledTimes(1);
        });

        it('should return unhealthy status when database connection failed', async() => {
            mockTestDatabaseConnection.mockRejectedValue(new Error('Database connection failed!'));

            mockTestS3Connection.mockResolvedValue({
                status: 'healthy', 
                message: 'S3 connection succeeded!'
            });

            await getConnectionHealthStatus(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(503);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'unhealthy',
                    dependencies: {
                        database: {
                            status: 'unhealthy', 
                            error: 'Database connection failed!'
                        },
                        s3 : {
                            status: 'healthy', 
                            message: 'S3 connection succeeded!'
                        }
                    }
                })
            );
        });

        it('should return unhealthy status when s3 connection failed', async() => {
            mockTestDatabaseConnection.mockResolvedValue({
                status: 'healthy', 
                message: 'Database connection succeeded!'
            });

            mockTestS3Connection.mockRejectedValue(new Error('S3 connection failed!'));

            await getConnectionHealthStatus(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(503);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'unhealthy',
                    dependencies: {
                        database: {
                            status: 'healthy', 
                            message: 'Database connection succeeded!'
                        },
                        s3 : {
                            status: 'unhealthy', 
                            error: 'S3 connection failed!'
                        }
                    }
                })
            );
        });

        it('should handle error without message property', async() => {
            mockTestDatabaseConnection.mockRejectedValue({code: 'ECONNREFUSED'});

            mockTestS3Connection.mockResolvedValue({
                status: 'healthy', 
                message: 'S3 connection succeeded!'
            });

            await getConnectionHealthStatus(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(503);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    dependencies: {
                        database: {
                            status: 'unhealthy', 
                            error: 'Connection failed!'
                        },
                        s3 : expect.any(Object)
                    }
                })
            );
        });
    })
})