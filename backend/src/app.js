const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

// Middlewares
const limiter = require("./middleware/rateLimiter");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorMiddleware");

// Routes
const routes = require("./routes");

const app = express();

/* =========================================
   Security Middleware
========================================= */

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(limiter);

/* =========================================
   Body Parser
========================================= */

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(cookieParser());

/* =========================================
   Health Check
========================================= */

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authentication API is running 🚀",
  });
});

/* =========================================
   API Routes
========================================= */

app.use("/api", routes);

/* =========================================
   Error Handling
========================================= */

app.use(notFound);

app.use(errorHandler);

module.exports = app;