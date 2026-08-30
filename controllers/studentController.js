const mongoose = require("mongoose");
const axios = require('axios');
const Student = require("../models/Student");

const handleDuplicateKeyError = (error) => {
  if (error && error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || "field";
    const err = new Error(`${field} already exists`);
    err.statusCode = 409;
    throw err;
  }
};

const enrollFace = async (req, res) => {
    const { rfid_uid, new_embedding } = req.body; // new_embedding comes from your ML service
    
    try {
        // CHANGED: Use $push to append the new embedding to the array
        const student = await Student.findOneAndUpdate(
            { uid: rfid_uid },
            { $push: { face_embeddings: new_embedding } },
            { new: true }
        );
        
        if (!student) {
            return res.status(404).json({ message: "Student not found" });
        }
        res.status(200).json({ status: "Success", message: "Face added to profile", student });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const enrollStudent = async (req, res) => {
    try {
        const { name, rollNo, department, rfid_uid, image_base64 } = req.body;

        if (!rfid_uid || !image_base64) {
            return res.status(400).json({ status: "Failed", message: "RFID and Image are required" });
        }

        console.log(`[ENROLLMENT] Generating face embedding for ${name}...`);

        // 1. Forward the image to the Python ML Microservice
        const mlResponse = await axios.post('http://127.0.0.1:8000/api/v1/enrollment/generate-embedding', {
            student_id: rfid_uid,
            image_base64: image_base64
        });

        const face_embedding = mlResponse.data.embedding;

        // 2. Save or Update the student in MongoDB
        const student = await Student.findOneAndUpdate(
            { uid: rfid_uid }, // Search by RFID UID
            { 
                name: name, 
                rollNo: rollNo, 
                department: department, 
                uid: rfid_uid, 
                face_embedding: face_embedding // The 512-D array from Python
            },
            { new: true, upsert: true } // Update if exists, create new if not
        );

        console.log(`[ENROLLMENT SUCCESS] ${name} registered in database.`);
        return res.status(201).json({ 
            status: "Success", 
            message: "Student successfully enrolled with Face 2FA!", 
            student 
        });

    } catch (error) {
        // Handle Python "No Face Detected" errors
        if (error.response && error.response.status === 400) {
            console.log(`[ENROLLMENT FAILED] ${error.response.data.detail}`);
            return res.status(400).json({ status: "Failed", message: error.response.data.detail });
        }
        
        console.error("[ENROLLMENT ERROR]", error.message);
        return res.status(500).json({ status: "Error", message: "Internal Server Error" });
    }
};

const createStudent = async (req, res, next) => {
  try {
    const { uid, name, rollNo, department } = req.body;

    const student = await Student.create({ uid, name, rollNo, department });

    return res.status(201).json({
      success: true,
      message: "Student added successfully",
      student,
    });
  } catch (error) {
    try {
      handleDuplicateKeyError(error);
    } catch (dupError) {
      return next(dupError);
    }
    return next(error);
  }
};

const getAllStudents = async (req, res, next) => {
  try {
    const students = await Student.find().sort({ name: 1 });

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    return next(error);
  }
};

const getStudentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    return next(error);
  }
};

const getStudentByUID = async (req, res, next) => {
  try {
    const { uid } = req.params;
    const normalizedUID = uid.trim().toUpperCase();

    const student = await Student.findOne({ uid: normalizedUID }).select(
      "uid name rollNo department"
    );

    if (!student) {
      return res.status(404).json({
        verified: false,
        message: "Card not registered",
      });
    }

    return res.status(200).json({
      verified: true,
      student,
    });
  } catch (error) {
    return next(error);
  }
};

const updateStudent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const updates = {};

    if (req.body.uid !== undefined) updates.uid = req.body.uid;
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.rollNo !== undefined) updates.rollNo = req.body.rollNo;
    if (req.body.department !== undefined) updates.department = req.body.department;

    const student = await Student.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      student,
    });
  } catch (error) {
    try {
      handleDuplicateKeyError(error);
    } catch (dupError) {
      return next(dupError);
    }
    return next(error);
  }
};

const deleteStudent = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await Student.findByIdAndDelete(id);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createStudent,
  getAllStudents,
  getStudentById,
  getStudentByUID,
  updateStudent,
  deleteStudent,
  enrollStudent,
  enrollFace,
};
