import {getHealthStatus, getConnectionHealthStatus} from '../../controllers/healthCheckController.js';
import {testDatabaseConnection} from '../../db.js';
import {testS3Connection} from '../../utils/s3Client.js';

jest.mock('../../db', () => ({
    testDatabaseConnection: jest.fn()
}));

jest.mock('../../utils/s3Client', () => ({
    testS3Connection: jest.fn()
}));

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
            testDatabaseConnection.mockResolvedValue({
                status: 'healthy', 
                message: 'Database connection succeeded!'
            });

            testS3Connection.mockResolvedValue({
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
                        s3 : {
                            status: 'healthy', 
                            message: 'S3 connection succeeded!'
                        }
                    }
                })
            );

            expect(testDatabaseConnection).toHaveBeenCalledTimes(1);
            expect(testS3Connection).toHaveBeenCalledTimes(1);
        });

        it('should return unhealthy status when database connection failed', async() => {
            testDatabaseConnection.mockRejectedValue(new Error('Database connection failed!'));

            testS3Connection.mockResolvedValue({
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
            testDatabaseConnection.mockResolvedValue({
                status: 'healthy', 
                message: 'Database connection succeeded!'
            });

            testS3Connection.mockRejectedValue(new Error('S3 connection failed!'));

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
            testDatabaseConnection.mockRejectedValue({code: 'ECONNREFUSED'});

            testS3Connection.mockResolvedValue({
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