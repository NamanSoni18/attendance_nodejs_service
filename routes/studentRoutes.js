const express = require("express");
const { body, param } = require("express-validator");

const {
  createStudent,
  getAllStudents,
  getStudentById,
  getStudentByUID,
  updateStudent,
  deleteStudent,
  enrollStudent
} = require("../controllers/studentController");
const validateRequest = require("../middleware/validateRequest");

const router = express.Router();

const createStudentValidation = [
  body("uid")
    .trim()
    .notEmpty()
    .withMessage("UID is required")
    .toUpperCase(),
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("rollNo").trim().notEmpty().withMessage("Roll number is required"),
  body("department").trim().notEmpty().withMessage("Department is required"),
];

const updateStudentValidation = [
  param("id").isMongoId().withMessage("Invalid student ID"),
  body("uid")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("UID cannot be empty")
    .toUpperCase(),
  body("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Name cannot be empty"),
  body("rollNo")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Roll number cannot be empty"),
  body("department")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Department cannot be empty"),
];

router.post('/enroll', enrollStudent);
router.post("/", createStudentValidation, validateRequest, createStudent);
router.get("/", getAllStudents);
router.get("/uid/:uid", getStudentByUID);
router.get("/:id", [param("id").isMongoId().withMessage("Invalid student ID")], validateRequest, getStudentById);
router.put("/:id", updateStudentValidation, validateRequest, updateStudent);
router.delete("/:id", [param("id").isMongoId().withMessage("Invalid student ID")], validateRequest, deleteStudent);

module.exports = router;
