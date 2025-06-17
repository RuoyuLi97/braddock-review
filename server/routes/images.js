const express = require('express');
const {upload, uploadImage, deleteImage, updateImage, getImages} = require('../controllers/imagesController');

const router = express.Router();

router.get('/', getImages);
router.post('/', upload.single('image'), uploadImage);
router.delete('/:id', deleteImage);
router.patch('/:id', upload.single('image'), updateImage);

module.exports = router;