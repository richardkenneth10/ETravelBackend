import express from "express";
import {
  refreshDriverToken,
  refreshToken,
} from "../controllers/tokenController";

const router = express.Router();

router.post("/refresh", refreshToken);
router.post("/driver-refresh", refreshDriverToken);

export default router;
