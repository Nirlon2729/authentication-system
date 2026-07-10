import {
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

import { auth } from "../firebase/firebase";

const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: "select_account",
});

export const googleSignIn = async () => {
  const result = await signInWithPopup(auth, provider);

  const idToken = await result.user.getIdToken();

  return idToken;
};