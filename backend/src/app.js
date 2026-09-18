require("dotenv").config();
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
   Security Middleware (Helmet & COOP)
========================================= */
// Configure Helmet with same-origin-allow-popups so Google OAuth popups can communicate
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Dynamic CORS configuration supporting local dev (5174, 5173, 3000) and production
const getAllowedOrigins = () => {
  const envOrigins = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
  ].filter(Boolean);

  const defaultLocalOrigins = [
    "http://localhost:5174",
    "http://localhost:5173",
    "http://localhost:5175",
    "http://localhost:3000",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:3000",
  ];

  return [...new Set([...envOrigins, ...defaultLocalOrigins])];
};

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser / server-to-server requests (no origin header)
    if (!origin) return callback(null, true);

    const allowed = getAllowedOrigins();
    const isLocalhost =
      /^http:\/\/localhost:\d+$/.test(origin) ||
      /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);

    if (
      allowed.includes(origin) ||
      origin.endsWith(".vercel.app") ||
      isLocalhost ||
      process.env.NODE_ENV !== "production"
    ) {
      return callback(null, true);
    }

    console.warn(`[CORS] Rejected request from unauthorized origin: ${origin}`);
    return callback(new Error(`CORS policy violation: origin ${origin} is not allowed`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-ID",
    "X-Admin-API-Key",
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-Simulation-Id",
    "X-Simulation-Token",
  ],
  exposedHeaders: [
    "X-Request-ID",
    "X-Security-Gateway-Status",
    "X-Security-Risk-Score",
    "X-Security-Simulation",
    "X-Security-Simulation-ID",
    "Retry-After",
    "Content-Disposition",
  ],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));

app.use(limiter);

/* =========================================
   Body Parser & Cookies
========================================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));

/* =========================================
   Global Website Lockdown Middleware
========================================= */
const websiteLockdownMiddleware = require("./middleware/websiteLockdownMiddleware");
const lockdownService = require("./services/lockdownService");
lockdownService.initialize().catch((err) => console.warn("[Lockdown] Init warn:", err.message));
app.use(websiteLockdownMiddleware);

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