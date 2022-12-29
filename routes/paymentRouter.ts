import express from "express";
import {
  payWithCard,
  payWithSavedCard,
  saveCardForPayments,
  savedCards,
} from "../controllers/paymentController";
import { authenticateUser } from "../middleware/authentication";

const router = express.Router();

router.post("/save-card-for-payments", authenticateUser, saveCardForPayments);
router.get("/saved-cards", authenticateUser, savedCards);
router.post("/pay-with-card", authenticateUser, payWithCard);
router.post("/pay-with-saved-card", authenticateUser, payWithSavedCard);

export default router;
