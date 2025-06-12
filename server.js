const express = require('express');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = 3000;

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Serve static files from the 'public' directory
app.use(express.static('public'));
// Middleware to parse JSON bodies
app.use(express.json());

// Main route to serve the chat page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to handle chat requests
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: message }],
            model: 'gpt-3.5-turbo', // Or any other model like gpt-4
        });

        const botMessage = completion.choices[0].message.content;
        res.json({ reply: botMessage });

    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        res.status(500).json({ error: 'Failed to communicate with OpenAI' });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});