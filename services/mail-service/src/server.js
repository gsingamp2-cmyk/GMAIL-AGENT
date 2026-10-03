const express = require("express");
const cors = require("cors");
const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../../.env")
});

const mailRoutes = require("./routes/mailRoutes");
const { chatWithAgent } = require("./services/geminiService");
const { startScheduler } = require("./services/scheduledMailService");

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Mail Service is running"
  });
});

app.use("/mail", mailRoutes);

app.post("/ai/chat", async (req, res) => {
  try {
    const messages = req.body?.messages || [];
    const currentDraft = req.body?.currentDraft || null;

    const result = await chatWithAgent(messages, currentDraft);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("AI chat error:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Mail Service running on http://localhost:${PORT}`);
  startScheduler();
});