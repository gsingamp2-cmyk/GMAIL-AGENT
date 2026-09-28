const express = require("express");

const {
  getAuthUrl,
  handleCallback,
  sendEmail
} = require("../services/gmailService");

const router = express.Router();


// Start Google authentication
router.get("/auth/google", (req, res) => {
  const url = getAuthUrl();
  res.redirect(url);
});


// Google callback
router.get("/auth/google/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send("Authorization code missing");
    }

    await handleCallback(code);

    res.send(`
      <h1>Gmail Connected Successfully!</h1>
      <p>You can now send emails from My-Agent.</p>
    `);

  } catch (error) {
    console.error(error.response?.data || error.message);

    res.status(500).json({
      error: "Gmail authentication failed",
      details: error.message
    });
  }
});


// Send email
router.post("/mail/send", async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: "Recipients, subject and message are required"
      });
    }

    const recipients = Array.isArray(to) ? to : [to];

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: "At least one recipient is required"
      });
    }

    const results = await sendEmail(
      recipients,
      subject,
      message
    );

    res.json({
      success: true,
      message: `Email sent to ${results.length} recipient(s)`,
      results
    });

  } catch (error) {
    console.error(error.response?.data || error.message);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


module.exports = router;