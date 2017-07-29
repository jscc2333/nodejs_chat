const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// 定义模式
const userModel = new Schema({
  username: String,
  password: String,
  is_online: Boolean,
  information: {
    'Autograph': {
      type: String,
      default: 'JavaScript是最好的语言'
    },
    'Sex': {
      type: String,
      default: ''
    },
    'Age': {
      type: String,
      default: ''
    },
    'Area': {
      type: String,
      default: 'china'
    },
    'Career': {
      type: String,
      default: ''
    },
    'Like': {
      type: String,
      default: 'JavaScript'
    }
  }
});

// 导出模式
module.exports = mongoose.model('userdbs', userModel);
