const {upload, uploadImage, deleteImage, updateImage, getImages} = require('../../controllers/imagesController');
const db = require('../../db');
const s3 = require('../../utils/s3Client');
const {DeleteObjectCommand} = require('@aws-sdk/client-s3');

jest.mock('../../db');
jest.mock('../../utils/s3Client');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res)
    return res;
};

beforeEach(() => {
    jest.clearAllMocks();
});

// unit test for uploadImage
describe('uploadImage', () => {
    it('should return 400 if no file is uploaded', async() => {
        const req = {file: null};
        const res = mockRes();

        await uploadImage(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({error: 'No image file uploaded or wrong file type!'})
    });

    it('should upload image and insert into DB', async() => {
        const req = {
            file: {location:'http://test.com/image/jpg'},
            body: {
                user_id: 1,
                title: 'title',
                description: 'desc',
                designer_name: 'Kristen Li',
                class_year: 2025,
                tags: 'tag1, tag2',
                longitude: '120.5',
                latitude: '35.4',
            }
        };
        const res = mockRes();

        db.query.mockResolvedValueOnce();

        await uploadImage(req, res);

        expect(db.query).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({message: 'Image uploaded successfully!', imageUrl: 'http://test.com/image/jpg'})
    });
});

// unit test for upload fileFilter
describe('fileFilter', () => {
    it('should accpet image files', (done) => {
        const req = {};
        const file = {mimetype: 'image/jpeg'};

        const cb = (err, accept) => {
            expect(err).toBeNull();
            expect(accept).toBe(true);
            done();
        };

        upload.fileFilter(req, file, cb);
    });

    it ('should reject non-image files', (done) => {
        const req = {};
        const file = {mimetype: 'application/pdf'};

        const cb = (err, accept) => {
            expect(err).toEqual(new Error('Only image files are allowed!'));
            expect(accept).toBe(false);
            done();
        };
        
        upload.fileFilter(req, file, cb);
    });
});

// unit test for deleteImage
describe('deleteImage', () => {
    it('should return 404 if image not found', async() => {
        const req = {params: {id: '1'}};
        const res = mockRes();

        db.query.mockResolvedValueOnce({rows: []});

        await deleteImage(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({error: 'Image not found!'});
    });

    it('should delete image from s3 and DB', async() => {
        const req = {params: {id: '1'}};
        const res = mockRes();
        const testUrl = 'https://bucket.s3.amazonaws.com/image.jpg'

        db.query.mockResolvedValueOnce({rows: [{url: testUrl}]});
        db.query.mockResolvedValueOnce({});

        await deleteImage(req, res);

        expect(s3.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
        expect(db.query).toHaveBeenCalledTimes(2);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({message: 'Image deleted successfully!'});
    });
});

// unit test for updateImage
describe('updateImage', () => {
    it('should return 404 if image not found', async() => {
        const req = {params: {id: '1'}, body: {}};
        const res = mockRes();

        db.query.mockResolvedValueOnce({rows: []});

        await updateImage(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({error: 'Image not found!'});
    });

    it('should return 400 if no updates provided', async() => {
        const req = {params: {id: '1'}, body: {}, file: undefined};
        const res = mockRes();

        db.query.mockResolvedValueOnce({rows: [{url: 'https://bucket.s3.amazonaws.com/image.jpg'}]});

        await updateImage(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({error: 'No update provided!'});
    });

    it('should update image with file and fields', async() => {
        const req = {
            params: {id: '1'},
            file: {location: 'http://new.image.jpg'},
            body: {
                title: 'new title',
                description: 'new desc',
                designer_name: 'LRY',
                class_year: 2026,
                tags: 'tag1, tag2',
                longitude: 120.5,
                latitude: 35.4
            }
        };
        const res = mockRes();

        db.query.mockResolvedValueOnce({rows: [{url: 'https://bucket.s3.amazonaws.com/oldimage.jpg'}]});
        s3.send.mockResolvedValueOnce();
        db.query.mockResolvedValueOnce();

        await updateImage(req, res);

        expect(s3.send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
        expect(db.query).toHaveBeenCalledTimes(2);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({message: 'Image updated successfully!'});
    });
});

// unit test for getImages
describe('getImages', () => {
    it('should return 404 if page out of range', async() => {
        const req = {query: {page: '5', limit: '10'}};
        const res = mockRes();

        db.query.mockResolvedValueOnce({rows: [{count: '10'}]});

        await getImages(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({error: 'Page out of range!'});
    });

    it('should return paginated images', async() => {
        const req = {query: {page: '1', limit: '10'}};
        const res = mockRes();

        db.query.mockResolvedValueOnce({rows: [{count: '15'}]});
        db.query.mockResolvedValueOnce({rows: [
            {id: 1, title: 'title', description: 'desc', designer_name: 'Kristen Li', url: 'url', class_year: 2025, tags: ['tag1'], created_at: new Date()}
        ]});

        await getImages(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            page: 1, 
            limit: 10,
            total: 15,
            totalPages: 2,
            hasNextPage: true,
            hasPrevPage: false,
            images: expect.any(Array),
        }));
    });
});