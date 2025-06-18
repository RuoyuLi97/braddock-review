const {S3Client, HeadBucketCommand} = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Test s3 connection
const testS3Connection = async() => {
    try {
        await s3.send(new HeadBucketCommand({Bucket:process.env.AWS_S3_BUCKET}));
        return {
            status: 'healthy', 
            message: 'S3 connection succeeded!'
        };
    } catch (error) {
        console.error('S3 connection failed!', error.message);
        return {
            status: 'unhealthy', 
            message: 'S3 connection failed!', 
            error: error.message
        };
    }
};

module.exports = {s3, testS3Connection};