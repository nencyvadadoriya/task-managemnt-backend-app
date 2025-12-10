const mongoose = require('mongoose');

const mongoUrl = process.env.MONGODB_URI;

const db = mongoose.connection;
mongoose.connect(mongoUrl);
db.on('connected', () => console.log('DB is Connected..'));
db.on('error', (err) => console.log('DB is not Connected..', err));
db.on('disconnected', () => console.log('DB is Disconnected..'));

module.exports = db;       

// mongodb+srv://vadadoriyanency8_db_user:<db_password>@cluster0.cf6ruhc.mongodb.net/?appName=Cluster0const mongoose = require('mongoose');
// const mongoUrl = ('mongodb+srv://vadadoriyanency8_db_user:nency07@cluster0.cf6ruhc.mongodb.net/task-manegement-app');

// const db = mongoose.connection;
// mongoose.connect(mongoUrl);