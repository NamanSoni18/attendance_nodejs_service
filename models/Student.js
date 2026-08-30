const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    uid: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    rollNo: { type: String, required: true },
    department: { type: String, required: true },
    // CHANGED: 'face_embedding' is now 'face_embeddings' (Array of Arrays)
    face_embeddings: { type: [[Number]], default: [] } 
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);