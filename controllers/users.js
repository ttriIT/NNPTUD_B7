let userModel = require("../schemas/users");
let bcrypt = require('bcrypt')
let jwt = require('jsonwebtoken')
let fs = require('fs')

module.exports = {
    CreateAnUser: async function (username, password, email, role, session, fullName, avatarUrl, status, loginCount) {
        let newItem = new userModel({
            username: username,
            password: password,
            email: email,
            fullName: fullName,
            avatarUrl: avatarUrl,
            status: status,
            role: role,
            loginCount: loginCount
        });
        await newItem.save({ session });
        return newItem;
    },
    GetAllUser: async function () {
        return await userModel
            .find({ isDeleted: false })
    },
    GetUserById: async function (id) {
        try {
            return await userModel
                .findOne({
                    isDeleted: false,
                    _id: id
                }).populate('role')
        } catch (error) {
            return false;
        }
    },
    GetUserByEmail: async function (email) {
        try {
            return await userModel
                .findOne({
                    isDeleted: false,
                    email: email
                })
        } catch (error) {
            return false;
        }
    },
    GetUserByToken: async function (token) {
        try {
            let user = await userModel
                .findOne({
                    isDeleted: false,
                    forgotPasswordToken: token
                })
            if (user.forgotPasswordTokenExp > Date.now()) {
                return user;
            }
            return false;
        } catch (error) {
            return false;
        }
    },
    QueryLogin: async function (username, password) {
        if (!username || !password) {
            return false;
        }
        let user = await userModel.findOne({
            username: username,
            isDeleted: false
        })
        if (user) {
            if (user.lockTime && user.lockTime > Date.now()) {
                return false;
            } else {
                if (bcrypt.compareSync(password, user.password)) {
                    user.loginCount = 0;
                    await user.save();
                    let token = jwt.sign({
                        id: user.id
                    }, 'secret', {
                        expiresIn: '1d'
                    })
                    return token;
                } else {
                    //sai pass
                    user.loginCount++;
                    if (user.loginCount == 3) {
                        user.loginCount = 0;
                        user.lockTime = Date.now() + 3_600_000;
                    }
                    await user.save();
                    return false;
                }
            }
        } else {
            return false;
        }
    },
    ChangePassword: async function (user, oldPassword, newPassword) {
        if (bcrypt.compareSync(oldPassword, user.password)) {
            user.password = newPassword;
            await user.save();
            return true;
        } else {
            return false;
        }
    },
    ImportUsers: async function (filePath) {
        try {
            const ExcelJS = require('exceljs');
            const crypto = require('crypto');
            const mailUtils = require('../utils/sendMail');
            const roleModel = require('../schemas/roles');

            let roleUser = await roleModel.findOne({ name: { $regex: /^user$/i } });
            if (!roleUser) {
                // If the user role doesn't exist, create it or handle accordingly. Assuming it exists.
                roleUser = new roleModel({ name: 'USER', description: 'Regular User' });
                await roleUser.save();
            }

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            const worksheet = workbook.worksheets[0];

            let rowCount = 0;
            let successCount = 0;

            const rows = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) { // Assuming first row is header
                    rows.push(row.values);
                }
            });

            for (const rowValues of rows) {
                // rowValues might be [empty, 'username', 'email'] depending on how exceljs reads it (usually 1-indexed)
                let username = rowValues[1];
                let email = rowValues[2];

                // Mở rộng việc trích xuất giá trị trường hợp user dùng công thức (formula) hoặc có link
                if (username && typeof username === 'object') {
                    username = username.result || username.text || String(username);
                }
                if (email && typeof email === 'object') {
                    email = email.result || email.text || String(email);
                }

                if (!username || !email) continue;

                // check if user exists
                let existingUser = await userModel.findOne({ $or: [{ username: username }, { email: email }] });
                if (existingUser) continue; // Skip existing

                // Generate random 16 char password
                const password = crypto.randomBytes(8).toString('hex'); // 16 characters

                let newUser = new userModel({
                    username: username,
                    password: password,
                    email: email,
                    role: roleUser._id
                });
                
                await newUser.save();
                successCount++;

                // Gửi email, đồng thời try-catch để nếu có lỗi limit từ Mailtrap thì không làm crash toàn bộ tiến trình
                try {
                    await mailUtils.sendPasswordMail(email, password);
                    
                    // Delay 500ms mỗi lần gửi email để tránh lỗi "Too many emails per second" của bản free
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (emailErr) {
                    console.error("Lỗi gửi email cho " + email + ":", emailErr.message);
                }
            }

            // Remove file after processing
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }

            return { successCount: successCount, message: "Import completed successfully" };
        } catch (error) {
            console.error("Import users error:", error);
            // Remove file on error
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            throw error;
        }
    }
}