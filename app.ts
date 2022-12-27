import "express-async-errors";

import dotenv from "dotenv";
dotenv.config();
import cookieParser from "cookie-parser";
import express, { Request, Response } from "express";
import connectDB from "./db/connect";
import notFound from "./middleware/not-found";
import errorHandlerMiddleware from "./middleware/error-handler";
import authRouter from "./routes/authRouter";
import profileRouter from "./routes/profileRouter";
import tokenRouter from "./routes/tokenRouter";

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser(process.env.JWT_SECRET));

app.get("/", (req: Request, res: Response) => {
  res.send("Welcome");
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/profile", profileRouter);
app.use("/api/v1/token", tokenRouter);

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
