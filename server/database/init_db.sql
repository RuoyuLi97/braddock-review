DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS media;
DROP TABLE IF EXISTS design_blocks;
DROP TABLE IF EXISTS block_media;
DROP TABLE IF EXISTS designs;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS design_tags;
DROP TABLE IF EXISTS users;

CREATE EXTENSION IF NOT EXISTS postgis;

-- Users: viewer/designers
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('designer', 'viewer')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Designs: each student's overall design work
CREATE TABLE designs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    designer_name VARCHAR(100),
    class_year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tags: normalized tag system
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Design Tags: many-to-many relationship between designs and tags
CREATE TABLE design_tags (
    id SERIAL PRIMARY KEY,
    design_id INTEGER REFERENCES designs(id) ON DELETE CASCADE NOT NULL,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(design_id, tag_id)
);

-- Design blocks: sections/parts of each design page (analysis, master plan, etc.)
CREATE TABLE design_blocks (
    id SERIAL PRIMARY KEY,
    design_id INTEGER REFERENCES designs(id) ON DELETE CASCADE,
    block_type VARCHAR(50) NOT NULL,
    title VARCHAR(200),
    content TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    layout_type VARCHAR(50) DEFAULT 'default',
    layout_settings JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Media: design images/videos/icons/backstage/map dots linked to designs and/or design blocks
CREATE TABLE media (
    id SERIAL PRIMARY KEY,
    design_id INTEGER REFERENCES designs(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    media_type VARCHAR(20) NOT NULL CHECK(media_type IN ('design_image', 'video', 'icon', 'backstage_photo', 'map_dot')),
    title VARCHAR(200),
    description TEXT,
    url TEXT NOT NULL,
    duration INTEGER, -- for video duration
    thumbnail_url TEXT, -- for video url
    location GEOGRAPHY(Point, 4326), -- for map dots
    class_year INTEGER,
    alt_text TEXT,
    caption TEXT,
    file_size INTEGER,
    dimension JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Block Media: many-to-many between design_blocks and media with layout positioning
CREATE TABLE block_media (
    id SERIAL PRIMARY KEY,
    design_block_id INTEGER REFERENCES design_blocks(id) ON DELETE CASCADE NOT NULL,
    media_id INTEGER REFERENCES media(id) ON DELETE CASCADE NOT NULL,
    position_order INTEGER NOT NULL DEFAULT 0,
    layout_position VARCHAR(50),
    media_config JSONB,
    text_overlay JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(design_block_id, media_id)
);

-- Comments: with threaded replies and read/unread tracking
CREATE TABLE comments(
    id SERIAL PRIMARY KEY,
    design_id INTEGER REFERENCES designs(id) ON DELETE CASCADE NOT NULL,
    design_block_id INTEGER REFERENCES design_blocks(id) ON DELETE CASCADE,
    parent_comment_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    comment_text TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
-- Designs indexing
CREATE INDEX idx_designs_user_id ON designs(user_id);
CREATE INDEX idx_designs_class_year ON designs(class_year);

-- Tags indexing
CREATE INDEX idx_tags_name ON tags(name);
CREATE INDEX idx_tags_slug ON tags(slug);

-- Design Tags indexing
CREATE INDEX idx_design_tags_design_id ON design_tags(design_id);
CREATE INDEX idx_design_tags_tag_id ON design_tags(tag_id);

-- Design blocks indexing
CREATE INDEX idx_design_blocks_design_id ON design_blocks(design_id);
CREATE INDEX idx_design_blocks_display_order ON design_blocks(design_id, display_order);
CREATE INDEX idx_design_blocks_layout_type ON design_blocks(layout_type);

-- Media indexing
CREATE INDEX idx_media_design_id ON media(design_id);
CREATE INDEX idx_media_user_id ON media(user_id);
CREATE INDEX idx_media_media_type ON media(media_type);
CREATE INDEX idx_media_location ON media USING GIST(location);

-- Block Media indexing
CREATE INDEX idx_block_media_design_block_id ON block_media(design_block_id);
CREATE INDEX idx_block_media_media_id ON block_media(media_id);
CREATE INDEX idx_block_media_position_order ON block_media(design_block_id, position_order);

-- Comment indexing
CREATE INDEX idx_comments_design_id ON comments(design_id);
CREATE INDEX idx_comments_design_block_id ON comments(design_block_id);
CREATE INDEX idx_comments_parent_comment_id ON comments(parent_comment_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_is_read ON comments(is_read);

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create trigger for all tables with updated_at
-- Users
CREATE TRIGGER updated_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Designs
CREATE TRIGGER updated_designs_updated_at
    BEFORE UPDATE ON designs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Design blocks
CREATE TRIGGER updated_design_blocks_updated_at
    BEFORE UPDATE ON design_blocks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Media
CREATE TRIGGER updated_media_updated_at
    BEFORE UPDATE ON media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Block Media
CREATE TRIGGER updated_media_updated_at
    BEFORE UPDATE ON block_media
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
CREATE TRIGGER updated_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
