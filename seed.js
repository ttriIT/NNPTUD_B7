const mongoose = require('mongoose');
const Role = require('./schemas/roles');
const User = require('./schemas/users');
const bcrypt = require('bcrypt');

async function seed() {
    try {
        await mongoose.connect('mongodb://localhost:27017/NNPTUD-C3');
        console.log("Connected to MongoDB");

        // Create Roles
        const rolesToCreate = ['ADMIN', 'MODERATOR', 'USER'];
        const roleIds = {};

        for (const roleName of rolesToCreate) {
            let role = await Role.findOne({ name: roleName });
            if (!role) {
                role = new Role({ name: roleName, description: `Role for ${roleName}` });
                await role.save();
                console.log(`Created role: ${roleName}`);
            } else {
                console.log(`Role ${roleName} already exists`);
            }
            roleIds[roleName] = role._id;
        }

        // Create Admin User
        const adminUsername = 'admin';
        const adminEmail = 'admin@example.com';
        const adminPassword = 'admin'; // Cố định pass là admin cho mục đích test

        let adminUser = await User.findOne({ username: adminUsername });
        if (!adminUser) {
            adminUser = new User({
                username: adminUsername,
                password: adminPassword,
                email: adminEmail,
                fullName: 'Super Admin',
                role: roleIds['ADMIN'],
                status: true
            });
            await adminUser.save();
            console.log(`Created admin user. Username: ${adminUsername}, Password: ${adminPassword}`);
        } else {
            console.log("Admin user already exists");
        }

        console.log("Seeding completed!");
    } catch (error) {
        console.error("Error during seeding:", error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

seed();
