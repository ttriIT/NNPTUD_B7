const express = require("express");
const router = express.Router();
const messageController = require("../controllers/messages");
const { CheckLogin } = require("../utils/authHandler");
const { uploadFile } = require("../utils/uploadHandler");

// GET "/userID" - Lấy toàn bộ chat giữa current_user và userID
router.get("/:userID", CheckLogin, async (req, res, next) => {
    try {
        let currentUser = req.user._id;
        let targetUserId = req.params.userID;

        let result = await messageController.GetMessagesWithUser(currentUser, targetUserId);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET "/" - Lấy message cuối cùng của mỗi user đã nhắn tin
router.get("/", CheckLogin, async (req, res, next) => {
    try {
        let currentUser = req.user._id;
        let result = await messageController.GetLastMessages(currentUser);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST "/" - Upload dòng text hoặc file
router.post("/", CheckLogin, uploadFile.single('file'), async (req, res, next) => {
    try {
        const currentUser = req.user._id;
        const targetUserId = req.body.to; // Lấy 'to' từ form data

        if (!targetUserId) {
            return res.status(400).send({ message: 'Missing target user ID ("to" field)' });
        }

        // Lấy dữ liệu tin nhắn / path file để lưu DB
        let result = await messageController.SendMessage(
            currentUser,
            targetUserId,
            req.body.text,    // Sẽ được đặt thành rỗng nếu là upload file hoàn toàn
            req.file          // req.file chứa path dẫn đến file đã lưu nếu có up
        );

        res.status(201).send(result);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

module.exports = router;
