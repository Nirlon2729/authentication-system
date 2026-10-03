const crypto = require("crypto");
const { UAParser } = require("ua-parser-js");

const parseClientInfo = (req) => {
  const userAgentString = req.headers["user-agent"] || "";
  let browser = "Unknown Browser";
  let operatingSystem = "Unknown OS";
  let device = "Desktop";

  try {
    const parser = new UAParser(userAgentString);
    const result = parser.getResult();
    browser = result.browser.name ? `${result.browser.name} ${result.browser.version || ""}`.trim() : "Unknown Browser";
    operatingSystem = result.os.name ? `${result.os.name} ${result.os.version || ""}`.trim() : "Unknown OS";
    device = result.device.type || (result.device.model ? result.device.model : "Desktop");
  } catch (err) {
    console.error("UA parser fallback error:", err.message);
  }

  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "127.0.0.1";

  const requestId = req.id || req.headers["x-request-id"] || crypto.randomUUID();

  return {
    browser,
    operatingSystem,
    device,
    ipAddress,
    userAgent: userAgentString,
    requestId,
  };
};

module.exports = { parseClientInfo };
