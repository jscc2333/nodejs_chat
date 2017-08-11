const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// 定义模式
const avatarModel = new Schema({
  avatar: String
});

// 导出模式
module.exports = mongoose.model('avatardbs', avatarModel);