import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Stripe from "stripe";
import connectDB from "../db/connect";
import { BadRequestError } from "../errors";
const stripeSecretKey = process.env.STRIPE_SECRET_KEY as string;
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2022-11-15",
});

interface PaymentUser {
  id: string;
  wallet_balance: number;
  stripe_customer_id: string;
  user_id: number;
  created_at: Date;
  updated_at: Date;
}

interface PaymentIntentResponse {
  client_secret?: string | null;
  requires_action?: boolean;
  declined?: boolean;
  status?: Stripe.PaymentIntent.Status;
  error?: string;
  requires_authentication?: boolean;
  payment_method_id?: string;
}

interface PaymentMethodDisplayData {
  payment_method_id: string;
  card_brand: string;
  last4: string;
}

const _generateResponse = (res: Response, intent: Stripe.PaymentIntent) => {
  switch (intent.status) {
    case "requires_action":
      return res.json({
        clientSecret: intent.client_secret,
        requiresAction: true,
        status: intent.status,
      } as PaymentIntentResponse);

    case "requires_payment_method":
      return res.status(StatusCodes.BAD_REQUEST).json({
        declined: true,
        status: intent.status,
      } as PaymentIntentResponse);

    case "succeeded":
      return res.json({
        clientSecret: intent.client_secret,
        status: intent.status,
      } as PaymentIntentResponse);
  }
  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ msg: "failed" });
};

const _errorHandler = async (error: any, res: Response) => {
  console.log(error.message);

  if (error.code == "authentication_required") {
    const paymentIntentRetrieved: Stripe.PaymentIntent =
      await stripe.paymentIntents.retrieve(error.raw.payment_intent.id);
    return res.json({
      requires_authentication: true,
      clientSecret: paymentIntentRetrieved.client_secret,
      payment_method_id:
        paymentIntentRetrieved.last_payment_error!.payment_method!.id,
    } as PaymentIntentResponse);
  } else if (error["decline_code"]) {
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ declined: true, msg: "Declined transaction" });
  } else {
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ msg: "Internal server error" });
  }
};

const payWithCard = async (req: Request, res: Response) => {
  const { paymentMethodId, rideId } = req.body;

  if (!paymentMethodId || !rideId) {
    throw new BadRequestError("Payment method id and ride id are required");
  }

  try {
    const params: Stripe.PaymentIntentCreateParams = {
      amount: rideId === 1 ? 70000 : 40000,
      confirm: true,
      confirmation_method: "manual",
      currency: "ngn",
      payment_method: paymentMethodId,
      use_stripe_sdk: true,
    };

    const intent: Stripe.PaymentIntent = await stripe.paymentIntents.create(
      params
    );
    _generateResponse(res, intent);
    return;
  } catch (e) {
    await _errorHandler(e, res);
  }
};

const saveCardForPayments = async (req: Request, res: Response) => {
  const { paymentMethodId } = req.body;

  const user = (req as any).user.user;

  if (!paymentMethodId) {
    throw new BadRequestError("Payment method id is required");
  }
  const con = await connectDB();

  con.query(
    "SELECT * FROM payment_users WHERE user_id = ?",
    [user.userId],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      const paymentUser = resp[0] as PaymentUser;

      try {
        if (paymentUser) {
          const customer = await stripe.customers.retrieve(
            paymentUser.stripe_customer_id
          );

          await stripe.paymentMethods.attach(paymentMethodId, {
            customer: customer.id,
          });

          const params: Stripe.PaymentMethodListParams = {
            customer: customer.id,
            type: "card",
          };
          const customerPaymentMethods: Stripe.ApiList<Stripe.PaymentMethod> =
            await stripe.paymentMethods.list(params);

          let fingerprints: Array<string> = [];
          let duplicateExists = false;

          for (let method of customerPaymentMethods.data) {
            if (fingerprints.includes(method.card!.fingerprint!)) {
              duplicateExists = true;
              await stripe.paymentMethods.detach(method.id);
            } else {
              fingerprints.push(method.card!.fingerprint!);
            }
          }

          if (duplicateExists) {
            return res
              .status(StatusCodes.BAD_REQUEST)
              .json({ msg: "duplicate card" });
          }
          return res.send("success");
        }

        const newCustomer: Stripe.Customer = await stripe.customers.create();

        const setupIntent: Stripe.SetupIntent =
          await stripe.setupIntents.create({
            customer: newCustomer.id,
            payment_method_types: ["card"],
          });

        con.query(
          "INSERT INTO payment_users (stripe_customer_id, user_id) VALUES (?, ?)",
          [newCustomer.id, user.userId],
          async (err, resp2) => {
            if (err) {
              return res
                .status(StatusCodes.INTERNAL_SERVER_ERROR)
                .json({ msg: "Database error" });
            }
            return res.status(StatusCodes.CREATED).json({
              clientSecret: setupIntent.client_secret,
            });
          }
        );
      } catch (e) {
        await _errorHandler(e, res);
      }
    }
  );
};

const savedCards = async (req: Request, res: Response) => {
  const user = (req as any).user.user;

  const con = await connectDB();

  con.query(
    "SELECT * FROM payment_users WHERE user_id = ?",
    [user.userId],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      const paymentUser = resp[0] as PaymentUser;
      if (!paymentUser) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          msg: "There is no payment user for this account. Save a deit/credit card to create a payment user",
        });
      }

      try {
        const customer = await stripe.customers.retrieve(
          paymentUser.stripe_customer_id
        );

        const params: Stripe.PaymentMethodListParams = {
          customer: customer.id,
          type: "card",
        };
        const savedCardsData: Stripe.ApiList<Stripe.PaymentMethod> =
          await stripe.paymentMethods.list(params);

        const savedCards: Array<PaymentMethodDisplayData> =
          savedCardsData.data.map((method) => ({
            payment_method_id: method.id,
            card_brand: method.card!.brand,
            last4: method.card!.last4,
          }));
        res.json({ cards: savedCards });
        return;
      } catch (e) {
        await _errorHandler(e, res);
      }
    }
  );
};

const payWithSavedCard = async (req: Request, res: Response) => {
  const { paymentMethodId, rideId } = req.body;

  //ride id is compared with "undefined" so as to avoid issues when someone
  //attempts with a ride id of 0
  if (!paymentMethodId || rideId == undefined) {
    throw new BadRequestError("Payment method id and Ride id are required");
  }
  const user = (req as any).user.user;

  const con = await connectDB();

  con.query(
    "SELECT * FROM payment_users WHERE user_id = ?",
    [user.userId],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      const paymentUser = resp[0] as PaymentUser;

      const params: Stripe.PaymentIntentCreateParams = {
        amount: rideId === 1 ? 70000 : 40000,
        currency: "ngn",
        customer: paymentUser.stripe_customer_id,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
      };
      try {
        const paymentIntent = await stripe.paymentIntents.create(params);

        _generateResponse(res, paymentIntent);
      } catch (error: any) {
        await _errorHandler(error, res);
      }
    }
  );
};

export { payWithCard, saveCardForPayments, savedCards, payWithSavedCard };
