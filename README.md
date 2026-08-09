# RFID Student Verification Backend

Production-ready REST API backend for IoT RFID student registration and verification.

## Tech Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- dotenv
- cors
- morgan
- nodemon
- express-validator

## Features

- Register students with RFID UID
- Retrieve all students sorted by name
- Retrieve student by MongoDB ID
- Verify RFID UID (for ESP32-CAM integration)
- Update student details with duplicate protection
- Delete student records
- Centralized error handling
- Request validation with JSON error responses

## Project Structure

```
backend/
│
├── package.json
├── server.js
├── .env
├── .gitignore
│
├── config/
│   └── db.js
│
├── models/
│   └── Student.js
│
├── controllers/
│   └── studentController.js
│   └── verifyController.js
│
├── routes/
│   └── studentRoutes.js
│   └── verifyRoutes.js
│
├── middleware/
│   ├── errorHandler.js
│   └── validateRequest.js
│
└── utils/
```

## Environment Variables

Create/update `.env`:

```
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/rfid_student_db
```

## Install and Run

```bash
npm install
npm run dev
```

Server starts only after successful MongoDB connection.

## Base URL

```text
http://localhost:5000
```

## API Endpoints

### 1) Health Check

- Method: `GET`
- URL: `/`

Response:

```json
{
  "message": "RFID Student API Running"
}
```

### 2) Create Student

- Method: `POST`
- URL: `/api/students`

Request:

```json
{
  "uid": "4A9F2C81",
  "name": "Naman Soni",
  "rollNo": "24112015",
  "department": "MCA"
}
```

Success Response (201):

```json
{
  "success": true,
  "message": "Student added successfully",
  "student": {
    "_id": "66d0afdf96e5f7d2f3b1a111",
    "uid": "4A9F2C81",
    "name": "Naman Soni",
    "rollNo": "24112015",
    "department": "MCA",
    "createdAt": "2026-08-05T10:30:00.000Z",
    "updatedAt": "2026-08-05T10:30:00.000Z",
    "__v": 0
  }
}
```

Validation Error (400):

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "type": "field",
      "value": "",
      "msg": "UID is required",
      "path": "uid",
      "location": "body"
    }
  ]
}
```

Duplicate Error (409):

```json
{
  "success": false,
  "message": "uid already exists"
}
```

### 3) Get All Students

- Method: `GET`
- URL: `/api/students`

Success Response (200):

```json
{
  "success": true,
  "count": 1,
  "students": [
    {
      "_id": "66d0afdf96e5f7d2f3b1a111",
      "uid": "4A9F2C81",
      "name": "Naman Soni",
      "rollNo": "24112015",
      "department": "MCA",
      "createdAt": "2026-08-05T10:30:00.000Z",
      "updatedAt": "2026-08-05T10:30:00.000Z",
      "__v": 0
    }
  ]
}
```

### 4) Get Student By Mongo ID

- Method: `GET`
- URL: `/api/students/:id`

Not Found (404):

```json
{
  "success": false,
  "message": "Student not found"
}
```

### 5) Get Student By RFID UID (ESP32 Endpoint)

- Method: `GET`
- URL: `/api/students/uid/:uid`

If found (200):

```json
{
  "verified": true,
  "student": {
    "uid": "4A9F2C81",
    "name": "Naman Soni",
    "rollNo": "24112015",
    "department": "MCA"
  }
}
```

If not found (404):

```json
{
  "verified": false,
  "message": "Card not registered"
}
```

### 6) Update Student

- Method: `PUT`
- URL: `/api/students/:id`

Request (example):

```json
{
  "uid": "4A9F2C82",
  "name": "Naman Soni",
  "rollNo": "24112016",
  "department": "MCA"
}
```

Success Response (200):

```json
{
  "success": true,
  "message": "Student updated successfully",
  "student": {
    "_id": "66d0afdf96e5f7d2f3b1a111",
    "uid": "4A9F2C82",
    "name": "Naman Soni",
    "rollNo": "24112016",
    "department": "MCA",
    "createdAt": "2026-08-05T10:30:00.000Z",
    "updatedAt": "2026-08-05T10:35:00.000Z",
    "__v": 0
  }
}
```

### 7) Delete Student

- Method: `DELETE`
- URL: `/api/students/:id`

Success Response (200):

```json
{
  "success": true,
  "message": "Student deleted successfully"
}
```

### 8) Verify RFID UID (ESP32 POST Endpoint)

- Method: `POST`
- URL: `/api/verify`

Request:

```json
{
  "uid": "4A9F2C81"
}
```

If found (200):

```json
{
  "verified": true,
  "student": {
    "uid": "4A9F2C81",
    "name": "Naman Soni",
    "rollNo": "24112015",
    "department": "MCA"
  }
}
```

If not found (404):

```json
{
  "verified": false,
  "message": "Card not registered"
}
```

Validation error (400):

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "type": "field",
      "value": "",
      "msg": "UID is required",
      "path": "uid",
      "location": "body"
    }
  ]
}
```

## ESP32-CAM Integration Example

The ESP32 can call (recommended):

```text
POST http://<server-ip>:5000/api/verify
Content-Type: application/json

{
  "uid": "4A9F2C81"
}
```

Legacy read endpoint (also available):

```text
GET http://<server-ip>:5000/api/students/uid/4A9F2C81
```

Use the `verified` field to decide whether card access is valid.

## Notes

- No attendance, authentication, authorization, login, dashboard, frontend, or image upload logic is included.
- UID is normalized to uppercase by request validation and schema.
- Duplicate `uid` and `rollNo` are rejected.
