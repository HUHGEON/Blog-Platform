import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  id: {
    type: String,
    required: [true, '아이디를 입력해 주세요'],
    unique: true,
    trim: true,
    minlength: [3, '아이디는 3글자 이상으로 생성해 주세요'],
    maxlength: [10, '아이디는 10글자 이하로 생성해 주세요']
  },
  pw: {
    type: String,
    required: [true, '비밀번호는 필수입니다'],
    minlength: [8, '비밀번호는 8글자 이상으로 생성해 주세요'],
    maxlength: [15, '비밀번호는 15글자 이하로 생성해 주세요'],
    validate: {
      validator: function(password) {
        // 문자와 숫자만 허용, 공백 없음
        const passwordRegex = /^[a-zA-Z0-9]{8,15}$/;
        return passwordRegex.test(password);
      },
      message: '비밀번호는 8-15자리이며, 영문자와 숫자만 사용 가능합니다'
    }
  },
  name: {
    type: String,
    required: [true, '이름은 입력해 주세요'],
    trim: true,
  },
  nickname: {
    type: String,
    required: [true, '닉네임은 필수입니다'],
    unique: true,
    trim: true,
    minlength: [2, '닉네임은 2글자 이상으로 생성해 주세요'],
    maxlength: [10, '닉네임은 10글자 이하로 생성해 주세요']
  },
  birth_date: {
  type: Date,
  required: [true, '생년월일을 입력해 주세요'],
  validate: {
    validator: function(date) {
      return date <= new Date();
    },
    message: function() {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD 형식
      return `생년월일은 ${today} 이전이여야 합니다`;
    }
  }
},
  followers: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: []
  },
  followers_count: {
    type: Number,
    default: 0,
    min: 0
  },
  following: {
    type: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    default: []
  },
  following_count: {
    type: Number,
    default: 0,
    min: 0
  },

  user_post_count: {
    type: Number,
    default: 0,
    min: 0
  },
  user_like_count: {
    type: Number,
    default: 0,
    min: 0
  },
  user_comment_count: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  collection: 'users'
});

// 비밀번호 암호화 미들웨어
userSchema.pre('save', async function(next) {
  if (!this.isModified('pw')) return next();
  this.pw = await bcrypt.hash(this.pw, 12);
  next();
});

// 비밀번호 확인 메서드
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.pw);
};

// JSON 변환 시 비밀번호 제외
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.pw;
  return user;
};

export default mongoose.model('User', userSchema);