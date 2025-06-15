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

// In-memory chat history
const chatHistory = [];
const systemPrompt = {
    role: 'system',
    content: 'You are ChatGPT, a helpful assistant.',
};

// API endpoint to handle chat requests
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Add user message to history
        chatHistory.push({ role: 'user', content: message });

        const completion = await openai.chat.completions.create({
            messages: [systemPrompt, ...chatHistory],
            model: 'gpt-3.5-turbo', // Or any other model like gpt-4
        });

        const botMessage = completion.choices[0].message.content;

        // Save assistant response to history
        chatHistory.push({ role: 'assistant', content: botMessage });

        res.json({ reply: botMessage });

    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        res.status(500).json({ error: 'Failed to communicate with OpenAI' });
    }
});

// Endpoint to clear the chat history
app.post('/reset', (req, res) => {
    chatHistory.length = 0;
    res.json({ message: 'Chat history cleared' });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});