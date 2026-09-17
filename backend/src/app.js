const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

// Middlewares
const limiter = require("./middleware/rateLimiter");
const securityGatewayMiddleware = require("./middleware/securityGatewayMiddleware");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorMiddleware");

// Routes
const routes = require("./routes");

const app = express();

/* =========================================
   Security Middleware
========================================= */
app.use(helmet());

// Dynamic CORS configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      
      // Allow exact match or localhost in dev
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      
      return callback(new Error("CORS policy violation: origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(limiter);

/* =========================================
   Body Parser & Cookies
========================================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

/* =========================================
   AI Security Gateway Middleware
========================================= */
app.use(securityGatewayMiddleware);

/* =========================================
   Health Check
========================================= */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Authentication API with AI Security Gateway is running 🚀",
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