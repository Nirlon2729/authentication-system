const assert = require("assert");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

const { generateTokens, verifyAccessToken, verifyRefreshToken } = require("../services/tokenService");
const hashPassword = require("../utils/hashPassword");
const comparePassword = require("../utils/comparePassword");
const hashOTP = require("../utils/hashOTP");
const compareOTP = require("../utils/compareOTP");
const sanitizeUser = require("../utils/sanitizeData");

async function runTests() {
  console.log("🧪 Starting Authentication System Unit & Integration Tests...\n");

  // 1. Password Hashing Test
  console.log("Test 1: Password Hashing & Comparison");
  const plainPassword = "MySecurePassword@123";
  const hashedPassword = await hashPassword(plainPassword);
  assert(hashedPassword !== plainPassword, "Password was not hashed");
  const isMatch = await comparePassword(plainPassword, hashedPassword);
  assert(isMatch === true, "Password comparison failed for correct password");
  const isWrongMatch = await comparePassword("WrongPassword", hashedPassword);
  assert(isWrongMatch === false, "Password comparison matched wrong password");
  console.log("✅ Password hashing & verification passed.\n");

  // 2. OTP Hashing Test
  console.log("Test 2: OTP Hashing & Comparison");
  const plainOTP = "123456";
  const hashedOTP = await hashOTP(plainOTP);
  assert(hashedOTP !== plainOTP, "OTP was not hashed");
  const isOTPMatch = await compareOTP(plainOTP, hashedOTP);
  assert(isOTPMatch === true, "OTP comparison failed for correct OTP");
  const isWrongOTPMatch = await compareOTP("654321", hashedOTP);
  assert(isWrongOTPMatch === false, "OTP comparison matched wrong OTP");
  console.log("✅ OTP hashing & verification passed.\n");

  // 3. Token Generation & Separation Test
  console.log("Test 3: Access Token & Refresh Token Separation");
  const mockUser = {
    _id: "60d0fe4f5311236168a109ca",
    email: "test@example.com",
    role: "user",
    provider: "local",
  };
  const { accessToken, refreshToken } = generateTokens(mockUser, false);
  assert(accessToken, "accessToken missing");
  assert(refreshToken, "refreshToken missing");
  assert(accessToken !== refreshToken, "accessToken and refreshToken must NOT be the same token!");

  const decodedAccess = verifyAccessToken(accessToken);
  assert.strictEqual(decodedAccess.email, mockUser.email, "Access token email mismatch");
  assert.strictEqual(decodedAccess.role, mockUser.role, "Access token role mismatch");

  const decodedRefresh = verifyRefreshToken(refreshToken);
  assert.strictEqual(decodedRefresh.email, mockUser.email, "Refresh token email mismatch");
  console.log("✅ Token generation, separation, and decoding passed.\n");

  // 4. Data Sanitization Test
  console.log("Test 4: User Data Sanitization");
  const rawUser = {
    _id: "60d0fe4f5311236168a109ca",
    fullName: "John Doe",
    email: "john@example.com",
    phone: "1234567890",
    password: "$2b$10$hashedpasswordhere",
    refreshToken: "secret_refresh_token_here",
    role: "user",
    provider: "local",
    isVerified: true,
    hasPassword: true,
    profilePicture: "https://example.com/pic.jpg",
  };
  const sanitized = sanitizeUser(rawUser);
  assert.strictEqual(sanitized.password, undefined, "Sanitized user leaked password!");
  assert.strictEqual(sanitized.refreshToken, undefined, "Sanitized user leaked refreshToken!");
  assert.strictEqual(sanitized.fullName, rawUser.fullName);
  assert.strictEqual(sanitized.email, rawUser.email);
  console.log("✅ User sanitization passed (no sensitive tokens/passwords exposed).\n");

  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
