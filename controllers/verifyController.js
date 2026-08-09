const axios = require('axios');
const Student = require('../models/Student');
const fs = require('fs');     // Built-in File System module
const path = require('path'); // Built-in Path module

exports.verifyAttendance = async (req, res) => {
    try {
        console.log("\n--- NEW SCAN RECEIVED ---");
        const { rfid_uid, image_base64 } = req.body;

        if (!rfid_uid || !image_base64) {
            console.log("[ERROR] Missing payload. rfid_uid or image_base64 is empty.");
            return res.status(400).json({ status: "Failed", message: "Missing Payload" });
        }

        console.log(`[STEP 1] ESP32 Sent RFID: ${rfid_uid}`);

        // Search MongoDB for the student using 'uid'
        const student = await Student.findOne({ uid: rfid_uid });
        
        if (!student) {
            console.log(`[STEP 2] REJECTED: Card ${rfid_uid} is not in the database.`);
            return res.status(200).json({ status: "Rejected", message: "Unknown Card" });
        }

        if (!student.face_embedding || student.face_embedding.length === 0) {
            console.log(`[STEP 2] REJECTED: ${student.name} exists, but has no face embedding in DB!`);
            return res.status(200).json({ status: "Rejected", message: "No Face in DB" });
        }

        console.log(`[STEP 2] Student Found: ${student.name}.`);

        // =======================================================
        // NEW FEATURE: SAVE THE IMAGE TO THE NODE.JS SERVER DISK
        // =======================================================
        try {
            // 1. Define the directory path (e.g., backend/uploads/attendance_captures)
            const uploadDir = path.join(__dirname, '../uploads/attendance_captures');
            
            // 2. Create the folder if it doesn't exist yet
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            // 3. Create a unique filename: Name_RollNo_Timestamp.jpg
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const safeName = student.name.replace(/\s+/g, '_'); // Replace spaces with underscores
            const filename = `${safeName}_${student.rollNo}_${timestamp}.jpg`;
            const filepath = path.join(uploadDir, filename);

            // 4. Convert Base64 back to binary image data and save it
            const imageBuffer = Buffer.from(image_base64, 'base64');
            fs.writeFileSync(filepath, imageBuffer);
            
            console.log(`[IMAGE SAVED] Successfully saved to: ${filepath}`);
        } catch (fileError) {
            console.error("[FILE ERROR] Could not save the image:", fileError.message);
            // We won't return an error here, so the verification process can still continue even if saving fails.
        }
        // =======================================================

        console.log(`[STEP 3] Forwarding to Python ML for Face Match...`);

        // Send to Python ML Microservice
        try {
            const mlResponse = await axios.post('http://127.0.0.1:8000/api/v1/attendance/verify', {
                rfid_uid: rfid_uid,
                image_base64: image_base64,
                stored_embedding: student.face_embedding
            });

            const mlData = mlResponse.data;

            if (mlData.is_match) {
                console.log(`[STEP 4] SUCCESS: Face matches ${student.name}! Confidence: ${mlData.confidence}`);
                return res.status(200).json({
                    status: "Success",
                    student: { 
                        name: student.name, 
                        rollNo: student.rollNo,
                        department: student.department || "MCA"
                    }
                });
            } else {
                console.log(`[STEP 4] PROXY DETECTED: Face does NOT match ${student.name}. Confidence: ${mlData.confidence}`);
                return res.status(200).json({ status: "Rejected", message: "Face Mismatch" });
            }

        } catch (mlError) {
            if (mlError.response && mlError.response.status === 400) {
                console.log(`[PYTHON ERROR] ${mlError.response.data.detail}`);
                return res.status(200).json({ status: "Rejected", message: "No Face Found" });
            }
            console.log(`[PYTHON ERROR] Python server is unreachable. Is Uvicorn running?`);
            return res.status(500).json({ status: "Error", message: "ML Server Offline" });
        }

    } catch (error) {
        console.error("[SERVER ERROR]", error.message);
        return res.status(500).json({ status: "Error", message: "Server Error" });
    }
};