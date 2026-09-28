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
  "https://www.googleapis.com/auth/gmail.send"
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


module.exports = {
  getAuthUrl,
  handleCallback,
  sendEmail
};