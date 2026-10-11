const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

require("dotenv").config({
  path: path.resolve(__dirname, "../../../../.env")
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly"
];

const TOKEN_PATH = path.resolve(
  __dirname,
  "../../../../gmail-token.json"
);

// Load token if it already exists
if (fs.existsSync(TOKEN_PATH)) {
  const token = JSON.parse(
    fs.readFileSync(TOKEN_PATH, "utf8")
  );

  oauth2Client.setCredentials(token);
}


// Generate Google login URL
function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent"
  });
}


// Google sends authorization code here
async function handleCallback(code) {
  const { tokens } = await oauth2Client.getToken(code);

  oauth2Client.setCredentials(tokens);

  // This creates gmail-token.json automatically
  fs.writeFileSync(
    TOKEN_PATH,
    JSON.stringify(tokens, null, 2)
  );

  return tokens;
}


// Send Gmail
async function sendEmail(recipients, subject, message) {
  const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client
  });

  // Accept either a single email or an array
  const emailList = Array.isArray(recipients)
    ? recipients
    : [recipients];

  const results = [];

  for (const to of emailList) {
    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "MIME-Version: 1.0",
      "",
      message
    ].join("\r\n");

    const encodedMessage = Buffer
      .from(email)
      .toString("base64url");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage
      }
    });

    results.push({
      to,
      messageId: response.data.id
    });
  }

  return results;
}

// Fetch received emails from Gmail
async function getInboxEmails(maxResults = 20, pageToken = null) {
  const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client
  });

  const response = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    pageToken,
    q: "in:inbox"
  });

  const messages = response.data.messages || [];

  const emails = await Promise.all(messages.map(async (message) => {
    const result = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"]
    });

    const headers = result.data.payload.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    return {
      id: result.data.id,
      threadId: result.data.threadId,
      from: getHeader("From"),
      subject: getHeader("Subject") || "(No subject)",
      date: getHeader("Date"),
      snippet: result.data.snippet || "",
      unread: result.data.labelIds?.includes("UNREAD") || false
    };
  }));

  return {
    emails,
    nextPageToken: response.data.nextPageToken || null,
    resultSizeEstimate: response.data.resultSizeEstimate || 0
  };
}

// Fetch the complete contents of an email
async function getEmailById(id) {
  const gmail = google.gmail({
    version: "v1",
    auth: oauth2Client
  });

  const response = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full"
  });

  const message = response.data;
  const headers = message.payload.headers || [];

  const getHeader = name =>
    headers.find(header => header.name.toLowerCase() === name.toLowerCase())?.value || "";

  function decodeBody(data) {
    if (!data) return "";
    return Buffer.from(data, "base64url").toString("utf8");
  }

  function extractText(payload) {
    if (payload.mimeType === "text/plain" && payload.body?.data) {
      return decodeBody(payload.body.data);
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        const text = extractText(part);
        if (text) return text;
      }
    }

    return "";
  }

  const body = extractText(message.payload);

  return {
    id: message.id,
    threadId: message.threadId,
    from: getHeader("From"),
    to: getHeader("To"),
    subject: getHeader("Subject") || "(No subject)",
    date: getHeader("Date"),
    body: body || message.snippet || "No readable message content is available."
  };
}

module.exports = {
  getAuthUrl,
  handleCallback,
  sendEmail,
  getInboxEmails,
  getEmailById
};