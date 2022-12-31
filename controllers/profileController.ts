import axios from "axios";
import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import connectDB from "../db/connect";
import { BadRequestError } from "../errors";
import {
  sendDriverTokenWithResponse,
  sendTokenWithResponse,
} from "../utils/sendTokenWithResponse";

const updateUserProfile = async (req: Request, res: Response) => {
  const { email, firstName, lastName } = req.body;
  const userId = (req as any).user.user.userId;

  const updateFields = (): Map<string, string> => {
    const fields = new Map<string, string>();

    if (email) {
      fields.set("email", email);
    }
    if (firstName) {
      fields.set("first_name", firstName);
    }
    if (lastName) {
      fields.set("last_name", lastName);
    }
    return fields;
  };

  if (updateFields().size === 0) {
    throw new BadRequestError("Provide at least one field to be updated");
  }

  let innerSQLString = "";
  let count = 0;
  updateFields().forEach((value, key) => {
    count++;
    innerSQLString += `${key} = ?${count < updateFields().size ? "," : ""}`;
  });

  const con = await connectDB();
  con.query(
    `UPDATE users SET ${innerSQLString} WHERE id = ?`,
    [...updateFields().values(), userId],
    async (err, resp3) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }
      const initialUser = (req as any).user.user;

      const user: {
        id: number;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        email: string | null;
        image_url: string | null;
      } = {
        first_name: firstName ?? initialUser.first_name,
        last_name: lastName ?? initialUser.last_name,
        phone: initialUser.phone,
        email: email ?? initialUser.email,
        image_url: initialUser.image_url,
        id: initialUser.userId,
      };

      await sendTokenWithResponse(user, res);
    }
  );
};

const updateUserProfileFromGoogle = async (req: Request, res: Response) => {
  const { accessToken } = req.body;
  const initialUser = (req as any).user.user;

  if (!accessToken) {
    throw new BadRequestError("Access token is required");
  }
  const { data } = await axios({
    url: "https://www.googleapis.com/oauth2/v2/userinfo",
    method: "get",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const googleUserData: {
    id: string;
    email: string;
    given_name: string;
    family_name: string;
    picture: string;
    name: string;
  } = data;

  const con = await connectDB();
  console.log(initialUser);
  console.log(googleUserData);
  con.query(
    "SELECT * FROM users where id = ?",
    [initialUser.userId],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      if (resp.length === 0) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ msg: "User does not exist" });
      }

      con.query(
        "SELECT * FROM users where google_id = ?",
        [googleUserData.id],
        async (err, resp) => {
          if (err) {
            return res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({ msg: "Database error" });
          }

          if (resp.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
              msg: "A user with this Google account already exists. Log in with the account if you are the owner",
            });
          }

          con.query(
            "UPDATE users SET email = ?, first_name = ?, last_name = ?, image_url = ?, google_id = ? WHERE id = ?",
            [
              googleUserData.email,
              googleUserData.given_name,
              googleUserData.family_name,
              googleUserData.picture,
              googleUserData.id,
              initialUser.userId,
            ],
            async (err, resp2) => {
              if (err) {
                return res
                  .status(StatusCodes.INTERNAL_SERVER_ERROR)
                  .json({ msg: "Database error1" });
              }
              console.log(resp2);

              const user: {
                id: number;
                first_name: string | null;
                last_name: string | null;
                phone: string | null;
                email: string | null;
                image_url: string | null;
              } = {
                id: initialUser.userId,
                first_name: googleUserData.given_name,
                last_name: googleUserData.family_name,
                phone: initialUser.phone,
                email: googleUserData.email,
                image_url: googleUserData.picture,
              };

              await sendTokenWithResponse(user, res);
            }
          );
        }
      );
    }
  );
};

const updateUserProfileFromFacebook = async (req: Request, res: Response) => {
  const { accessToken } = req.body;
  const initialUser = (req as any).user.user;

  if (!accessToken) {
    throw new BadRequestError("Access token is required");
  }

  const { data } = await axios({
    url: "https://graph.facebook.com/me",
    method: "get",
    params: {
      fields: ["id", "email", "first_name", "last_name", "picture"].join(","),
      access_token: accessToken,
    },
  });
  const fbUserData: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    picture: {} | null;
  } = data;

  const con = await connectDB();
  console.log(initialUser);

  con.query(
    "SELECT * FROM users where id = ?",
    [initialUser.userId],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      if (resp.length === 0) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ msg: "User does not exist" });
      }

      con.query(
        "SELECT * FROM users where facebook_id = ?",
        [fbUserData.id],
        async (err, resp) => {
          if (err) {
            return res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({ msg: "Database error" });
          }

          if (resp.length > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
              msg: "A user with this Facebook account already exists. Log in with the account if you are the owner",
            });
          }

          con.query(
            "UPDATE users SET email = ?, first_name = ?, last_name = ?, image_url = ?, facebook_id = ? WHERE id = ?",
            [
              fbUserData.email,
              fbUserData.first_name,
              fbUserData.last_name,
              (fbUserData.picture as any)["data"]["url"],
              fbUserData.id,
              initialUser.userId,
            ],
            async (err, resp) => {
              if (err) {
                return res
                  .status(StatusCodes.INTERNAL_SERVER_ERROR)
                  .json({ msg: "Database error" });
              }
              const user: {
                id: number;
                first_name: string | null;
                last_name: string | null;
                phone: string | null;
                email: string | null;
                image_url: string | null;
              } = {
                id: initialUser.userId,
                first_name: fbUserData.first_name,
                last_name: fbUserData.last_name,
                phone: initialUser.phone,
                email: fbUserData.email,
                image_url: (fbUserData.picture as any)["data"]["url"],
              };

              await sendTokenWithResponse(user, res);
            }
          );
        }
      );
    }
  );
};
const verifyAndUpdatePhone = async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  const initialUser = (req as any).user.user;
  const userId = (req as any).user.user.userId;
  const initialPhone = (req as any).user.user.phone;

  if (!phone || !otp) {
    throw new BadRequestError("Phone number and OTP are required");
  }

  if (initialPhone === phone) {
    throw new BadRequestError(
      "New phone number is the same is the current phone number"
    );
  }

  const con = await connectDB();
  con.query(
    "SELECT * FROM otps WHERE phone = ?",
    [phone],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      if (resp.length === 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          msg: `There is currently no OTP verification process going on for phone: ${phone}`,
        });
      }

      const isValidOTP =
        resp[0].otp === otp &&
        new Date(resp[0].otp_expiration_datetime).getTime() >
          new Date().getTime();

      if (!isValidOTP) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ msg: `Invalid credentials` });
      }

      con.query(
        "DELETE FROM otps WHERE phone = ?",
        [phone],
        async (err, resp2) => {
          if (err) {
            return res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({ msg: "Database error" });
          }

          con.query(
            "SELECT * FROM users WHERE phone = ?",
            [phone],
            async (err, resp3) => {
              if (err) {
                return res
                  .status(StatusCodes.INTERNAL_SERVER_ERROR)
                  .json({ msg: "Database error" });
              }

              if (resp3.length > 0) {
                return res
                  .status(StatusCodes.BAD_REQUEST)
                  .json({ msg: `A user already exists with phone: ${phone}` });
              }

              con.query(
                "UPDATE users SET phone = ? WHERE id = ?",
                [phone, userId],
                async (err, resp4) => {
                  if (err) {
                    return res
                      .status(StatusCodes.INTERNAL_SERVER_ERROR)
                      .json({ msg: "Database error" });
                  }

                  const user: {
                    id: number;
                    first_name: string | null;
                    last_name: string | null;
                    phone: string | null;
                    email: string | null;
                    image_url: string | null;
                  } = {
                    phone,
                    id: initialUser.userId,

                    first_name: initialUser.first_name,
                    last_name: initialUser.last_name,
                    email: initialUser.email,
                    image_url: initialUser.image_url,
                  };

                  await sendTokenWithResponse(user, res);
                }
              );
            }
          );
        }
      );
    }
  );
};

const getMyProfile = async (req: Request, res: Response) => {
  res.json({ user: (req as any).user.user });
};

const updateDriverProfile = async (req: Request, res: Response) => {
  const {
    firstName,
    lastName,
    driverLicense,
    licenseImageUrl,
    profilePhotoImageUrl,
    carExtPhotoImageUrl,
    carIntPhotoImageUrl,
    billingType,
    address,
    companyName,
    companyRegistrationCode,
    bankAccountHolderName,
    bankAccountNumber,
    bankName,
  } = req.body;
  const driverId = (req as any).user.user.userId;

  const updateFields = (): Map<string, string> => {
    const fields = new Map<string, string>();

    if (firstName) {
      fields.set("first_name", firstName);
    }
    if (lastName) {
      fields.set("last_name", lastName);
    }
    if (driverLicense) {
      fields.set("driver_license", driverLicense);
    }
    if (licenseImageUrl) {
      fields.set("license_img_url", licenseImageUrl);
    }
    if (profilePhotoImageUrl) {
      fields.set("profile_photo_img_url", profilePhotoImageUrl);
    }
    if (carExtPhotoImageUrl) {
      fields.set("car_ext_photo_img_url", carExtPhotoImageUrl);
    }
    if (carIntPhotoImageUrl) {
      fields.set("car_int_photo_img_url", carIntPhotoImageUrl);
    }
    if (billingType) {
      switch ((billingType as string).toLowerCase()) {
        case "person":
          fields.set("billing_type", "PERSON");
          break;
        case "company":
          fields.set("billing_type", "COMPANY");
          break;
        default:
          throw new BadRequestError(
            'Billing type can only be "PERSON" or "COMPANY"'
          );
      }
    }
    if (address) {
      fields.set("address", address);
    }
    if (companyName) {
      if ((billingType as string).toLowerCase() !== "company") {
        throw new BadRequestError(
          'Company name can only be set when billing type is "COMPANY"'
        );
      }
      fields.set("company_name", companyName);
    }
    if (companyRegistrationCode) {
      if ((billingType as string).toLowerCase() !== "company") {
        throw new BadRequestError(
          'Company registration code can only be set when billing type is "COMPANY"'
        );
      }
      fields.set("company_registration_code", companyRegistrationCode);
    }
    if (bankAccountHolderName || bankAccountNumber || bankName) {
      if (!(bankAccountHolderName && bankAccountNumber && bankName)) {
        throw new BadRequestError(
          "Bank account holder's name, account number and bank name are mutually inclusive"
        );
      }
      fields.set("bank_account_holder_name", bankAccountHolderName);
      fields.set("bank_account_number", bankAccountNumber);
      fields.set("bank_name", bankName);
    }

    return fields;
  };

  if (updateFields().size === 0) {
    throw new BadRequestError("Provide at least one field to be updated");
  }

  let innerSQLString = "";
  let count = 0;
  updateFields().forEach((value, key) => {
    count++;
    innerSQLString += `${key} = ?${count < updateFields().size ? "," : ""}`;
  });

  const con = await connectDB();
  con.query(
    `UPDATE drivers SET ${innerSQLString} ${
      (billingType as string).toLowerCase() === "person"
        ? ", company_name = NULL, company_registration_code = NULL"
        : ""
    } WHERE id = ?`,
    [...updateFields().values(), driverId],
    async (err, resp3) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }
      const initialUser = (req as any).user.user;

      const user: {
        id: number;
        first_name: string | null;
        last_name: string | null;
        phone: string | null;
        email: string | null;
        image_url: string | null;
      } = {
        first_name: firstName ?? initialUser.first_name,
        last_name: lastName ?? initialUser.last_name,
        phone: initialUser.phone,
        email: initialUser.email,
        image_url: profilePhotoImageUrl ?? initialUser.image_url,
        id: initialUser.userId,
      };

      await sendDriverTokenWithResponse(user, res);
    }
  );
};
const verifyAndUpdateDriverPhone = async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  const driver = (req as any).user.user;

  if (!phone || !otp) {
    throw new BadRequestError("Phone number and OTP are required");
  }

  const con = await connectDB();
  con.query(
    "SELECT * FROM driver_otps WHERE phone = ?",
    [phone],
    async (err, resp) => {
      if (err) {
        return res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({ msg: "Database error" });
      }

      if (resp.length === 0) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          msg: `There is currently no Driver OTP verification process going on for phone: ${phone}`,
        });
      }

      const isValidOTP =
        resp[0].otp === otp &&
        resp[0].driver_id === driver.userId &&
        new Date(resp[0].otp_expiration_datetime).getTime() >
          new Date().getTime();

      if (!isValidOTP) {
        return res
          .status(StatusCodes.BAD_REQUEST)
          .json({ msg: `Invalid credentials` });
      }

      con.query(
        "DELETE FROM driver_otps WHERE phone = ?",
        [phone],
        async (err, resp2) => {
          if (err) {
            return res
              .status(StatusCodes.INTERNAL_SERVER_ERROR)
              .json({ msg: "Database error" });
          }
          con.query(
            "SELECT * FROM drivers WHERE phone = ?",
            [phone],
            async (err, resp3) => {
              if (err) {
                return res
                  .status(StatusCodes.INTERNAL_SERVER_ERROR)
                  .json({ msg: "Database error" });
              }

              if (resp3.length > 0) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                  msg: `A driver already exists with phone: ${phone}`,
                });
              }
              con.query(
                "SELECT * FROM drivers WHERE id = ?",
                [driver.userId],
                async (err, resp4) => {
                  if (err) {
                    return res
                      .status(StatusCodes.INTERNAL_SERVER_ERROR)
                      .json({ msg: "Database error" });
                  }

                  const gottenDriver = resp4[0];
                  if (!gottenDriver) {
                    return res.status(StatusCodes.NOT_FOUND).json({
                      msg: `There is no driver found with id: ${driver.userId}`,
                    });
                  }

                  con.query(
                    "UPDATE drivers SET phone = ? WHERE id = ?",
                    [phone, driver.userId],
                    async (err, resp5) => {
                      if (err) {
                        return res
                          .status(StatusCodes.INTERNAL_SERVER_ERROR)
                          .json({ msg: "Database error" });
                      }
                      const driver = {
                        ...gottenDriver,
                        phone: phone,
                      };
                      sendDriverTokenWithResponse(driver, res);
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
};
const getMyDriverProfile = async (req: Request, res: Response) => {
  res.json({ user: (req as any).user.user });
};

export {
  updateUserProfile,
  verifyAndUpdatePhone,
  updateUserProfileFromFacebook,
  updateUserProfileFromGoogle,
  getMyProfile,
  updateDriverProfile,
  verifyAndUpdateDriverPhone,
  getMyDriverProfile,
};
