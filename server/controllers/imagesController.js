const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../utils/s3Client');
const {DeleteObjectCommand} = require('@aws-sdk/client-s3');
const db = require('../db');
require('dotenv').config();


// upload image using multer and check the right type of uploaded file
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
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            cb(new Error('Only image files are allowed!'), false);
        } else {
            cb(null, true);
        }
    },
});

const uploadImage = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({error: 'No image file uploaded or wrong file type!'});
    }
    
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
        res.status(500).json({error: 'Failed to upload image!'});
    }
};

const deleteImage = async (req, res) => {
    const imageId = req.params.id;
    
    try {
        const {rows} = await db.query(
            `SELECT url FROM images WHERE id = $1`, [imageId]
        );
        if (rows.length === 0) {
            return res.status(404).json({error: 'Image not found!'});
        }
        
        const key = rows[0].url.split('/').pop();

        await s3.send(new DeleteObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
        }));

        await db.query(
            `DELETE FROM images WHERE id = $1`, [imageId]
        );
        res.status(200).json({message: 'Image deleted successfully!'});
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Failed to delete image!'});
    }
};

// update image with new file, title, description
const updateImage = async (req, res) => {
    const imageId = req.params.id;
    const {title, description} = req.body;

    try {
        const {rows} = await db.query(
            `SELECT url FROM images WHERE id = $1`, [imageId]
        );
        if (rows.length === 0) {
            return res.status(404).json({error: 'Image not found!'});
        }

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (req.file) {
            const oldKey = rows[0].url.split('/').pop();

            await s3.send(new DeleteObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET,
                Key: oldKey,
            }));

            updates.push(`url = $${paramIndex++}`);
            values.push(req.file.location);
        }

        if (title !== undefined) {
            updates.push(`title = $${paramIndex++}`);
            values.push(title);
        }

        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(description);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({error: 'No update provided!'});
        }

        values.push(imageId);
        const updateQuery = `
            UPDATE images
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
        `;
        await db.query(updateQuery, values);
        res.status(200).json({message: 'Image updated successfully!'});
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Failed to update image!'});
    }
};

// fetch paginated list of images
const getImages = async (req, res) => {
    const {page = 1, limit = 10} = req.query;
    const offset = (page - 1) * limit;

    try {
        const {rows} = await db.query(
            `SELECT id, title, description, url, created_at
            FROM images
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2`,
            [limit, offset]
        );

        const totalRes = await db.query('SELECT COUNT(*) FROM images');
        const total = parseInt(totalRes.rows[0].count, 10);

        res.status(200).json({
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total,
            totalPages: Math.ceil(total / limit),
            images: rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Failed to fetch images!'});
    }
};

module.exports = {
    upload, 
    uploadImage,
    deleteImage,
    updateImage,
    getImages,
};