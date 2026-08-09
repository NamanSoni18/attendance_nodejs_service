const express = require("express");
const { body } = require("express-validator");

const verifyController = require("../controllers/verifyController");
const validateRequest = require("../middleware/validateRequest");

const router = express.Router();

const verifyValidation = [
  body("uid")
    .trim()
    .notEmpty()
    .withMessage("UID is required")
    .toUpperCase(),
];

router.post("/", verifyController.verifyAttendance);

module.exports = router;
