const fs = require("fs");
const path = require("path");
const { sendEmail } = require("./gmailService");

const SCHEDULED_MAIL_PATH = path.resolve(__dirname, "../../data/scheduled-mail.json");
const HISTORY_PATH = path.resolve(__dirname, "../../data/mail-history.json");

function readScheduledMails() {
  if (!fs.existsSync(SCHEDULED_MAIL_PATH)) return [];

  try {
    return JSON.parse(fs.readFileSync(SCHEDULED_MAIL_PATH, "utf8"));
  } catch (error) {
    console.error("Could not read scheduled mails:", error);
    return [];
  }
}

function saveScheduledMails(mails) {
  fs.writeFileSync(SCHEDULED_MAIL_PATH, JSON.stringify(mails, null, 2));
}

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

function createScheduledMail({ to, subject, message, scheduledAt }) {
  const mails = readScheduledMails();

  const scheduledMail = {
    id: Date.now().toString() + "-" + Math.random().toString(36).substring(2, 8),
    to: Array.isArray(to) ? to : [to],
    subject,
    message,
    scheduledAt,
    status: "scheduled",
    createdAt: new Date().toISOString()
  };

  mails.push(scheduledMail);
  saveScheduledMails(mails);

  return scheduledMail;
}

function getScheduledMails() {
  return readScheduledMails();
}

function deleteScheduledMail(id) {
  const mails = readScheduledMails();
  const updatedMails = mails.filter(mail => mail.id !== id);

  if (updatedMails.length === mails.length) return false;

  saveScheduledMails(updatedMails);
  return true;
}

async function processScheduledMails() {
  const mails = readScheduledMails();
  const now = new Date();

  const dueMails = mails.filter(
    mail => mail.status === "scheduled" && new Date(mail.scheduledAt) <= now
  );

  if (dueMails.length === 0) return;

  for (const mail of dueMails) {
    try {
      mail.status = "sending";
      saveScheduledMails(mails);

      const recipients = [];

      for (const email of mail.to) {
        try {
          const result = await sendEmail(email, mail.subject, mail.message);

          recipients.push({
            email,
            status: "sent",
            messageId: result[0]?.messageId || null
          });
        } catch (error) {
          console.error(`Failed to send scheduled email to ${email}:`, error.message);

          recipients.push({
            email,
            status: "failed",
            error: error.message
          });
        }
      }

      const sentCount = recipients.filter(
        recipient => recipient.status === "sent"
      ).length;

      const failedCount = recipients.filter(
        recipient => recipient.status === "failed"
      ).length;

      let status = "failed";

      if (sentCount === mail.to.length) {
        status = "sent";
      } else if (sentCount > 0) {
        status = "partial";
      }

      const history = readHistory();

      history.unshift({
        id: mail.id,
        recipients,
        subject: mail.subject,
        message: mail.message,
        status,
        sentAt: new Date().toISOString()
      });

      saveHistory(history);

      const updatedMails = readScheduledMails().filter(
        item => item.id !== mail.id
      );

      saveScheduledMails(updatedMails);

      console.log(
        `Scheduled email ${mail.id} processed: ${sentCount} sent, ${failedCount} failed`
      );
    } catch (error) {
      console.error("Scheduled mail processing error:", error);
    }
  }
}

function startScheduler() {
  console.log("Scheduled mail scheduler started.");

  processScheduledMails();

  setInterval(processScheduledMails, 5000);
}

module.exports = {
  createScheduledMail,
  getScheduledMails,
  deleteScheduledMail,
  startScheduler
};