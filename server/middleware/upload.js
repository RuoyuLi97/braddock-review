const multer = require('multer');
const multerS3 = require('multer-s3');
const {s3} = require('../utils/s3Client');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

// s3Storage config
const s3Storage = multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function(req, file, cb) {
        cb(null, {
            fieldName: file.fieldname,
            originalName: file.originalname,
            uploadedBy: req.user?.id || 'anonymousa',
            uploadedAt: new Date().toISOString
        });
    },
    key: function(req, file, cb) {
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        const timestamp = Date.now();
        const fileExtension = path.extname(file.originalname).toLowerCase();

        let folder = '';
        let prefix = '';
        
        if (file.mimetype.startsWith('image/')) {
            folder = 'images';
            prefix = 'img';
        } else if (file.mimetype.startsWith('video/')) {
            folder = 'videos';
            prefix = 'vid';
        }

        const s3Key = `media/${folder}/${prefix}_${timestamp}_${uniqueSuffix}${fileExtension}`;

        req.fileMetadata = {
            originalSize: file.size,
            mimeType: file.mimetype
        };
        
        cb(null, s3Key);
    }
});

// Image filter
const imageFilter = (req, file, cb) => {
    const allowedImageTypes = [
        'image/jpg',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
    ];

    const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedImageTypes.includes(file.mimetype) && allowedImageExtensions.includes(fileExtension)) {
        cb(null, true);
    } else {
        const error = new Error(`Invalid image file type!  Allowed types: ${allowedImageExtensions.join(', ')}`);
        error.code = 'INVALID_FILE_TYPE';
        cb(error, false);
    }
};

// Video filter
const videoFilter = (req, file, cb) => {
    const allowedVideoTypes = [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-ms-wmv',
        'video/webm'
    ];

    const allowedVideoExtensions = ['.mp4', '.mpeg', '.mpg', '.mov', '.avi', '.wmv', '.webm'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedVideoTypes.includes(file.mimetype) && allowedVideoExtensions.includes(fileExtension)) {
        cb(null, true);
    } else {
        const error = new Error(`Invalid image file type!  Allowed types: ${allowedVideoExtensions.join(', ')}`);
        error.code = 'INVALID_FILE_TYPE';
        cb(error, false);
    }
};

// Media filter
const mediaFilter = (req, file, cb) => {
    const allowedMediaTypes = [
        'image/jpg', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv', 'video/webm'
    ];

    const allowedMediaExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
        '.mp4', '.mpeg', '.mpg', '.mov', '.avi', '.wmv', '.webm'
    ];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    if (allowedMediaTypes.includes(file.mimetype) && allowedMediaExtensions.includes(fileExtension)) {
        cb(null, true);
    } else {
        const error = new Error(`Invalid image file type!  Allowed types: ${allowedMediaExtensions.join(', ')}`);
        error.code = 'INVALID_FILE_TYPE';
        cb(error, false);
    }
};

// Image upload
const imageUpload = multer({
    storage: s3Storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: imageFilter
});

// Video upload
const videoUpload = multer({
    storage: s3Storage,
    limits: {
        fileSize: 100 * 1024 * 1024
    },
    fileFilter: videoFilter
});

// Media upload
const mediaUpload = multer({
    storage: s3Storage,
    limits: {
        fileSize: 100 * 1024 * 1024
    },
    fileFilter: mediaFilter
});

// Error handler
const uploadErrorHandler = (err, req, res, next) => {
    if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large!',
                details: 'File size exceeds the maximum allowed limit!'
            });
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                error: 'Too many files!',
                details: 'Number of files exceeds the maximum allowed limit!'
            });
        }

        if (err.code === 'INVALID_FILE_TYPE') {
            return res.status(400).json({
                error: 'Invalid file type!',
                details: err.message
            });
        }

        return res.status(400).json({
            error: 'Upload failed!',
            details: err.message
        });
    }
    next();
};

module.exports = {
    imageUpload,
    videoUpload,
    mediaUpload,
    uploadErrorHandler
};