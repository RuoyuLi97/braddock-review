const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello from Express backend!');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

app.get('/api/test-db', async(req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.send(result.rows[0]);
    } catch (err) {
        res.status(500).send('DB connection failed!');
    }
});