import "express-async-errors";

import dotenv from "dotenv";
dotenv.config();
import express, { Request, Response } from "express";
import connectDB from "./db/connect";
import notFound from "./middleware/not-found";
import errorHandlerMiddleware from "./middleware/error-handler";
import authRouter from "./routes/authRouter";
import profileRouter from "./routes/profileRouter";
import tokenRouter from "./routes/tokenRouter";
import paymentRouter from "./routes/paymentRouter";
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_CLOUD_API_KEY,
  api_secret: process.env.CLOUDINARY_CLOUD_API_SECRET,
});

import fileUpload from "express-fileupload";
import vehicleRouter from "./routes/vehicleRouter";
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(fileUpload({ useTempFiles: true }));

app.use(express.static("./public"));

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome");
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/profile", profileRouter);
app.use("/api/v1/token", tokenRouter);
app.use("/api/v1/payment", paymentRouter);
app.use("/api/v1/vehicle", vehicleRouter);

app.use(notFound);
app.use(errorHandlerMiddleware);

const start = async () => {
  try {
    await connectDB();
    console.log("db connected");
    app.listen(PORT, (): void =>
      console.log(`Server is listening on port: ${PORT}`)
    );
  } catch (error) {
    console.log("Error connecting to DB");
  }
};
start();
