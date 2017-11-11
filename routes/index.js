var express = require('express');
var mysql = require("mysql");
var jwt = require("jsonwebtoken");
var bcrypt = require("bcrypt");
var router = express.Router();

var connection = mysql.createConnection({
  host      : 'localhost',
  user      : 'root',
  password  : 'mysql',
  database  : 'ftc'
});
connection.connect();

const saltRounds = 10;
const key = "YourMom";

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

router.post('/login', function(req, response) {
    connection.query("SELECT * FROM teams WHERE teamName = ?;", [req.body.username], function(err, rows, fields) {
        if(err) {
            console.log("SQLError: " + err);
            return;
        }
        if(rows.length > 0) {
            bcrypt.compare(req.body.password, rows[0].password, function(err, res) { 
                if(err) {
                    console.log("BCRYPTError: " + err);
                    return;
                }
                if(res) {
                    var token = jwt.sign({team: req.body.username}, key, {
                        expiresIn: 1440 // expires in 24 hours...they won't use it for so long lol
                    });
                    connection.query("SELECT * FROM questions WHERE questionid NOT IN (SELECT questionid FROM answered_questions WHERE teamName = ?);", [req.body.username], function(err, rows, fields) {
                        if(err) {
                            console.log("SQLError: " + err);
                            return;
                        }
                        if(rows.length == 0) {
                            response.json({
                                success: false,
                                message: "End of level"
                            });
                        } else {
                            var questionNum = getRandomInt(0, rows.length);
                            response.json({
                                success: true,
                                authtoken: token,
                                questionid: rows[questionNum].questionid,
                                question: rows[questionNum].question,
                                lat: rows[questionNum].latitude,
                                long: rows[questionNum].longitude
                            });
                        }
                    });
                    connection.query("UPDATE teams SET token = ? WHERE teamName = ?;", [token, req.body.username]);
                } else {
                    response.json({
                        success: false,
                        message: "Invalid password"
                    });
                }
            });
        } else {
            response.json({
                success: false,
                message: "Sorry user not found. Please check your Team Name"
            });
        }
    });
});

router.post('/answer', function(req, response) {
    var token = req.headers['authtoken'];
    if(token) {
        jwt.verify(token, key, function(err, decoded) {
            if(err) {
                console.log("JWTError: " + err);
                response.status(403).json({
                    success: false,
                    message: "Failed to authenticate Token. Try logging out and logging in again"
                });
            } else {
                connection.query("SELECT * FROM questions WHERE questionid = ? AND answer = ?;", [req.body.questionid, req.body.answer], function(err, rows, fields) {
                    if(err) {
                        console.log("SQLError: " + err);
                        return;
                    }
                    if(rows.length > 0) {
                        connection.query("SELECT * FROM teams WHERE token = ?;", [token], function(err, rows, fields) {
                            if(err) {
                                console.log("SQLError: " + err);
                                return;
                            }
                            if(rows.length > 0) {
                                var teamName = rows[0].teamName;
                                connection.query("INSERT INTO answered_questions VALUES(?, ?);", [teamName, req.body.questionid], function(err, rows, fields) {
                                    if(err) {
                                        console.log("SQLError: " + err);
                                        return;
                                    }
                                    connection.query("SELECT * FROM questions WHERE questionid NOT IN (SELECT questionid FROM answered_questions WHERE teamName = ?);", [teamName], function(err, rows, fields) {
                                        if(err) {
                                            console.log("SQLError: " + err);
                                            return;
                                        }
                                        if(rows.length == 0) {
                                            response.json({
                                                success: false,
                                                message: "End of level"
                                            });
                                        } else {
                                            var questionNum = getRandomInt(0, rows.length);
                                            response.json({
                                                success: true,
                                                questionid: rows[questionNum].questionid,
                                                question: rows[questionNum].question,
                                                lat: rows[questionNum].latitude,
                                                long: rows[questionNum].longitude
                                            });
                                        }
                                    });
                                });
                            } else {
                                response.status(403).send();
                            }
                        });
                    } else {
                        response.json({
                            success: false,
                            message: "Incorrect answer"
                        });
                    }
                });
            }
        });
    } else {
        response.status(403).send();
    }
});

module.exports = router;
