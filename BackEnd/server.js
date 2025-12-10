require("dotenv").config();
const express = require('express');
require("./src/config/db.confing")
const app = express();
const PORT = process.env.PORT || 9000;
const cors = require("cors");
app.use(cors());
app.use(express.json())
app.use(express.urlencoded({ extended: true }));


app.use('/api', require('./src/routes/index'))
app.listen(PORT,(error)=>{ 
    if(error){
        console.log("server not started")
        return false;
    }
        console.log("server is starting")
})