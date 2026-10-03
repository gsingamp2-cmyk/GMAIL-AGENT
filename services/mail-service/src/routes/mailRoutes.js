const express = require("express");
const fs = require("fs");
const path = require("path");

const { sendEmail } = require("../services/gmailService");
const {
  createScheduledMail,
  getScheduledMails,
  deleteScheduledMail
} = require("../services/scheduledMailService");

const router = express.Router();

const HISTORY_PATH = path.resolve(__dirname, "../../data/mail-history.json");

function readHistory() {
  if (!fs.existsSync(HISTORY_PATH)) return [];

  try {
    return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
  } catch (error) {
    console.error("Could not read mail history:", error);
    return [];
  }
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}


/*
==================================================
SEND EMAIL
POST /mail/send
==================================================
*/

router.post("/send", async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    const recipients = Array.isArray(to) ? to : [to];

    if (recipients.length === 0 || recipients.some(email => !email)) {
      return res.status(400).json({
        success: false,
        error: "At least one recipient is required."
      });
    }

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        error: "Subject and message are required."
      });
    }

    const historyRecord = {
      id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 8),
      recipients: [],
      subject,
      message,
      status: "sending",
      sentAt: new Date().toISOString()
    };

    for (const email of recipients) {
      try {
        const result = await sendEmail(email, subject, message);

        historyRecord.recipients.push({
          email,
          status: "sent",
          messageId: result.id || null
        });
      } catch (error) {
        console.error(`Failed to send to ${email}:`, error.message);

        historyRecord.recipients.push({
          email,
          status: "failed",
          error: error.message
        });
      }
    }

    const sentCount = historyRecord.recipients.filter(
      recipient => recipient.status === "sent"
    ).length;

    const failedCount = historyRecord.recipients.filter(
      recipient => recipient.status === "failed"
    ).length;

    if (sentCount === recipients.length) {
      historyRecord.status = "sent";
    } else if (sentCount === 0) {
      historyRecord.status = "failed";
    } else {
      historyRecord.status = "partial";
    }

    const history = readHistory();
    history.unshift(historyRecord);
    saveHistory(history);

    res.json({
      success: sentCount > 0,
      status: historyRecord.status,
      total: recipients.length,
      sent: sentCount,
      failed: failedCount,
      historyId: historyRecord.id,
      recipients: historyRecord.recipients
    });
  } catch (error) {
    console.error("Mail send error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/*
==================================================
GET MAIL HISTORY
GET /mail/history
==================================================
*/

router.get("/history", (req, res) => {
  try {
    const history = readHistory();

    res.json({
      success: true,
      count: history.length,
      history
    });
  } catch (error) {
    console.error("History error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/*
==================================================
GET SINGLE HISTORY ITEM
GET /mail/history/:id
==================================================
*/

router.get("/history/:id", (req, res) => {
  try {
    const history = readHistory();
    const record = history.find(item => item.id === req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "History record not found."
      });
    }

    res.json({
      success: true,
      history: record
    });
  } catch (error) {
    console.error("History item error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/*
==================================================
SCHEDULE EMAIL
POST /mail/schedule
==================================================
*/

router.post("/schedule", (req, res) => {
  try {
    const { to, subject, message, scheduledAt } = req.body;
    const recipients = Array.isArray(to) ? to : [to];

    if (recipients.length === 0 || recipients.some(email => !email)) {
      return res.status(400).json({
        success: false,
        error: "At least one recipient is required."
      });
    }

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        error: "Subject and message are required."
      });
    }

    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        error: "Scheduled date and time are required."
      });
    }

    const scheduledTime = new Date(scheduledAt);

    if (isNaN(scheduledTime.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid scheduled date and time."
      });
    }

    if (scheduledTime <= new Date()) {
      return res.status(400).json({
        success: false,
        error: "Scheduled time must be in the future."
      });
    }

    const scheduledMail = createScheduledMail({
      to: recipients,
      subject,
      message,
      scheduledAt: scheduledTime.toISOString()
    });

    res.json({
      success: true,
      message: "Email scheduled successfully.",
      scheduledMail
    });
  } catch (error) {
    console.error("Schedule mail error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/*
==================================================
GET SCHEDULED EMAILS
GET /mail/scheduled
==================================================
*/

router.get("/scheduled", (req, res) => {
  try {
    const scheduledMails = getScheduledMails();

    res.json({
      success: true,
      count: scheduledMails.length,
      scheduledMails
    });
  } catch (error) {
    console.error("Scheduled mail error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


/*
==================================================
DELETE SCHEDULED EMAIL
DELETE /mail/scheduled/:id
==================================================
*/

router.delete("/scheduled/:id", (req, res) => {
  try {
    const deleted = deleteScheduledMail(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Scheduled email not found."
      });
    }

    res.json({
      success: true,
      message: "Scheduled email deleted successfully."
    });
  } catch (error) {
    console.error("Delete scheduled mail error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


module.exports = router;