const { auth } = require("../firebase/firebaseAdmin");

const verifyGoogleToken = async (idToken) => {
  const decodedToken = await auth.verifyIdToken(idToken);

  return {
    uid: decodedToken.uid,
    email: decodedToken.email,
    fullName: decodedToken.name,
    profilePicture: decodedToken.picture,
    emailVerified: decodedToken.email_verified,
  };
};

module.exports = {
  verifyGoogleToken,
};