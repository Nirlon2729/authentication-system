const crypto = require("crypto");

const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV !== "production") {
    console.error("❌ Error encountered:", err);
  }

  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || "Internal Server Error";
  let code = err.code || "INTERNAL_SERVER_ERROR";

  // Mongoose Bad ObjectId (CastError)
  if (err.name === "CastError") {
    message = `Resource not found with id of ${err.value}`;
    statusCode = 404;
    code = "RESOURCE_NOT_FOUND";
  }

  // Mongoose Duplicate Key (11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} is already registered.`;
    statusCode = 409;
    code = "DUPLICATE_KEY";
  }

  // Mongoose Validation Error
  if (err.name === "ValidationError") {
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    statusCode = 400;
    code = "VALIDATION_ERROR";
  }

  // JWT Errors
  if (err.name === "JsonWebTokenError") {
    message = "Invalid authentication token.";
    statusCode = 401;
    code = "INVALID_TOKEN";
  }

  if (err.name === "TokenExpiredError") {
    message = "Authentication token expired. Please log in again.";
    statusCode = 401;
    code = "TOKEN_EXPIRED";
  }

  // Multer Errors
  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File size exceeds the 5MB limit.";
    } else {
      message = err.message;
    }
    statusCode = 400;
    code = "FILE_UPLOAD_ERROR";
  }

  const requestId = req?.headers?.["x-request-id"] || req?.id || crypto.randomUUID();

  res.status(statusCode).json({
    success: false,
    message,
    code,
    requestId,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

module.exports = errorHandler;