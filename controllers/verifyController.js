const axios = require('axios');
const Student = require('../models/Student');
const fs = require('fs');     // Built-in File System module
const path = require('path'); // Built-in Path module
const { resolveAttendanceResult } = require('../utils/pendingAttendance');

const SCAN_LOG_PATH = path.join(__dirname, '../data/scan_results.json');
const RFID_LOG_PATH = path.join(__dirname, '../data/rfid_distance_accuracy.json');

const ensureScanLogFile = () => {
    const logDir = path.dirname(SCAN_LOG_PATH);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    if (!fs.existsSync(SCAN_LOG_PATH)) {
        fs.writeFileSync(SCAN_LOG_PATH, JSON.stringify([], null, 2), 'utf8');
    }
};

const ensureRfidLogFile = () => {
    const logDir = path.dirname(RFID_LOG_PATH);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    if (!fs.existsSync(RFID_LOG_PATH)) {
        fs.writeFileSync(RFID_LOG_PATH, JSON.stringify({
            distance_m: [],
            read_accuracy_percent: [],
            signal_strength_dbm: [],
            scanned_at: []
        }, null, 2), 'utf8');
    }
};

const estimateDistanceFromRssi = (rssiDbm, rssiAtOneMeter = -55.0, pathLossExponent = 2.2) => {
    if (rssiDbm === undefined || rssiDbm === null || Number.isNaN(Number(rssiDbm))) {
        return null;
    }
    const rss = Number(rssiDbm);
    return Number(Math.pow(10, (rssiAtOneMeter - rss) / (10 * pathLossExponent)).toFixed(3));
};

const saveScanResult = ({ uid, name, result, confidence, message }) => {
    try {
        ensureScanLogFile();

        const raw = fs.readFileSync(SCAN_LOG_PATH, 'utf8') || '[]';
        const entries = raw.trim() ? JSON.parse(raw) : [];

        const logEntry = {
            scan_id: `scan_${Date.now()}`,
            uid: uid || 'unknown',
            name: name || 'Unknown',
            result: result || 'unknown',
            accepted: result === 'accepted' || result === 'Success',
            confidence: Number(confidence || 0),
            threshold: 0.68,
            message: message || '',
            scanned_at: new Date().toISOString()
        };

        entries.push(logEntry);
        fs.writeFileSync(SCAN_LOG_PATH, JSON.stringify(entries, null, 2), 'utf8');
        console.log(`[LOG SAVED] ${logEntry.result.toUpperCase()} - UID: ${logEntry.uid} - Confidence: ${logEntry.confidence}`);
    } catch (error) {
        console.error('[LOG ERROR] Could not save scan result:', error.message);
    }
};

const saveRfidMeasurement = ({ uid, distance_m, signal_strength_dbm, read_accuracy_percent, accuracy_percent }) => {
    try {
        ensureRfidLogFile();

        const raw = fs.readFileSync(RFID_LOG_PATH, 'utf8') || '{}';
        const log = raw.trim() ? JSON.parse(raw) : { distance_m: [], read_accuracy_percent: [], signal_strength_dbm: [], scanned_at: [] };

        const measurement = {
            uid: uid || 'unknown',
            distance_m: distance_m !== undefined && distance_m !== null ? Number(distance_m) : null,
            signal_strength_dbm: signal_strength_dbm !== undefined && signal_strength_dbm !== null ? Number(signal_strength_dbm) : null,
            read_accuracy_percent: read_accuracy_percent !== undefined && read_accuracy_percent !== null ? Number(read_accuracy_percent) : (accuracy_percent !== undefined && accuracy_percent !== null ? Number(accuracy_percent) : null),
            scanned_at: new Date().toISOString()
        };

        if (measurement.distance_m === null && measurement.signal_strength_dbm !== null) {
            measurement.distance_m = estimateDistanceFromRssi(measurement.signal_strength_dbm);
        }

        if (measurement.distance_m === null && measurement.read_accuracy_percent !== null) {
            measurement.distance_m = Math.max(0, (100 - measurement.read_accuracy_percent) / 12);
        }

        if (measurement.read_accuracy_percent === null && measurement.distance_m !== null) {
            measurement.read_accuracy_percent = Math.max(0, Math.min(100, 100 - (measurement.distance_m * 12)));
        }

        if (measurement.distance_m === null && measurement.signal_strength_dbm === null && measurement.read_accuracy_percent === null) {
            return;
        }

        if (!Array.isArray(log.distance_m)) log.distance_m = [];
        if (!Array.isArray(log.read_accuracy_percent)) log.read_accuracy_percent = [];
        if (!Array.isArray(log.signal_strength_dbm)) log.signal_strength_dbm = [];
        if (!Array.isArray(log.scanned_at)) log.scanned_at = [];

        log.distance_m.push(measurement.distance_m);
        log.read_accuracy_percent.push(measurement.read_accuracy_percent);
        log.signal_strength_dbm.push(measurement.signal_strength_dbm);
        log.scanned_at.push(measurement.scanned_at);

        fs.writeFileSync(RFID_LOG_PATH, JSON.stringify(log, null, 2), 'utf8');
        console.log(`[RFID LOG] saved distance=${measurement.distance_m} m | RSSI=${measurement.signal_strength_dbm} dBm | accuracy=${measurement.read_accuracy_percent}%`);
    } catch (error) {
        console.error('[RFID LOG ERROR] Could not save RFID measurement:', error.message);
    }
};

const getStudentEmbeddings = (student) => {
    const current = Array.isArray(student?.face_embeddings) ? student.face_embeddings : [];
    const legacy = Array.isArray(student?.face_embedding) ? student.face_embedding : [];

    if (current.length > 0) return current;
    if (legacy.length > 0) return [legacy];
    return [];
};

const sendVerificationResult = (res, uid, result, statusCode = 200) => {
    resolveAttendanceResult(uid, result);
    return res.status(statusCode).json(result);
};

exports.verifyAttendance = async (req, res) => {
    try {
        console.log("\n--- NEW SCAN RECEIVED ---");
        const {
            rfid_uid,
            image_base64,
            distance_m,
            signal_strength_dbm,
            rssi,
            read_accuracy_percent,
            accuracy_percent
        } = req.body;

        if (!rfid_uid || !image_base64) {
            console.log("[ERROR] Missing payload. rfid_uid or image_base64 is empty.");
            return res.status(400).json({ status: "Failed", message: "Missing Payload" });
        }

        const estimatedDistance = distance_m !== undefined && distance_m !== null ? Number(distance_m) : estimateDistanceFromRssi(rssi ?? signal_strength_dbm);
        saveRfidMeasurement({
            uid: rfid_uid,
            distance_m: estimatedDistance,
            signal_strength_dbm: signal_strength_dbm ?? rssi ?? null,
            read_accuracy_percent: read_accuracy_percent ?? accuracy_percent ?? null,
            accuracy_percent: accuracy_percent ?? read_accuracy_percent ?? null
        });

        console.log(`[STEP 1] ESP32 Sent RFID: ${rfid_uid}`);

        // Search MongoDB for the student using 'uid'
        const student = await Student.findOne({ uid: rfid_uid });
        
        if (!student) {
            console.log(`[STEP 2] REJECTED: Card ${rfid_uid} is not in the database.`);
            return sendVerificationResult(res, rfid_uid, { status: "Rejected", message: "Unknown Card" });
        }

        const studentEmbeddings = getStudentEmbeddings(student);

        if (studentEmbeddings.length === 0) {
            console.log(`[STEP 2] REJECTED: ${student.name} exists, but has no face embedding in DB!`);
            return sendVerificationResult(res, rfid_uid, {
                status: "Rejected",
                name: student.name,
                roll_no: student.rollNo,
                message: "No Face in DB"
            });
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
                stored_embedding: studentEmbeddings[0],
                stored_embeddings: studentEmbeddings
            });

            const mlData = mlResponse.data || {};
            const isMatch = typeof mlData.is_match === "boolean" ? mlData.is_match : Boolean(mlData.match);
            const confidence = Number(mlData.confidence ?? 0);

            if (isMatch) {
                console.log(`[STEP 4] SUCCESS: Face matches ${student.name}! Confidence: ${confidence}`);
                saveScanResult({
                    uid: rfid_uid,
                    name: student.name,
                    result: 'accepted',
                    confidence,
                    message: 'Face matches student.'
                });
                saveRfidMeasurement({
                    uid: rfid_uid,
                    distance_m: estimatedDistance,
                    signal_strength_dbm: signal_strength_dbm ?? rssi ?? null,
                    read_accuracy_percent: read_accuracy_percent ?? accuracy_percent ?? (Number(confidence) * 100),
                    accuracy_percent: accuracy_percent ?? read_accuracy_percent ?? (Number(confidence) * 100)
                });
                return sendVerificationResult(res, rfid_uid, {
                    status: "Success",
                    name: student.name,
                    roll_no: student.rollNo,
                    student: {
                        name: student.name,
                        rollNo: student.rollNo,
                        department: student.department || "MCA"
                    }
                });
            } else {
                console.log(`[STEP 4] PROXY DETECTED: Face does NOT match ${student.name}. Confidence: ${confidence}`);
                saveScanResult({
                    uid: rfid_uid,
                    name: student.name,
                    result: 'rejected',
                    confidence,
                    message: 'Face mismatch.'
                });
                saveRfidMeasurement({
                    uid: rfid_uid,
                    distance_m: estimatedDistance,
                    signal_strength_dbm: signal_strength_dbm ?? rssi ?? null,
                    read_accuracy_percent: read_accuracy_percent ?? accuracy_percent ?? Math.max(0, (Number(confidence) * 100)),
                    accuracy_percent: accuracy_percent ?? read_accuracy_percent ?? Math.max(0, (Number(confidence) * 100))
                });
                return sendVerificationResult(res, rfid_uid, {
                    status: "Rejected",
                    name: student.name,
                    roll_no: student.rollNo,
                    message: "Face Mismatch"
                });
            }

        } catch (mlError) {
            if (mlError.response && mlError.response.status === 400) {
                console.log(`[PYTHON ERROR] ${mlError.response.data.detail}`);
                return sendVerificationResult(res, rfid_uid, {
                    status: "Rejected",
                    name: student.name,
                    roll_no: student.rollNo,
                    message: "No Face Found"
                });
            }
            console.log(`[PYTHON ERROR] Python server is unreachable. Is Uvicorn running?`);
            return sendVerificationResult(res, rfid_uid, { status: "Error", message: "ML Server Offline" }, 500);
        }

    } catch (error) {
        console.error("[SERVER ERROR]", error.message);
        return sendVerificationResult(res, rfid_uid, { status: "Error", message: "Server Error" }, 500);
    }
};