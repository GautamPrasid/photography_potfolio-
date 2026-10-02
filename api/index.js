const { requestHandler } = require("../Javascript/server.js");

module.exports = async (req, res) => {
  try {
    await requestHandler(req, res);
  } catch (error) {
    console.error("Vercel Serverless Handler Error:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  }
};
