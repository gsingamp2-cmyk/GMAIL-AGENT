const express = require("express");
const cors = require("cors");

require("dotenv").config({
  path: require("path").resolve(__dirname, "../../../.env")
});

const mailRoutes = require("./routes/mailRoutes");

const app = express();

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Mail Service is running"
  });
});

app.use("/", mailRoutes);

app.listen(PORT, () => {
  console.log(`Mail Service running on http://localhost:${PORT}`);
});