const express = require("express");
const {
    addTask,
    getAllTasks,
    getSingleTask,
    updateTask,
    deleteTask,
    addTaskComment,
    getTaskComments,
    getTaskHistory,
    deleteTaskComment,
} = require("../../Controller/task.controller");
const { approve } = require("../../Controller/user.controller");
const authMiddleware = require("../../middleware/auth.middleware");


const router = express.Router();
router.post("/addTask", authMiddleware, addTask);
router.get("/getAllTasks", authMiddleware, getAllTasks);
router.get("/singleTask/:id", authMiddleware, getSingleTask);
router.put("/updateTask/:id", authMiddleware, updateTask);
router.delete("/deleteTask/:id", authMiddleware, deleteTask);
router.put('/tasks/:id/approve', authMiddleware, approve)
 
// Task comments routes
router.post('/:taskId/comments', authMiddleware, addTaskComment);
router.get('/:taskId/comments', authMiddleware, getTaskComments);
router.get('/:taskId/history', authMiddleware, getTaskHistory);
router.delete('/:taskId/comments/:commentId', authMiddleware, deleteTaskComment);

module.exports = router;
