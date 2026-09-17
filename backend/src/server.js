const path = require("path");
const dotenv = require("dotenv");

// Load .env from backend folder or current working directory
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

// Validate critical environment variables
if (!process.env.JWT_SECRET) {
  console.error("❌ CRITICAL ERROR: JWT_SECRET environment variable is not defined!");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("❌ CRITICAL ERROR: MONGO_URI environment variable is not defined!");
  process.exit(1);
}

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();