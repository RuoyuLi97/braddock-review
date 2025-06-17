const request = require('supertest');
const app = require('../../index');
const db = require('../../db');
const fs = require('fs');
const path = require('path');

describe('Image API integration tests', () => {
    let testUserId;
    let uploadedImageId;

    // insert a test user
    beforeAll(async() => {
        const result = await db.query(
            `INSERT INTO users (username, email, password_hash, role)
            VALUES ('testuser', 'test@example.com', 'hashedpassword', 'designer') RETURNING id`
        );

        testUserId = result.rows[0].id;
        console.log('Created test user with ID:', testUserId);
    });

    // clean up db after tests
    afterAll(async() => {
        await db.query('DELETE FROM images WHERE user_id = $1', [testUserId]);
        await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
        await db.end();
    });

    // uploadImage Integraiton Test
    it('should upload an image successfully', async() => {
        const response = await request(app)
                                .post('/api/images')
                                .field('user_id', testUserId)
                                .field('title', 'Test Image')
                                .field('class_year', 2025)
                                .attach('image', path.join(__dirname, '../../test_assets/test_dog.jpg'));
        
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('imageUrl');

        const dbRes = await db.query(
            `SELECT id FROM images WHERE url = $1`,
            [response.body.imageUrl]
        );

        uploadedImageId = dbRes.rows[0].id;
        console.log('Upload image response:', response.body);
        console.log('Uploaded image ID:', uploadedImageId);
    });

    // getImages Integraiton Test
    it('should fetch images with pagination and filtering', async() => {
        const response = await request(app)
                                .get('/api/images')
                                .query({page:1, limit:10, class_year: 2025});
        
        expect(response.statusCode).toBe(200);
        expect(Array.isArray(response.body.images)).toBe(true);
        expect(response.body.images.length).toBeGreaterThanOrEqual(1);

        const image = response.body.images.find(img => img.id === uploadedImageId);
        expect(image).toBeDefined();
        expect(image.title).toBe('Test Image');
    });

    // updateImage Integraiton Test
    it('should update image title and tags', async() => {
        const response = await request(app)
                                .patch(`/api/images/${uploadedImageId}`)
                                .field('title', 'New title')
                                .field('tags', 'tag1, tag2')
        
        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe('Image updated successfully!');

        const dbRes = await db.query('SELECT title, tags FROM images WHERE id = $1', [uploadedImageId]);
        expect(dbRes.rows[0].title).toBe('New title');
        expect(dbRes.rows[0].tags).toEqual(['tag1', 'tag2']);
    });

    // deleteImage Integraiton Test
    it('should delete the image', async() => {
        const response = await request(app)
                                .delete(`/api/images/${uploadedImageId}`);
        
        expect(response.statusCode).toBe(200);
        expect(response.body.message).toBe('Image deleted successfully!');

        const dbRes = await db.query('SELECT * FROM images WHERE id = $1', [uploadedImageId]);
        expect(dbRes.rows.length).toBe(0);
    });
});