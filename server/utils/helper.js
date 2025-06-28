// Generate URL-friendly slug from text
const generateSlug = (text) => {
    if (!text || typeof text !== 'string') {
        return '';
    }

    return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
};

// Format file size in bytes to human-readable format
const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0)return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

// Generate video thumbnail URL (placeholder)
const generateThumbnail = (videoUrl) => {
    if (!videoUrl) return null;

    return null;
};

export {
    generateSlug,
    formatFileSize,
    generateThumbnail
};