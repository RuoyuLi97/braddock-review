const express = require('express');
const cors = require('cors');
require('dotenv').config();

const imageRouter = require('./routes/images');

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

app.use('/api/images', imageRouter);