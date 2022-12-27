import express from "express";
import { refreshToken } from "../controllers/tokenController";

const router = express.Router();

router.post("/refresh", refreshToken);

export default router;
