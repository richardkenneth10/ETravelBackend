import "express-async-errors";

import dotenv from "dotenv";
dotenv.config();
import express from "express";
import connectDB from "./db/connect";
import notFound from "./middleware/not-found";
import errorHandlerMiddleware from "./middleware/error-handler";
import authRouter from "./routes/authRouter";

const app = express();

const PORT = process.env.PORT || 5000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome");
});

app.use("/api/v1/auth", authRouter);

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
