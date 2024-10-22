import express from "express"
import { connectDb } from "./DataBase/mongodb.js";
import dotenv from "dotenv";
import User from "./models/User.js";
import mongoose from "mongoose";
import userRoutes from "./routes/user.route.js";
import potRoutes from "./routes/pot.route.js";
import historyRoutes from "./routes/history.route.js";

dotenv.config();

const app = express()
app.use(express.json())

app.use("/api/users", userRoutes);  // Ścieżka użytkownika - główna
app.use("/api/users/:userId/pots", potRoutes); // Ścieżka z doniczkami - powiązana z userId bo jest doniczki per user
app.use("/api/users/:userId/pots/:potId/watering", historyRoutes); // Ścieżka związana z historią podlewania per doniczka - powiązana z potId bo jes historia podlewania per doniczka

app.get("/", (req, res) => {
    res.send("Ready to work");
});


app.listen(5000, () => {
    connectDb();
    console.log("Server started at https://localhost:5000")
});

export default app