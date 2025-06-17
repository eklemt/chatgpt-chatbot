const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');
require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = 3000;

app.use(
    session({
        secret: process.env.SESSION_SECRET || 'keyboard cat',
        resave: false,
        saveUninitialized: false,
    })
);

const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        return [];
    }
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(data) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

let users = loadUsers();

function findUser(email) {
    return users.find(u => u.email === email);
}

function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login.html');
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('Forbidden');
    }
    next();
}

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Serve static files from the 'public' directory
app.use(express.static('public'));
// Middleware to parse JSON bodies
app.use(express.json());

// Main route to serve the chat page
app.get('/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/send-magic-link', async (req, res) => {
    const { email } = req.body;
    const user = findUser(email);
    if (!user) {
        return res.json({ message: 'If the email exists, a link was sent.' });
    }
    const token = uuidv4();
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    user.magicToken = hash;
    user.magicTokenExpires = Date.now() + 15 * 60 * 1000;
    saveUsers(users);
    const loginUrl = `http://localhost:${port}/magic-login?token=${token}&email=${encodeURIComponent(email)}`;
    if (process.env.SMTP_HOST) {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        await transporter.sendMail({
            from: process.env.MAIL_FROM || process.env.SMTP_USER,
            to: email,
            subject: 'Your login link',
            text: `Click to login: ${loginUrl}`,
        });
    } else {
        console.log(`Magic login link for ${email}: ${loginUrl}`);
    }
    res.json({ message: 'If the email exists, a link was sent.' });
});

app.get('/magic-login', (req, res) => {
    const { token, email } = req.query;
    const user = findUser(email);
    if (!user || !user.magicToken) return res.status(400).send('Invalid link');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    if (user.magicToken !== hash || Date.now() > user.magicTokenExpires) {
        return res.status(400).send('Invalid or expired link');
    }
    delete user.magicToken;
    delete user.magicTokenExpires;
    saveUsers(users);
    req.session.user = { email: user.email, role: user.role };
    res.redirect('/');
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login.html');
    });
});

app.get('/admin', requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.post('/admin/create-user', requireAdmin, (req, res) => {
    const { email, role } = req.body;
    if (!email || !role) {
        return res.status(400).json({ message: 'email and role required' });
    }
    if (findUser(email)) {
        return res.status(400).json({ message: 'User already exists' });
    }
    users.push({ email, role });
    saveUsers(users);
    res.json({ message: 'User created' });
});

// In-memory chat history
const chatHistory = [];
const systemPrompt = {
    role: 'system',
    content: 'You are ChatGPT, a helpful assistant.',
};

// API endpoint to handle chat requests
app.post('/chat', requireAuth, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Add user message to history
        chatHistory.push({ role: 'user', content: message });

        const params = {
            input: message,
            model: 'gpt-4o',
            instructions: systemPrompt.content,
        };
        if (req.session.previousResponseId) {
            params.previous_response_id = req.session.previousResponseId;
        }
        const completion = await openai.responses.create(params);

        const botMessage = completion.output_text;
        req.session.previousResponseId = completion.id;

        // Save assistant response to history
        chatHistory.push({ role: 'assistant', content: botMessage });

        res.json({ reply: botMessage });

    } catch (error) {
        console.error('Error calling OpenAI API:', error);
        res.status(500).json({ error: 'Failed to communicate with OpenAI' });
    }
});

// Endpoint to clear the chat history
app.post('/reset', requireAuth, (req, res) => {
    chatHistory.length = 0;
    req.session.previousResponseId = null;
    res.json({ message: 'Chat history cleared' });
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
