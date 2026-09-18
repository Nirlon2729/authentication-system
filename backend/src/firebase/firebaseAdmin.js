require("dotenv").config();
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const hasValidServiceAccount =
  Boolean(process.env.FIREBASE_PROJECT_ID) &&
  Boolean(process.env.FIREBASE_CLIENT_EMAIL) &&
  Boolean(process.env.FIREBASE_PRIVATE_KEY);

let authInstance;

try {
  if (!getApps().length) {
    if (hasValidServiceAccount) {
      const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      };
      initializeApp({
        credential: cert(serviceAccount),
      });
    } else if (process.env.FIREBASE_PROJECT_ID) {
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    } else {
      initializeApp({
        projectId: "authentication-system27",
      });
    }
  }
  authInstance = getAuth();
} catch (error) {
  console.warn("⚠️ Firebase Admin initialization warning:", error.message);
  authInstance = {
    verifyIdToken: async (token) => {
      throw new Error("Firebase Admin not configured for verification");
    },
  };
}

module.exports = {
  auth: authInstance,
};