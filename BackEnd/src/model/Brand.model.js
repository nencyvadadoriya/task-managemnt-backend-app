const mongoose = require('mongoose');

const collaboratorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    default: ''
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'member'
  },
  status: {
    type: String,
    enum: ['pending', 'accepted'],
    default: 'pending'
  },
  invitedAt: {
    type: Date,
    default: Date.now
  },
  joinedAt: {
    type: Date,
    default: null
  },
  invitedBy: {
    type: String,
    default: ''
  }
}, {
  _id: true,
  versionKey: false
});

const historySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: [
      'brand_created',
      'brand_updated',
      'collaborator_invited',
      'collaborator_accepted',
      'collaborator_declined',
      'collaborator_removed',
      'collaborator_role_changed'
    ],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    default: 'user'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  _id: true,
  versionKey: false
});

const brandSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    default: '',
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  logo: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: 'Other',
    trim: true
  },
  website: {
    type: String,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collaborators: {
    type: [collaboratorSchema],
    default: []
  },
  history: {
    type: [historySchema],
    default: []
  }
}, {
  timestamps: true,
  versionKey: false
});

brandSchema.index({ owner: 1, createdAt: -1 });
brandSchema.index({ 'collaborators.email': 1 });
brandSchema.index({ status: 1 });

const Brand = mongoose.model('Brand', brandSchema);

module.exports = Brand;
