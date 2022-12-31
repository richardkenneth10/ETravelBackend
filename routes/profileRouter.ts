import express from "express";
import {
  getMyDriverProfile,
  getMyProfile,
  updateDriverProfile,
  updateUserProfile,
  updateUserProfileFromFacebook,
  updateUserProfileFromGoogle,
  verifyAndUpdateDriverPhone,
  verifyAndUpdatePhone,
} from "../controllers/profileController";
import { uploadImage } from "../controllers/uploadController";
import {
  authenticateDriver,
  authenticateUser,
} from "../middleware/authentication";

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
router.post("/upload-image", uploadImage);
router.get("/me", authenticateUser, getMyDriverProfile);

router.patch("/update-driver-profile", authenticateDriver, updateDriverProfile);

router.patch(
  "/verify-and-update-driver-phone",
  authenticateDriver,
  verifyAndUpdateDriverPhone
);
router.get("/driver-me", authenticateDriver, getMyProfile);

export default router;
