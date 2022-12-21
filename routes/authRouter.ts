import express from "express";
import {
  loginWithPhone,
  verifyPhone,
  loginWithGoogle,
} from "../controllers/authController";

const router = express.Router();

router.post("/login-with-phone", loginWithPhone);
router.post("/verify-phone", verifyPhone);
router.post("/login-with-google", loginWithPhone);

export default router;
