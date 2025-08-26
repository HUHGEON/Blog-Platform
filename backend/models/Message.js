import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  sender: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: { 
    type: String,
    required: [true, '쪽지 제목을 입력해 주세요'],
    trim: true,
    maxlength: [20, '제목은 20글자 이하로 입력해 주세요']
  },
  content: {
    type: String,
    required: [true, '쪽지 내용을 입력해 주세요'],
    trim: true,
    maxlength: [200, '쪽지 내용은 200글자 이하로 입력해 주세요']
  },
  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  isRead: { // 읽음 여부 (true: 읽음, false: 안 읽음)
    type: Boolean,
    default: false
  }
}, {
  collection: 'messages'
});

messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, sender: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);