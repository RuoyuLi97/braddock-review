const {body, validationResult} = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');

// Validator functions
const validators = {
    // Username
    username: (isOptional=false) => {
        const validator = body('username');
        
        if (isOptional) {
            validator.optional();
        }

        return validator
                .isLength({min:3, max:50})
                .withMessage('Username must be 3-50 characters long!')
                .matches(/^[a-zA-Z0-9_-]+$/)
                .withMessage('Username can only contain letter, number, undescore, and hyphen!')
                .escape()
                .trim();
    },

    // Email
    email: (isOptional=false) => {
        const validator = body('email');
        
        if (isOptional) {
            validator.optional();
        }

        return validator
                .isLength({max:100})
                .withMessage('Email must not exceed 100 characters!')
                .isEmail()
                .withMessage('Please provide a valid email address!')
                .normalizeEmail();
    },

    // Password
    password: (fieldName='password', complexity='full') => {
        const validator = body(fieldName);

        switch (complexity) {
            case 'full':
                return validator
                        .isLength({min: 8, max: 128})
                        .withMessage(`${fieldName} must be 8-128 characters long!`)
                        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[a-zA-Z\d@$!%*?&]+$/)
                        .withMessage(`${fieldName} must contain lowercase, uppercase, number, and special character(@$!%*?&)!`);
            
            case 'login':
                return validator
                        .notEmpty()
                        .withMessage(`${fieldName} is required!`)
                        .isLength({max: 128})
                        .withMessage(`${fieldName} is too long!`);
            
            default: 
                return validator.notEmpty();
        }
    },

    confirmPasswordMatch: (newPasswordField='newPassword') => body('confirmPassword')
        .custom((value, {req}) => {
            if (value !== req.body[newPasswordField]) {
                throw new Error('Password confirmation does not match new password!');
            }
            return true;
        }),

    // Text
    simpleText: (fieldName, minLength=1, maxLength=200, isOptional=false) => {
        const validator = body(fieldName);

        if (isOptional) {
            validator.optional();
        }

        return validator
                .isLength({min: minLength, max: maxLength})
                .withMessage(`${fieldName} must be ${minLength}-${maxLength} characters long!`)
                .escape()
                .trim();
    },

    longText: (fieldName, maxLength, allowedTags=['b', 'i', 'em', 'strong', 'p', 'br'], isOptional=true) => {
        const validator = body(fieldName);

        if (isOptional) {
            validator.optional();
        }

        return validator
                .isLength({max: maxLength})
                .withMessage(`${fieldName} must not exceed ${maxLength} characters!`)
                .customSanitizer(value => {
                    if (!value) return value;
                    return DOMPurify.sanitize(value, {
                        ALLOWED_TAGS: allowedTags,
                        ALLOWED_ATTR: []
                    });
                });
    },

    // Integer
    integer: (fieldName, min=1, max=null, isOptional=false) => {
        const validator = body(fieldName);
        
        if (isOptional) {
            validator.optional();
        }

        const options = {min};
        if (max != null) {
            options.max = max;
        }

        return validator
                .isInt(options)
                .withMessage(`${fieldNmae} must be a valid integer ${max ? `between ${min} and ${max}` : `minimun ${min}`}!`);
    },

    // Enum
    enum: (fieldName, allowedValues, isOptional=false) => {
        const validator = body(fieldName);

        if (isOptional) {
            validator.optional();
        }

        return validator
                .isIn(allowedValues)
                .withMessage(`${fieldName} must be one of: ${allowedValues.join(', ')}!`);
    },
    
    // URL
    url: (fieldName, isOptional=false) => {
        const validator = body(fieldName);

        if (isOptional) {
            validator.optional();
        }

        return validator
                .isURL()
                .withMessage(`${fieldName} must be a valid URL!`);
    },

    // Location
    location: (fieldName, isOptional=true) => {
        const validator = body(fieldName);

        if (isOptional) {
            validator.optional();
        }

        return validator
                .custom(location => {
                    if (!location) return true;
                    
                    if (typeof location != 'object' || 
                        location.type !== 'Point' ||
                        !Array.isArray(location.coordinates) ||
                        location.coordinates.length !== 2) {
                            throw new Error('Location must be a valid GeoJSON Point!');
                    }

                    const [lon, lat] = location.coordinates;
                    if (typeof lon !== 'number' || typeof lat !== 'number' || 
                        lon < -180 || long > 180 || lat < -90 || lat > 90) {
                            throw new Error('Location coordinates must be valid longitude (-180 to 180) and latitude (-90 to 90)!');
                    }

                    return true;
                });
    } 
};

// Validations
// Registration
const registerValidation = [
    validators.username(false),
    validators.email(false),
    validators.password('password', 'full'),
    validators.enum('role', ['designer', 'viewer'], false)
];

// Login
const loginValidation = [
    validators.email(false),
    validators.password('password', 'login')
];

// Update profile
const profileUpdateValidation = [
    validators.username(true),
    validators.email(true)
];

// Change password
const passwordChangeValidation = [
    validators.password('currentPassword', 'login'),
    validators.password('newPassword', 'full'),
    validators.confirmPasswordMatch('newPassword')
];

// Design
const designValidation = [
    validators.simpleText('title', 1, 200, false),
    validators.longText('description', 10000, ['b', 'i', 'em', 'strong', 'p', 'br'], true),
    validators.simpleText('designer_name', 1, 100, true),
    validators.integer('class_year', 1900, 2100, false)
];

// Tag
const tagValidation = [
    validators.simpleText('name', 1, 50, false),
    validators.simpleText('slug', 1, 50, false),
    validators.longText('description', 1, 1000, ['b', 'i', 'em', 'strong', 'p', 'br'], true)
];

// Design block
const designBlockValidation = [
    validators.simpleText('block_type', 1, 50, false),
    validators.simpleText('title', 1, 200, true),
    validators.longText('content', 50000, ['b', 'i', 'em', 'strong', 'p', 'br'], true),
    validators.integer('display_order', 0, null, false)
];

// Media
const mediaValidation = [
    validators.enum('media_type', ['design_image', 'video', 'icon', 'backstage_photo', 'map_dot'], false),
    validators.simpleText('title', 1, 200, true),
    validators.longText('description', 2000, ['b', 'i', 'em', 'strong', 'p', 'br'], true),
    validators.url('url', false),
    validators.integer('duration', 0, null, true),
    validators.url('thumbnail_url', true),
    validators.location('location', true),
    validators.integer('class_year', 1900, 2100, true)
];

// Comment
const commentValidation = [
    validators.integer('design_block_id', 1, null, true),
    validators.integer('parent_comment_id', 1, null, true),
    validators.longText('comment_text', 5000, ['b', 'i', 'em', 'strong', 'p', 'br'], false)
];

// Error handler
const errorHandler = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(error => ({
            field: error.path,
            message: error.msg,
            value: error.value
        }));

        console.warn(`VALIDATION ERROR: ${req.ip} - ${req.method} ${req.path}`, errorMessages);

        return res.status(400).json({
            error: 'Validation failed!',
            details: errorMessages
        });
    }

    next();
};

module.exports = {
    registerValidation,
    loginValidation,
    profileUpdateValidation,
    passwordChangeValidation,
    designValidation,
    tagValidation,
    designBlockValidation,
    mediaValidation,
    commentValidation,
    errorHandler
};