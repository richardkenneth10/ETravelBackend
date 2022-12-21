import mysql, { Connection } from "mysql";

const connectDB = () =>
  new Promise<Connection>((resolve, reject) => {
    const con = mysql.createConnection({
      host: "database-1.cluster-c5wjyxdbbmlo.us-east-1.rds.amazonaws.com",
      user: "admin",
      password: "richiemysql",
      database: "etravel",
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
