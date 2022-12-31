import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import connectDB from "../db/connect";
import { BadRequestError } from "../errors";

const addVehicle = async (req: Request, res: Response) => {
  const { model, year, licensePlate, color } = req.body;
  const driver = (req as any).user.user;

  if (!model || !year || !licensePlate || !color) {
    throw new BadRequestError(
      "Vehicle model, year, license plate and color are required"
    );
  }

  const con = await connectDB();

  con.query(
    "SELECT * FROM drivers WHERE id = ?",
    [driver.userId],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      const gottenDriver = resp[0];
      if (!gottenDriver) {
        return res
          .status(StatusCodes.NOT_FOUND)
          .json({ msg: `No Driver exists with id: ${driver.userId}` });
      }

      if (gottenDriver.vehicle_id) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ msg: "Driver already has a vehicle" });
      }
      con.query(
        "INSERT INTO vehicles (model, year, license_plate, color, driver_id) VALUES (?, ?, ?, ?, ?)",
        [model, year, licensePlate, color, driver.userId],
        async (err, resp2) => {
          if (err) {
            return res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({ msg: "Database error" });
          }

          con.query(
            "UPDATE drivers SET vehicle_id = ? WHERE id = ?",
            [resp2.insertId, driver.userId],
            async (err, resp3) => {
              if (err) {
                return res
                  .status(StatusCodes.INTERNAL_SERVER_ERROR)
                  .json({ msg: "Database error" });
              }
              res.json({ msg: "Vehicle added" });
            }
          );
        }
      );
    }
  );
};

export { addVehicle };
