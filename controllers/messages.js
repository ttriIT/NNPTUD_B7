const messageModel = require('../schemas/messages');
const mongoose = require('mongoose');

module.exports = {
    // Tự động phân loại tin nhắn để lưu trữ
    SendMessage: async function (fromUserId, toUserId, text, file) {
        let type = 'text';
        let content = text;

        if (file) {
            type = 'file';
            // Lưu đường dẫn file để client có thể truy cập (VD: uploads/tên_file)
            content = file.path.replace(/\\/g, '/');
        }

        if (!content) {
            throw new Error("Tin nhắn không được bỏ trống nội dung hoặc file");
        }

        let newMsg = new messageModel({
            from: fromUserId,
            to: toUserId,
            type: type,
            text: content
        });

        await newMsg.save();
        return newMsg;
    },

    GetMessagesWithUser: async function (currentUser, targetUserId) {
        return await messageModel.find({
            $or: [
                { from: currentUser, to: targetUserId },
                { from: targetUserId, to: currentUser }
            ]
        }).sort({ createdAt: 1 }) // Cũ nhất đến mới nhất
        .populate("from", "username fullName avatarUrl")
        .populate("to", "username fullName avatarUrl");
    },

    GetLastMessages: async function (currentUserId) {
        let userId = new mongoose.Types.ObjectId(currentUserId);

        // Sử dụng Aggregate để lấy tin nhắn cuối cùng với từng người mà current user đã trò chuyện
        let conversations = await messageModel.aggregate([
            {
                // Lấy tất cả tin nhắn liên quan đến current user
                $match: {
                    $or: [{ from: userId }, { to: userId }]
                }
            },
            {
                // Sort giảm dần ngày tạo để tin nhắn mới nhất nằm đầu nhóm
                $sort: { createdAt: -1 }
            },
            {
                // Nhóm theo đối tác trò chuyện (người kia)
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ["$from", userId] },
                            "$to",    // Nếu from là mình, group theo to
                            "$from"   // Ngược lại group theo from
                        ]
                    },
                    lastMessage: { $first: "$$ROOT" }
                }
            },
            {
                // Populate lấy thông tin của người trò chuyện cùng
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "partner"
                }
            },
            {
                $unwind: "$partner"
            },
            {
                // Bỏ bớt thông tin nhạy cảm của partner
                $project: {
                    "partner.password": 0,
                    "partner.role": 0,
                    "partner.loginCount": 0,
                    "partner.isDeleted": 0,
                    "partner.status": 0,
                    "partner.forgotPasswordToken": 0,
                    "partner.forgotPasswordTokenExp": 0,
                    "partner.lockTime": 0
                }
            },
            {
                // Sắp xếp lại danh sách các cuộc trò chuyện theo thời gian mới nhất
                $sort: { "lastMessage.createdAt": -1 }
            }
        ]);

        return conversations;
    }
};
