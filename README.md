# ChatGPT Chatbot

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure the environment**
   Create a `.env` file in the project root containing your OpenAI API key:
   ```env
   OPENAI_API_KEY=your_openai_api_key
   # Optional SMTP settings for sending magic links
   SMTP_HOST=smtp.example.com
   SMTP_PORT=587
   SMTP_USER=user@example.com
   SMTP_PASS=secret
   SESSION_SECRET=change_this_secret
   ```

3. **Start the server**
   ```bash
   npm start
   ```

Initial login
-------------

The repository includes a default admin user `admin@example.com`. Use the `/login.html`
page to request a magic link for this email address. The login link will be printed
to the console if SMTP is not configured.

Admins can create additional users via the `/admin` page.

The application will be available at `http://localhost:3000`.
