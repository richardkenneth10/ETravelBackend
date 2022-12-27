import express from "express";
import {
  getMyProfile,
  updateUserProfile,
  updateUserProfileFromFacebook,
  updateUserProfileFromGoogle,
  verifyAndUpdatePhone,
} from "../controllers/profileController";
import { authenticateUser } from "../middleware/authentication";

const router = express.Router();

router.patch("/update-profile", authenticateUser, updateUserProfile);
router.patch(
  "/verify-and-update-phone",
  authenticateUser,
  verifyAndUpdatePhone
);
router.patch(
  "/update-profile-from-google",
  authenticateUser,
  updateUserProfileFromGoogle
);
router.patch(
  "/update-profile-from-facebook",
  authenticateUser,
  updateUserProfileFromFacebook
);

router.get("/me", authenticateUser, getMyProfile);

export default router;
