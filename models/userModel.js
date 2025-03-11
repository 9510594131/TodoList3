const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    min: 1,
    max: 99
  },
  password: {
    type: String,
    required: true,
    min: 1,
    max: 99
  }
});

const User = mongoose.model('User', userSchema);

module.exports = User;