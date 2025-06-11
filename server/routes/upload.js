const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
const {S3Client} = require('@aws-sdk/client-s3');
const db = require('../db');
require('dotenv').config();

const router = express.Router();

const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const upload = multer({
    storage: multerS3({
        s3: s3,
        bucket: process.env.AWS_S3_BUCKET,
        metadata: (req, file, cb) => {
            cb(null, {fieldName: file.fieldname});
        },
        key: (req, file, cb) => {
            const filename = `${Date.now()}-${file.originalname}`;
            cb(null, filename);
        },
    }),
});

router.post('/', upload.single('image'), async (req, res) => {
    try {
        const {user_id, description} = req.body;
        const imageUrl = req.file.location;

        await db.query(
            `INSERT INTO images (user_id, url, description) VALUES ($1, $2, $3)`,
            [user_id, imageUrl, description]
        );
        res.status(200).json({message: 'Image uploaded successfully!', imageUrl});
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Upload failed!'});
    }
});

module.exports = router;