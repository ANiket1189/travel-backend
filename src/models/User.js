const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    firstName: {
        type: String,
        default: ''
    },
    lastName: {
        type: String,
        default: ''
    },
    phoneNumber: {
        type: String,
        default: ''
    },
    createdAt: {
        type: String,
        default: new Date().toISOString()
    },
    lastLogin: {
        type: String,
        default: null
    },
    isLoggedIn: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    }
});

module.exports = mongoose.model('User', userSchema);