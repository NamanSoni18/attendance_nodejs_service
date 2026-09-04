const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

const connectDB = require("./config/db");
const studentRoutes = require("./routes/studentRoutes");
const verifyRoutes = require("./routes/verifyRoutes");
const errorHandler = require("./middleware/errorHandler");
const { waitForAttendanceResult } = require("./utils/pendingAttendance");

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.status(200).json({ message: "RFID Student API Running" });
});

app.post('/api/rfid-trigger', async (req, res) => {
    const { rfid_uid } = req.body;
    if (rfid_uid) {
        console.log(`[RFID] Trigger received for UID: ${rfid_uid}`);

      const resultPromise = waitForAttendanceResult(rfid_uid);
        io.emit('capture_face', { rfid_uid });

      const result = await resultPromise;
      res.status(result.status === 'Error' ? 504 : 200).json(result);
    } else {
        res.status(400).json({ error: "No UID provided" });
    }
});

app.use("/api/students", studentRoutes);
app.use("/api/verify", verifyRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
