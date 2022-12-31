import { Request, Response } from "express";
import { BadRequestError } from "../errors";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

const uploadImage = async (req: Request, res: Response) => {
  if (!req.files) {
    throw new BadRequestError("No File Uploaded");
  }
  const { image } = req.files;
  if (!(image as any).mimetype.startsWith("image")) {
    throw new BadRequestError("Please Upload Image");
  }
  const oneMB = 1024 * 1024;
  if ((image as any).size >= oneMB) {
    throw new BadRequestError("Please upload image smaller than 1MB");
  }

  const result = await cloudinary.uploader.upload((image as any).tempFilePath, {
    use_filename: true,
    folder: "file-upload",
  });
  fs.unlinkSync((image as any).tempFilePath);
  res.json({ image: { src: result.secure_url } });
};

export { uploadImage };
