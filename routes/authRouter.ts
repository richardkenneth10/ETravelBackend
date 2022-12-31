import express from "express";
import {
  sendOTP,
  verifyPhoneAndLogin,
  loginWithGoogle,
  loginWithFacebook,
  logout,
  registerDriver,
  verifyDriverEmail,
  sendDriverOTP,
  driverLogin,
  driverLogout,
} from "../controllers/authController";
import {
  authenticateDriver,
  authenticateUser,
} from "../middleware/authentication";

const router = express.Router();

router.post("/send-otp", sendOTP);
router.post("/verify-phone-and-login", verifyPhoneAndLogin);
router.post("/login-with-google", loginWithGoogle);
router.post("/login-with-facebook", loginWithFacebook);
router.delete("/logout", authenticateUser, logout);

router.post("/register-driver", registerDriver);
router.post("/verify-driver-email", verifyDriverEmail);
router.post("/send-driver-otp", authenticateDriver, sendDriverOTP);
router.post("/driver-login", driverLogin);
router.delete("/driver-logout", authenticateDriver, driverLogout);

export default router;
