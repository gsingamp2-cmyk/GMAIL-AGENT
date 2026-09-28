const express = require("express");
const fs = require("fs");
const path = require("path");

const {
  sendEmail
} = require("../services/gmailService");

const router = express.Router();


// History file
const HISTORY_PATH = path.resolve(
  __dirname,
  "../../data/mail-history.json"
);


// Read history
function readHistory() {

  if (!fs.existsSync(HISTORY_PATH)) {
    return [];
  }

  try {
    return JSON.parse(
      fs.readFileSync(HISTORY_PATH, "utf8")
    );
  } catch (error) {
    console.error("Could not read mail history:", error);
    return [];
  }
}


// Save history
function saveHistory(history) {

  fs.writeFileSync(
    HISTORY_PATH,
    JSON.stringify(history, null, 2)
  );
}


/*
==================================================
SEND EMAIL
POST /mail/send
==================================================
*/

router.post("/send", async (req, res) => {

  try {

    const {
      to,
      subject,
      message
    } = req.body;


    // Convert single email or array into array
    const recipients = Array.isArray(to)
      ? to
      : [to];


    // Validation
    if (
      recipients.length === 0 ||
      recipients.some(email => !email)
    ) {

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


    /*
    ----------------------------------------------
    Create history record
    ----------------------------------------------
    */

    const historyRecord = {

      id:
        Date.now().toString() +
        "-" +
        Math.random()
          .toString(36)
          .substring(2, 8),

      recipients: [],

      subject,

      message,

      status: "sending",

      sentAt: new Date().toISOString()
    };


    /*
    ----------------------------------------------
    Send individually
    ----------------------------------------------
    */

    for (const email of recipients) {

      try {

        const result = await sendEmail(
          email,
          subject,
          message
        );


        historyRecord.recipients.push({

          email,

          status: "sent",

          messageId:
            result.id || null

        });


      } catch (error) {

        console.error(
          `Failed to send to ${email}:`,
          error.message
        );


        historyRecord.recipients.push({

          email,

          status: "failed",

          error: error.message

        });

      }

    }


    /*
    ----------------------------------------------
    Calculate overall status
    ----------------------------------------------
    */

    const sentCount =
      historyRecord.recipients.filter(
        recipient => recipient.status === "sent"
      ).length;


    const failedCount =
      historyRecord.recipients.filter(
        recipient => recipient.status === "failed"
      ).length;


    if (sentCount === recipients.length) {

      historyRecord.status = "sent";

    } else if (sentCount === 0) {

      historyRecord.status = "failed";

    } else {

      historyRecord.status = "partial";

    }


    /*
    ----------------------------------------------
    Save history
    ----------------------------------------------
    */

    const history = readHistory();

    history.unshift(historyRecord);

    saveHistory(history);


    /*
    ----------------------------------------------
    Response
    ----------------------------------------------
    */

    return res.json({

      success: sentCount > 0,

      status: historyRecord.status,

      total: recipients.length,

      sent: sentCount,

      failed: failedCount,

      historyId: historyRecord.id,

      recipients: historyRecord.recipients

    });


  } catch (error) {

    console.error(
      "Mail send error:",
      error
    );


    return res.status(500).json({

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

    console.error(
      "History error:",
      error
    );

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

    const record = history.find(
      item => item.id === req.params.id
    );


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

    console.error(
      "History item error:",
      error
    );

    res.status(500).json({

      success: false,

      error: error.message

    });

  }

});


module.exports = router;