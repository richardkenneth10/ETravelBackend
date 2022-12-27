import express from "express";
import {
  sendOTP,
  verifyPhoneAndLogin,
  loginWithGoogle,
  loginWithFacebook,
  logout,
} from "../controllers/authController";
import { authenticateUser } from "../middleware/authentication";

const router = express.Router();

router.post("/send-otp", sendOTP);
router.post("/verify-phone-and-login", verifyPhoneAndLogin);
router.post("/login-with-google", loginWithGoogle);
router.post("/login-with-facebook", loginWithFacebook);

router.delete("/logout", authenticateUser, logout);

export default router;
