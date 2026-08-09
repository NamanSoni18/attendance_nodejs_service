const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  student_id: { type: String, required: true },
  name: { type: String, required: true },
  rollNo: { type: String, required: true },
  department: { type: String, required: true },
  rfid_uid: { type: String, required: true, unique: true },
  face_embedding: { type: [Number], default: [] },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Student", studentSchema);
