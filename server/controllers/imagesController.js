const multer = require('multer');
const multerS3 = require('multer-s3');
const s3 = require('../utils/s3Client');
const {DeleteObjectCommand} = require('@aws-sdk/client-s3');
const db = require('../db');
require('dotenv').config();


// upload image using multer
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
    // check the type of uploaded file
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            cb(new Error('Only image files are allowed!'), false);
        } else {
            cb(null, true);
        }
    },
});

const uploadImage = async(req, res) => {
    console.log('Upload image called');
    console.log('req.file:', req.file);
    console.log('req.body:', req.body);
    
    if (!req.file) {
        return res.status(400).json({error: 'No image file uploaded or wrong file type!'});
    }
    
    try {
        const {user_id, title, description, designer_name, class_year, tags, longitude, latitude} = req.body;
        const imageUrl = req.file.location;

        const tagArray = tags ? tags.split(',').map(t=>t.trim()): null;
        const longitudeVal = longitude ? parseFloat(longitude) : null;
        const latitudeVal = latitude ? parseFloat(latitude) : null;

        let query;
        let values;

        if (longitudeVal !== null & latitudeVal !== null) {
            query = `INSERT INTO images (user_id, url, title, description, designer_name, class_year, tags, location)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, ST_SetSRID(ST_MakePoint($8::float8, $9::float8), 4326)::GEOGRAPHY)`;
            values = [user_id, imageUrl, title || null, description || null, designer_name || null, class_year, tagArray, longitudeVal, latitudeVal];
        } else {
            query = `INSERT INTO images (user_id, url, title, description, designer_name, class_year, tags, location)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)`;
            values = [user_id, imageUrl, title || null, description || null, designer_name || null, class_year, tagArray];
        }

        await db.query(query, values);
        res.status(200).json({message: 'Image uploaded successfully!', imageUrl});
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'Failed to upload image!'});
    }
};

const deleteImage = async(req, res) => {
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
const updateImage = async(req, res) => {
    const imageId = req.params.id;
    const {title, description, designer_name, class_year, tags, longitude, latitude} = req.body;

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

        if (designer_name !== undefined) {
            updates.push(`designer_name = $${paramIndex++}`);
            values.push(designer_name);
        }

        if (class_year !== undefined) {
            updates.push(`class_year = $${paramIndex++}`);
            values.push(class_year);
        }

        if (tags !== undefined) {
            updates.push(`tags = $${paramIndex++}`);
            values.push(tags.split(',').map(tag => tag.trim()));
        }

        if (longitude && latitude) {
            updates.push(`location = ST_SetSRID(ST_MakePoint($${paramIndex}, $${paramIndex+1}), 4326)::GEOGRAPHY`);
            values.push(longitude, latitude);
            paramIndex += 2;
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
const getImages = async(req, res) => {
    let page = parseInt(req.query.page, 10);
    let limit = parseInt(req.query.limit, 10);
    const classYearFilter = req.query.class_year;
    const designerNameFilter = req.query.designer_name;
    const tagsFilter = req.query.tags;

    // check page and limit is valid
    page = (isNaN(page) || page < 1) ? 1 : page;
    limit = (isNaN(limit) || limit < 1 || limit > 100) ? 10 : limit;

    const offset = (page - 1) * limit;

    try {
        // add filtering by class_year
        let baseQuery = 'FROM images';
        const conditions = [];
        const values = [];

        if (classYearFilter) {
            values.push(classYearFilter);
            conditions.push(`class_year = $${values.length}`);
        }

        if (designerNameFilter) {
            values.push(designerNameFilter);
            conditions.push(`designer_name = $${values.length}`);
        }

        if (tagsFilter) {
            const tagArray = tagsFilter.split(',').map(tag => tag.trim());
            values.push(tagArray);
            conditions.push(`tags && $${values.length}::text[]`);
        }

        const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

        const totalRes = await db.query(`SELECT COUNT(*) ${baseQuery}${whereClause}`, values);
        const total = parseInt(totalRes.rows[0].count, 10);
        const totalPages = Math.ceil(total / limit);

        // check page boundary
        if (page > totalPages && total > 0) {
            return res.status(404).json({error: 'Page out of range!'});
        }

        values.push(limit, offset);
        const {rows} = await db.query(
            `SELECT id, title, description, designer_name, url, class_year, tags, created_at
            ${baseQuery}${whereClause}
            ORDER BY created_at DESC
            LIMIT $${values.length - 1} OFFSET $${values.length}`,
            values
        );

        res.status(200).json({
            page, 
            limit, 
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
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