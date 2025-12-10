// controllers/task.controller.js
const mongoose = require('mongoose');
const Task = require('../model/Task.model');
const User = require('../model/user.model');
const Comment = require('../model/Comment.model');
const TaskHistory = require('../model/TaskHistory.model');
const { recordStatusChange, recordApprovalChange } = require('../utils/taskAudit.util');

const userCanAccessTask = (task, user) => {
    if (!user || !task) return false;
    if (user.role === 'admin') return true;
    const email = (user.email || '').toLowerCase();
    const assignedTo = typeof task.assignedTo === 'string' ? task.assignedTo.toLowerCase() : '';
    const assignedBy = typeof task.assignedBy === 'string' ? task.assignedBy.toLowerCase() : '';
    return email && (assignedTo === email || assignedBy === email);
};

exports.addTask = async (req, res) => {
    try {
        console.log(" Task creation request body:", req.body);
        const {
            title,
            description,
            assignedTo, 
            dueDate,
            priority = 'medium',
            taskType = 'regular',
            companyName = 'company name',
            brand = '',
            status = 'pending'
        } = req.body;
        let assignedBy = req.body.assignedBy;
        if (!assignedBy) {
            if (req.user && req.user.email) {
                assignedBy = req.user.email;
            } else {
                assignedBy = 'admin@example.com';
            }
        }

        // Validation
        if (!title || !assignedTo || !dueDate) {
            return res.status(400).json({
                success: false,
                message: 'Title, assignee email, and due date are required'
            });
        }

        // Optional: Check if assignedTo email exists in users
        try {
            const assignedUser = await User.findOne({ email: assignedTo });
            if (!assignedUser) {
                console.log(` Warning: User with email ${assignedTo} not found in database`);
            }
        } catch (userError) {
            console.log("User check skipped or failed:", userError.message);
        }

        // Create new task object
        const newTask = new Task({
            title,
            description,
            assignedTo, // Email store ho jayegi
            assignedBy, // Email store ho jayegi
            dueDate: new Date(dueDate),
            priority,
            taskType,
            companyName,
            brand,
            status
        });

        console.log(" New task object:", newTask);

        // Save to database
        const savedTask = await newTask.save();
        console.log(" Task saved successfully:", savedTask._id);

        // Since assignedTo is now String/email, we can't use populate directly
        // Manually fetch user details if needed
        let assignedToUser = null;
        let assignedByUser = null;

        try {
            assignedToUser = await User.findOne({ email: assignedTo });
            assignedByUser = await User.findOne({ email: assignedBy });
        } catch (userError) {
            console.log("User lookup failed:", userError.message);
        }

        // Prepare response with user details
        const responseData = {
            ...savedTask.toObject(),
            assignedToUser: assignedToUser ? {
                id: assignedToUser._id,
                name: assignedToUser.name,
                email: assignedToUser.email,
            } : { email: assignedTo },
            assignedByUser: assignedByUser ? {
                id: assignedByUser._id,
                name: assignedByUser.name,
                email: assignedByUser.email,
            } : { email: assignedBy }
        };

        res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: responseData
        });

    } catch (error) {
        console.error(' Error creating task:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating task',
            error: error.message
        });
    }
};

// Update getAllTasks function bhi
exports.getAllTasks = async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const requesterEmail = req.user?.email?.toLowerCase();

        const query = isAdmin
            ? {}
            : {
                $or: [
                    { assignedTo: requesterEmail },
                    { assignedBy: requesterEmail }
                ]
            };

        const tasks = await Task.find(query).sort({ createdAt: -1 });

        // Since assignedTo is email, manually populate user details
        const tasksWithUserDetails = await Promise.all(
            tasks.map(async (task) => {
                let assignedToUser = null;
                let assignedByUser = null;

                try {
                    // Try to find user by email
                    if (typeof task.assignedTo === 'string') {
                        assignedToUser = await User.findOne({ email: task.assignedTo });
                    }

                    if (typeof task.assignedBy === 'string') {
                        assignedByUser = await User.findOne({ email: task.assignedBy });
                    }
                } catch (userError) {
                    console.log("User lookup error:", userError.message);
                }

                return {
                    ...task.toObject(),
                    assignedToUser: assignedToUser ? {
                        id: assignedToUser._id,
                        name: assignedToUser.name,
                        email: assignedToUser.email,
                        avatar: assignedToUser.avatar
                    } : {
                        email: typeof task.assignedTo === 'string' ? task.assignedTo : 'Unknown'
                    },
                    assignedByUser: assignedByUser ? {
                        id: assignedByUser._id,
                        name: assignedByUser.name,
                        email: assignedByUser.email,
                        avatar: assignedByUser.avatar
                    } : {
                        email: typeof task.assignedBy === 'string' ? task.assignedBy : 'Unknown'
                    }
                };
            })
        );

        res.json({
            success: true,
            message: 'Tasks retrieved successfully',
            count: tasks.length,
            data: tasksWithUserDetails
        });

    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching tasks',
            error: error.message
        });
    }
};

// Update other functions accordingly
exports.getSingleTask = async (req, res) => {
    try {
        const { id } = req.params;

        const task = await Task.findById(id);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        if (!userCanAccessTask(task, req.user)) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to view this task'
            });
        }

        // Manually populate user details
        let assignedToUser = null;
        let assignedByUser = null;

        if (typeof task.assignedTo === 'string') {
            assignedToUser = await User.findOne({ email: task.assignedTo });
        }

        if (typeof task.assignedBy === 'string') {
            assignedByUser = await User.findOne({ email: task.assignedBy });
        }

        const taskWithDetails = {
            ...task.toObject(),
            assignedToUser: assignedToUser ? {
                id: assignedToUser._id,
                name: assignedToUser.name,
                email: assignedToUser.email,
                avatar: assignedToUser.avatar
            } : { email: task.assignedTo },
            assignedByUser: assignedByUser ? {
                id: assignedByUser._id,
                name: assignedByUser.name,
                email: assignedByUser.email,
                avatar: assignedByUser.avatar
            } : { email: task.assignedBy }
        };

        res.json({
            success: true,
            message: 'Task retrieved successfully',
            data: taskWithDetails
        });

    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching task',
            error: error.message
        });
    }
};

// 4. UPDATE TASK
exports.updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };
        const note = updates.note || '';
        const requestRecheck = Boolean(updates.requestRecheck);

        delete updates.note;
        delete updates.requestRecheck;

        console.log(" Updating task:", id, updates);

        // Remove fields that shouldn't be updated
        delete updates._id;
        delete updates.createdAt;

        // Convert dueDate to Date if provided
        if (updates.dueDate) {
            updates.dueDate = new Date(updates.dueDate);
        }

        const previousTask = await Task.findById(id);

        if (!previousTask) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        if (!userCanAccessTask(previousTask, req.user)) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to update this task'
            });
        }

        // Update the task
        const updatedTask = await Task.findByIdAndUpdate(
            id,
            {
                ...updates,
                updatedAt: Date.now()
            },
            {
                new: true,
                runValidators: true
            }
        );

        // Get user details for response
        let assignedToUser = null;
        let assignedByUser = null;

        if (typeof updatedTask.assignedTo === 'string') {
            assignedToUser = await User.findOne({ email: updatedTask.assignedTo });
        }

        if (typeof updatedTask.assignedBy === 'string') {
            assignedByUser = await User.findOne({ email: updatedTask.assignedBy });
        }

        const responseData = {
            ...updatedTask.toObject(),
            assignedToUser: assignedToUser ? {
                id: assignedToUser._id,
                name: assignedToUser.name,
                email: assignedToUser.email,
                avatar: assignedToUser.avatar
            } : { email: updatedTask.assignedTo },
            assignedByUser: assignedByUser ? {
                id: assignedByUser._id,
                name: assignedByUser.name,
                email: assignedByUser.email,
                avatar: assignedByUser.avatar
            } : { email: updatedTask.assignedBy }
        };

        try {
            await recordStatusChange({
                req,
                previousTask,
                updatedTask,
                note,
                requestRecheck
            });

            await recordApprovalChange({
                req,
                previousTask,
                updatedTask,
                note
            });
        } catch (auditError) {
            console.error('Error recording task audit trail:', auditError);
        }

        res.json({
            success: true,
            message: 'Task updated successfully',
            data: responseData
        });

    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating task',
            error: error.message
        });
    }
};

// 5. DELETE TASK
exports.deleteTask = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedTask = await Task.findById(id);

        if (!deletedTask) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        if (!userCanAccessTask(deletedTask, req.user)) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to delete this task'
            });
        }

        await Task.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Task deleted successfully',
            data: deletedTask
        });

    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting task',
            error: error.message
        });
    }
};

exports.addTaskComment = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Comment content is required'
            });
        }

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        const user = req.user || {};

        const commentPayload = {
            taskId: task._id,
            content: content.trim(),
            userId: user.id || user._id || req.body.userId,
            userName: user.name || req.body.userName || 'Unknown User',
            userEmail: user.email || req.body.userEmail || 'unknown@example.com',
            userRole: user.role || req.body.userRole || 'user'
        };

        if (!commentPayload.userId) {
            return res.status(401).json({
                success: false,
                message: 'User context is missing'
            });
        }

        commentPayload.userId = commentPayload.userId.toString();

        const comment = await Comment.create(commentPayload);

        await Task.findByIdAndUpdate(taskId, {
            $addToSet: { comments: comment._id },
            updatedAt: Date.now()
        });

        const responseData = {
            ...comment.toObject(),
            id: comment._id
        };

        res.status(201).json({
            success: true,
            message: 'Comment added successfully',
            data: responseData
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding comment',
            error: error.message
        });
    }
};

exports.getTaskComments = async (req, res) => {
    try {
        const { taskId } = req.params;

        const taskExists = await Task.exists({ _id: taskId });
        if (!taskExists) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        const comments = await Comment.find({ taskId })
            .sort({ createdAt: -1 })
            .lean();

        const formatted = comments.map(comment => ({
            ...comment,
            id: comment._id
        }));

        res.json({
            success: true,
            data: formatted,
            message: 'Comments fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching comments',
            error: error.message
        });
    }
};

exports.getTaskHistory = async (req, res) => {
    try {
        const { taskId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid task id'
            });
        }

        const taskExists = await Task.exists({ _id: taskId });

        if (!taskExists) {
            return res.status(404).json({
                success: false,
                message: 'Task not found'
            });
        }

        const historyEntries = await TaskHistory.find({ taskId })
            .sort({ timestamp: -1 })
            .lean();

        const formatted = historyEntries.map(entry => ({
            ...entry,
            id: entry._id,
            userName: entry.user?.userName || entry.userName || 'System',
            userEmail: entry.user?.userEmail || entry.userEmail || 'system@task-app.local',
            userRole: entry.user?.userRole || entry.userRole || 'system',
            timestamp: entry.timestamp || entry.createdAt || entry.updatedAt,
        }));

        res.json({
            success: true,
            data: formatted,
            message: 'Task history fetched successfully'
        });
    } catch (error) {
        console.error('Error fetching task history:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching task history',
            error: error.message
        });
    }
};

exports.deleteTaskComment = async (req, res) => {
    try {
        const { taskId, commentId } = req.params;

        const comment = await Comment.findById(commentId);

        if (!comment || comment.taskId.toString() !== taskId) {
            return res.status(404).json({
                success: false,
                message: 'Comment not found'
            });
        }

        const user = req.user || {};
        const isOwner = user.id && comment.userId?.toString() === user.id?.toString();
        const isAdmin = user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this comment'
            });
        }

        await Comment.deleteOne({ _id: commentId });

        await Task.findByIdAndUpdate(taskId, {
            $pull: { comments: commentId },
            updatedAt: Date.now()
        });

        res.json({
            success: true,
            message: 'Comment deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting comment',
            error: error.message
        });
    }
};