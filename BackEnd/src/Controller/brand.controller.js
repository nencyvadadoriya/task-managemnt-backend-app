const mongoose = require('mongoose');
const Brand = require('../model/Brand.model');
const Task = require('../model/Task.model');
const User = require('../model/user.model');

const normalizeEmail = (email) => (email || '').toString().trim().toLowerCase();

const userCanAccessBrand = (brand, user) => {
  if (!brand || !user) return false;
  if (user.role === 'admin') return true;
  const userEmail = normalizeEmail(user.email);
  const isOwner = brand.owner && brand.owner.toString() === (user.id || user._id || '').toString();
  const isAcceptedCollaborator = (brand.collaborators || []).some(c => normalizeEmail(c.email) === userEmail && c.status === 'accepted');
  return Boolean(isOwner || isAcceptedCollaborator);
};

const computeTaskStats = (tasks) => {
  const now = new Date();
  const isOverdue = (t) => {
    if (!t?.dueDate) return false;
    if (t.status === 'completed') return false;
    return new Date(t.dueDate) < now;
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const pendingTasks = tasks.filter(t => t.status === 'pending').length;
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress').length;
  const overdueTasks = tasks.filter(isOverdue).length;

  return {
    totalTasks,
    completedTasks,
    pendingTasks,
    inProgressTasks,
    overdueTasks
  };
};

const normalizeString = (v) => (v || '').toString().trim();

const buildBrandPayload = (body) => {
  const name = normalizeString(body?.name);
  const company = normalizeString(body?.company);
  const description = normalizeString(body?.description);
  const category = normalizeString(body?.category) || 'Other';
  const website = normalizeString(body?.website);
  const logo = body?.logo ? body.logo.toString() : '';
  const status = normalizeString(body?.status) || 'active';

  return {
    name,
    company,
    description,
    category,
    website,
    logo,
    status
  };
};

const formatBrand = (b) => ({
  ...b,
  id: b._id
});

exports.createBrand = async (req, res) => {
  try {
    const ownerId = (req.user?.id || req.user?._id || '').toString();
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = buildBrandPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ success: false, message: 'Brand name is required' });
    }

    const existing = await Brand.findOne({
      owner: ownerId,
      name: payload.name,
      company: payload.company
    });

    if (existing) {
      existing.description = payload.description;
      existing.status = payload.status;

      existing.history.push({
        action: 'brand_updated',
        description: `Brand updated: ${payload.name}`,
        userId: ownerId,
        userName: req.user?.name || 'Unknown',
        userEmail: normalizeEmail(req.user?.email),
        userRole: req.user?.role || 'user',
        timestamp: new Date(),
        metadata: { name: payload.name, company: payload.company }
      });

      await existing.save();
      return res.status(200).json({ success: true, data: formatBrand(existing.toObject()) });
    }

    const created = await Brand.create({
      ...payload,
      owner: ownerId,
      collaborators: [],
      history: [
        {
          action: 'brand_created',
          description: `Brand created: ${payload.name}`,
          userId: ownerId,
          userName: req.user?.name || 'Unknown',
          userEmail: normalizeEmail(req.user?.email),
          userRole: req.user?.role || 'user',
          timestamp: new Date(),
          metadata: { name: payload.name, company: payload.company }
        }
      ]
    });

    res.status(201).json({ success: true, data: formatBrand(created.toObject()) });
  } catch (error) {
    console.error('Error creating brand:', error);
    res.status(500).json({ success: false, message: 'Failed to create brand' });
  }
};

exports.bulkUpsertBrands = async (req, res) => {
  try {
    const ownerId = (req.user?.id || req.user?._id || '').toString();
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const inputBrands = Array.isArray(req.body?.brands) ? req.body.brands : [];
    if (!inputBrands.length) {
      return res.status(400).json({ success: false, message: 'brands array is required' });
    }

    const results = [];

    for (const raw of inputBrands) {
      const payload = buildBrandPayload(raw);
      if (!payload.name) continue;

      const doc = await Brand.findOneAndUpdate(
        { owner: ownerId, name: payload.name, company: payload.company },
        {
          $set: {
            ...payload,
            owner: ownerId
          },
          $push: {
            history: {
              action: 'brand_updated',
              description: `Brand upserted: ${payload.name}`,
              userId: ownerId,
              userName: req.user?.name || 'Unknown',
              userEmail: normalizeEmail(req.user?.email),
              userRole: req.user?.role || 'user',
              timestamp: new Date(),
              metadata: { name: payload.name, company: payload.company, clientId: raw?.id || raw?.clientId || '' }
            }
          }
        },
        { new: true, upsert: true }
      );

      results.push({
        clientId: raw?.id || raw?.clientId || '',
        ...formatBrand(doc.toObject())
      });
    }

    res.status(200).json({ success: true, data: results });
  } catch (error) {
    console.error('Error bulk upserting brands:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk upsert brands' });
  }
};

exports.getUserBrands = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid userId' });
    }

    const user = req.user;
    const requesterEmail = normalizeEmail(user?.email);

    const brands = await Brand.find({
      $or: [
        { owner: userId },
        { 'collaborators.email': requesterEmail, 'collaborators.status': 'accepted' }
      ]
    })
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = brands.map(b => ({
      ...b,
      id: b._id
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch brands' });
  }
};

exports.getBrandDetails = async (req, res) => {
  try {
    const { brandId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(brandId)) {
      return res.status(400).json({ success: false, message: 'Invalid brandId' });
    }

    const brand = await Brand.findById(brandId).populate('owner', 'name email').lean();

    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    if (!userCanAccessBrand(brand, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this brand' });
    }

    const tasks = await Task.find({
      $or: [
        { brandId: brand._id },
        { brand: brand.name },
        { companyName: brand.company },
        { company: brand.company }
      ]
    }).sort({ createdAt: -1 }).lean();

    const collaborators = brand.collaborators || [];
    const activeCollaborators = collaborators.filter(c => c.status === 'accepted').length;
    const pendingInvites = collaborators.filter(c => c.status === 'pending').length;

    res.json({
      success: true,
      data: {
        brand: { ...brand, id: brand._id },
        tasks: tasks.map(t => ({ ...t, id: t._id })),
        stats: {
          ...computeTaskStats(tasks),
          collaboratorsCount: collaborators.length,
          activeCollaborators,
          pendingInvites
        }
      }
    });
  } catch (error) {
    console.error('Error fetching brand details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch brand details' });
  }
};

exports.inviteCollaborator = async (req, res) => {
  try {
    const { brandId } = req.params;
    const { email, role, message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(brandId)) {
      return res.status(400).json({ success: false, message: 'Invalid brandId' });
    }

    const inviteEmail = normalizeEmail(email);

    if (!inviteEmail) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const brand = await Brand.findById(brandId);

    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    const requesterId = (req.user?.id || req.user?._id || '').toString();
    const isOwner = brand.owner.toString() === requesterId;
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Only owner/admin can invite collaborators' });
    }

    const already = (brand.collaborators || []).some(c => normalizeEmail(c.email) === inviteEmail);
    if (already) {
      return res.status(400).json({ success: false, message: 'User already invited/exists in collaborators' });
    }

    const userDoc = await User.findOne({ email: inviteEmail }).lean();

    brand.collaborators.push({
      userId: userDoc?._id || null,
      email: inviteEmail,
      name: userDoc?.name || inviteEmail.split('@')[0] || '',
      role: role || 'member',
      status: 'pending',
      invitedAt: new Date(),
      invitedBy: normalizeEmail(req.user?.email)
    });

    brand.history.push({
      action: 'collaborator_invited',
      description: `Invitation sent to ${inviteEmail} for ${(role || 'member')} role`,
      userId: requesterId,
      userName: req.user?.name || 'Unknown',
      userEmail: normalizeEmail(req.user?.email),
      userRole: req.user?.role || 'user',
      timestamp: new Date(),
      metadata: {
        email: inviteEmail,
        role: role || 'member',
        message: message || ''
      }
    });

    await brand.save();

    res.json({
      success: true,
      message: 'Invitation created successfully',
      data: { ...brand.toObject(), id: brand._id }
    });
  } catch (error) {
    console.error('Error inviting collaborator:', error);
    res.status(500).json({ success: false, message: 'Failed to invite collaborator', error: error.message });
  }
};

exports.respondToInvite = async (req, res) => {
  try {
    const { brandId } = req.params;
    const { action } = req.body;

    if (!mongoose.Types.ObjectId.isValid(brandId)) {
      return res.status(400).json({ success: false, message: 'Invalid brandId' });
    }

    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be accept or decline' });
    }

    const brand = await Brand.findById(brandId);
    if (!brand) {
      return res.status(404).json({ success: false, message: 'Brand not found' });
    }

    const userEmail = normalizeEmail(req.user?.email);
    const collab = (brand.collaborators || []).find(c => normalizeEmail(c.email) === userEmail);

    if (!collab) {
      return res.status(404).json({ success: false, message: 'Invite not found for this user' });
    }

    if (collab.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Invite already ${collab.status}` });
    }

    if (action === 'accept') {
      collab.status = 'accepted';
      collab.joinedAt = new Date();
      collab.userId = req.user?.id || req.user?._id || collab.userId;
    } else {
      collab.status = 'declined';
    }

    brand.history.push({
      action: action === 'accept' ? 'collaborator_accepted' : 'collaborator_declined',
      description: action === 'accept' ? `${userEmail} accepted the invite` : `${userEmail} declined the invite`,
      userId: (req.user?.id || req.user?._id || '').toString(),
      userName: req.user?.name || 'Unknown',
      userEmail,
      userRole: req.user?.role || 'user',
      timestamp: new Date(),
      metadata: { email: userEmail }
    });

    await brand.save();

    res.json({
      success: true,
      message: action === 'accept' ? 'Invite accepted' : 'Invite declined',
      data: { ...brand.toObject(), id: brand._id }
    });
  } catch (error) {
    console.error('Error responding to invite:', error);
    res.status(500).json({ success: false, message: 'Failed to respond to invite', error: error.message });
  }
};

// ✅ getBrands function add करें
exports.getBrands = async (req, res) => {
  try {
    const user = req.user;
    const requesterEmail = normalizeEmail(user?.email);

    // Build query based on user role
    let query = {};

    if (user?.role === 'admin') {
      // Admin can see all brands
      query = {};
    } else {
      // Regular users can see brands they own or are collaborators on
      query = {
        $or: [
          { owner: user?.id || user?._id },
          {
            'collaborators.email': requesterEmail,
            'collaborators.status': 'accepted'
          }
        ]
      };
    }

    // Apply filters from query params
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { name: searchRegex },
        { company: searchRegex },
        { description: searchRegex }
      ];
    }

    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    if (req.query.company && req.query.company !== 'all') {
      query.company = req.query.company;
    }

    // Execute query
    const brands = await Brand.find(query)
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    // Format response
    const formattedBrands = brands.map(brand => ({
      ...brand,
      id: brand._id
    }));

    res.status(200).json({
      success: true,
      data: formattedBrands,
      total: formattedBrands.length
    });

  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brands',
      error: error.message
    });
  }
};

// ✅ getBrandById function add करें
exports.getBrandById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid brand ID'
      });
    }

    const brand = await Brand.findById(id)
      .populate('owner', 'name email')
      .populate('collaborators.userId', 'name email role')
      .lean();

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Check if user has access
    if (!userCanAccessBrand(brand, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this brand'
      });
    }

    // Get tasks for this brand
    const tasks = await Task.find({
      $or: [
        { brandId: brand._id },
        { brand: brand.name },
        { companyName: brand.company }
      ]
    }).lean();

    // Calculate stats
    const stats = computeTaskStats(tasks);

    res.status(200).json({
      success: true,
      data: {
        ...brand,
        id: brand._id,
        tasks: tasks.map(task => ({
          ...task,
          id: task._id
        })),
        stats
      }
    });

  } catch (error) {
    console.error('Error fetching brand by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch brand',
      error: error.message
    });
  }
};

// ✅ updateBrand function add करें
exports.updateBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user?.id || req.user?._id || '').toString();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid brand ID'
      });
    }

    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Check authorization
    const isOwner = brand.owner.toString() === userId;
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Only owner or admin can update brand'
      });
    }

    // Build update payload
    const payload = buildBrandPayload(req.body);

    // Update brand fields
    if (payload.name) brand.name = payload.name;
    if (payload.company) brand.company = payload.company;
    if (payload.description !== undefined) brand.description = payload.description;
    if (payload.category) brand.category = payload.category;
    if (payload.website !== undefined) brand.website = payload.website;
    if (payload.logo !== undefined) brand.logo = payload.logo;
    if (payload.status) brand.status = payload.status;

    // Add to history
    brand.history.push({
      action: 'brand_updated',
      description: `Brand details updated`,
      userId: userId,
      userName: req.user?.name || 'Unknown',
      userEmail: normalizeEmail(req.user?.email),
      userRole: req.user?.role || 'user',
      timestamp: new Date(),
      metadata: {
        name: payload.name,
        company: payload.company,
        status: payload.status
      }
    });

    await brand.save();

    res.status(200).json({
      success: true,
      message: 'Brand updated successfully',
      data: formatBrand(brand.toObject())
    });

  } catch (error) {
    console.error('Error updating brand:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update brand',
      error: error.message
    });
  }
};

// ✅ deleteBrand function add करें
exports.deleteBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user?.id || req.user?._id || '').toString();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid brand ID'
      });
    }

    const brand = await Brand.findById(id);

    if (!brand) {
      return res.status(404).json({
        success: false,
        message: 'Brand not found'
      });
    }

    // Check authorization
    const isOwner = brand.owner.toString() === userId;
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Only owner or admin can delete brand'
      });
    }

    // Check if brand has associated tasks
    const taskCount = await Task.countDocuments({
      $or: [
        { brandId: brand._id },
        { brand: brand.name }
      ]
    });

    if (taskCount > 0 && req.query.force !== 'true') {
      return res.status(400).json({
        success: false,
        message: `Cannot delete brand with ${taskCount} associated tasks. Use force=true to delete anyway.`
      });
    }

    // Delete associated tasks if forced
    if (req.query.force === 'true' && taskCount > 0) {
      await Task.deleteMany({
        $or: [
          { brandId: brand._id },
          { brand: brand.name }
        ]
      });
    }

    // Add to history before deletion
    brand.history.push({
      action: 'brand_deleted',
      description: `Brand deleted: ${brand.name}`,
      userId: userId,
      userName: req.user?.name || 'Unknown',
      userEmail: normalizeEmail(req.user?.email),
      userRole: req.user?.role || 'user',
      timestamp: new Date(),
      metadata: {
        name: brand.name,
        company: brand.company
      }
    });

    // Save history log before deletion
    await brand.save();

    // Delete the brand
    await Brand.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Brand deleted successfully',
      data: {
        id: brand._id,
        name: brand.name,
        company: brand.company
      }
    });

  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete brand',
      error: error.message
    });
  }
};

// ✅ Helper function for brand list (already present के साथ merge करें)
exports.getAllBrands = exports.getBrands; // Alias if needed