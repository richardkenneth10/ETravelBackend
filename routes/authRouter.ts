import express from "express";
import {
  loginWithPhone,
  verifyPhone,
  loginWithGoogle,
  loginWithFacebook,
  logout,
  updateUserProfile,
} from "../controllers/authController";
import { authenticateUser } from "../middleware/authentication";

const router = express.Router();

router.post("/login-with-phone", loginWithPhone);
router.post("/verify-phone", verifyPhone);
router.post("/login-with-google", loginWithGoogle);
router.post("/login-with-facebook", loginWithFacebook);
router.patch("/update-profile", authenticateUser, updateUserProfile);
router.delete("/logout", authenticateUser, logout);

export default router;
