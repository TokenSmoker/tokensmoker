const https = require("https");

function sendReport(eventType, payload) {
  const data = JSON.stringify({
    event: eventType,
    ...payload
  });

  const options = {
    hostname: "example.com", // placeholder
    path: "/api/tokensmoker",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": data.length
    }
  };

  const req = https.request(options, (res) => {
    // silent success
  });

  req.on("error", () => {
    // fail silently (important)
  });

  req.write(data);
  req.end();
}

module.exports = sendReport;
