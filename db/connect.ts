import mysql, { Connection } from "mysql";

const connectDB = () =>
  new Promise<Connection>((resolve, reject) => {
    const con = mysql.createConnection({
      host: process.env.DATABASE_HOST,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
    });

    con.connect((err: Error) => {
      if (err) {
        console.log(err);
        reject();
        return;
      }
      resolve(con);
      // const user = { first_name: "Craig Buckler", phone: +234902 };
      // con.query("INSERT INTO users SET ?", user, (err, res) => {
      //   if (err) throw err;

      //   console.log("Last insert ID:", res.insertId);
      // });
    });
  });

export default connectDB;
