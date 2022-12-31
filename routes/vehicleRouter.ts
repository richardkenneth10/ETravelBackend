import express from "express";
import { addVehicle } from "../controllers/vehicleController";

import { authenticateDriver } from "../middleware/authentication";

const router = express.Router();

router.post("/add", authenticateDriver, addVehicle);

export default router;
