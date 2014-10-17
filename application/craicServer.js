// Server-side setup 

// Global variables
var connectStr = 'mongodb://localhost:27017/test';
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');

// Set up express
var configureApp = function(){
	var express = require('express');
	var app = express();
	app.use(express.bodyParser());
	app.use(express.cookieParser('craicSecret'));
	app.use(express.cookieSession());
	app.use(app.router);
	app.use(express.static('content'));
	return app;
};

// Set up the server
var craicServer = (function() {
	var db;
	function startUp() {
		MongoClient.connect(connectStr, {server:{poolSize:1}}, function(error, dbhandle) {
			db = dbhandle;
			var app = configureApp();
			app.listen(8080);  
			setRESTAPI(app);
			app.close = function() {
				console.log("Shutting down...");
				db.close();
			};			
			console.log('server running at http://127.0.0.1:8080)');			
		});
	}
	
	return{startUp: startUp };
})();

// Configuring the RESTful APIs (request handlers)
var setRESTAPI = function(app){
	app.post('/register', checkUsername, userRegister);
	app.post('/login', userLogin);
	app.get('/sessionCheck', checkSession);
	app.get('/messages', retrieveData);
	app.post('/postCraic', postMessage);
	app.post('/addReply/:messageID', addReply);
	app.post('/favouriteMessage/:messageID', favouriteMessage);
	app.get('/userProfile/:id', getUserProfile);
	app.post('/followUser/:username', addFriendship);
	app.post('/unfollowUser/:username', deleteFriendship);
	app.get('/logout', userLogout);
	app.post('/uploadFile', saveFile);
};

// Request handler functions

// Check if a username is already in use
var checkUsername = function(request, response, next){
	var uname = request.body.username;
	
	MongoClient.connect(connectStr, {server:{poolSize:1}}, function(error, dbhandle) {
		dbhandle.collection("users").find({"username":uname}).toArray(function(error,userEntry){
			if (userEntry.length === 0){
				dbhandle.close();
				next();
			} else {
				if ('jsonp' in request.query){
					response.jsonp("This username is taken, please try again with an alternate username");
					dbhandle.close();
				} else {
					response.json("This username is taken, please try again with an alternate username");
					dbhandle.close();
				}
			}
		});
	});
};

// Insert a new user to db.users when they register
var userRegister = function(request, response){
	var	uname = request.body.username,
		pass = request.body.pass,
		fname = request.body.firstname,
		lname = request.body.lastname,
		descr = request.body.description,
		passwordHash = require('password-hash'),
		hashedPass = passwordHash.generate(pass);
	
	MongoClient.connect(connectStr, {server:{poolSize:1}}, function(error, dbhandle) {
		dbhandle.collection("users").count(function(error, count){
			var userCount = count;
			dbhandle.collection("users").insert(
				{	_id: userCount + 1,
					username: uname,
					password: hashedPass,
					firstname: fname,
					lastname: lname,
					description: descr,
					picUploaded: false
				},
				function (error, result){
					assert.equal(null, error);
					dbhandle.close();
				}
			);
		});
	});
	if('jsonp' in request.query){
		response.jsonp("Registration successful. You can now log in using your username and password");
	} else {
		response.json("Registration successful. You can now log in using your username and password");
	}
};

// Check username and pass against database, login if correct and return an error if not
var userLogin = function(request, response) {
	var username = request.body.username,
		pass = request.body.pass;
			
	MongoClient.connect(connectStr, {server:{poolSize:1}}, function(error, dbhandle) {
		var db = dbhandle;
		checkCredentials(username,pass,db,function(err, valid, userID){
			if(valid){
				request.session.userID = userID;
				retrieveData(request, response);
			}else{
				response.send(false);
				db.close();
			}
		});		
	});
};

// Basic Auth function taken from studres
function checkCredentials(user, pass, db, callback) {
	var	passwordHash = require('password-hash');
	db.collection("users").findOne({username: user}, (function(err, userRecord) {
		assert.equal(null, err);
		if(userRecord) {
			callback(null, (passwordHash.verify(pass,userRecord.password)), userRecord._id);
			db.close();
		} else {            
			callback(null, false);
			db.close();
		}
  }));
}

// Check if there is a user logged in when the page is refreshed
var checkSession = function(request, response){
	if(request.session.userID){
		retrieveData(request, response);
	}
};

// Callback function for /messages GET request
var retrieveData = function(request, response){
	queryDBForUserInfo(request, response, request.session.userID); //start process to get user information, messages, who they are following from the server
};

// Search MongoDB for current users account information
var queryDBForUserInfo = function(request, response, userID){
	MongoClient.connect(connectStr, {server:{poolSize:1}}, function(error, dbhandle) {
		dbhandle.collection("users").find({'_id':userID}).toArray(function(error,docs){
			if(docs.length>0){
				assert.equal(null, error);
				addUserDetails(docs, dbhandle, userID, request, response, addMessageCount);
			}
		});
	});
};

// Add user account details to craicArray
var addUserDetails = function(docs, dbhandle, userID, request, response,callback){
	
	var craicArray = [];
	var userInfo = {
		username : docs[0].username,
		firstname : docs[0].firstname,
		lastname : docs[0].lastname,
		description: docs[0].description,
		userID: userID,
		loggedInUserID: request.session.userID,
		picUploaded: docs[0].picUploaded
	};
	
	craicArray.push(userInfo);
	callback(craicArray, dbhandle, userID, request, response,addFollowersCount);
};

// Add total number of messages (craics) posted by logged in user to JSON object
var addMessageCount = function(craicArray, dbhandle, userID , request, response,callback){
	dbhandle.collection("messages").find({'userID': userID }).toArray(function(error, userMessages){
		assert.equal(null, error);
		craicArray.push(userMessages.length);
		callback(craicArray,dbhandle, userID , request, response,addFollowingCount);
	});
};

// Add total number of followers for logged-in user to JSON object
var addFollowersCount = function(craicArray, dbhandle, userID, request, response,callback){
	dbhandle.collection("friendships").find({'friendID' : userID}).toArray(function(error, followers){
		assert.equal(null, error);
		craicArray.push(followers.length);
		callback(craicArray, dbhandle, userID, request, response, addTotalUsers);
	});
};

// Add total friends (people following) to JSON
var addFollowingCount = function(craicArray, dbhandle, userID, request, response,callback){
	dbhandle.collection("friendships").find({'userID' : userID}).toArray(function(error, friends){
		var followingIDs = [];
		assert.equal(null, error);
		followingIDs.push(userID);
		
		for(var i=0; i<friends.length; i++){
            followingIDs.push(friends[i].friendID);
		}	
		
		craicArray.push(friends.length);
		callback(craicArray, dbhandle, userID, request, response, followingIDs, addUserMessages);
	});
};

// Find total users registered with Craic, and add details to JSON object - password details are stripped out for security reasons
var addTotalUsers = function(craicArray, dbhandle, userID, request, response,followingIDs, callback){
	dbhandle.collection("users").find().toArray(function(error, allUsers){
		assert.equal(null, error);
		for(var i =0; i<allUsers.length; i++){
			delete allUsers[i].password;
			delete allUsers[i].description;
		}
		craicArray.push(allUsers);
		callback(craicArray, dbhandle, request, response,followingIDs, checkFriendship);
	});
};

// Find all messages by user and friends, add to array then add to JSON object
var addUserMessages = function(craicArray, dbhandle, request, response, followingIDs,callback){
	dbhandle.collection("messages").find({'userID': {$in :followingIDs} }).sort({'_id': -1}).toArray(function(error, userMessages){
		assert.equal(null, error);
		craicArray.push(userMessages);
		callback(craicArray, dbhandle, request, response, followingIDs);
		
	});
};

// Check if the logged in user follows the viewed user, and send craicArray as response
var checkFriendship = function(craicArray, dbhandle, request, response, followingIDs){
	dbhandle.collection("friendships").find({"userID":request.session.userID, "friendID":craicArray[0].userID}).toArray(function(error,friendship){
        if (friendship.length===0){
			craicArray.push(false);
			if('jsonp' in request.query){
				response.jsonp(craicArray);
				dbhandle.close();
			} else {
				response.json(craicArray);
				dbhandle.close();
			}
        } else {
			craicArray.push(true); 
			if('jsonp' in request.query){
				response.jsonp(craicArray);
				dbhandle.close();
			} else {
				response.json(craicArray);
				dbhandle.close();
			}
		}
    });
};

// Add a message to db.messages, and reload the page
var postMessage = function(request, response){
	var userIDPass = request.session.userID,
			textPass = request.body.text,
			datePass = request.body.date;
	
	MongoClient.connect(connectStr, {server:{poolSize:1}}, function(error, dbhandle) {
		dbhandle.collection("messages").count(function(error, count){
			var messageCount = count;
			dbhandle.collection("users").find({_id : userIDPass}).toArray(function(error, users){
				var username = users[0].username;
				dbhandle.collection("messages").insert(
					{	_id: messageCount + 1,
						userID: userIDPass,
						text: textPass,
						date: datePass,
						username: username,
						replies:  [],
						favouritedBy: []
					},
					function (error, result){
						assert.equal(null, error);
						dbhandle.close();
					}
				);
			});
		});
	});
	retrieveData(request, response);
};

// Add a reply to a message, and reload the page
var addReply = function(request, response){
	var messageIDRaw = request.params.messageID,
		messageID = parseInt(messageIDRaw.slice(1),10),
		reply = request.body.reply;

	MongoClient.connect(connectStr, function(error, dbhandle) {
		dbhandle.collection("users").findOne({'_id': request.session.userID}, {username:1}, (function(error, replyAuthorObject){
			dbhandle.collection("messages").update(
				{'_id': messageID},
				{
					$push: {"replies": {"text": reply, "replyAuthorUsername" : replyAuthorObject.username}}
				},
				function (error, result){
					assert.equal(null, error);
					dbhandle.close();
				}
			);
		}));
	});
	retrieveData(request, response);
};

// Toggle the 'favourite' attribute of a message for the logged in user
var favouriteMessage = function(request, response){
	var messageIDRaw = request.params.messageID,
		messageID = parseInt(messageIDRaw.slice(1),10);
	
	MongoClient.connect(connectStr, function(error, dbhandle) {
		dbhandle.collection("messages").find({'_id': messageID}).toArray(function(error, messageObjectArray){
			if(messageObjectArray[0].favouritedBy.indexOf(request.session.userID) == -1){
				dbhandle.collection("messages").update(
					{'_id': messageID},
					{
						$push: {"favouritedBy": request.session.userID}
					},
					function (error, result){
						assert.equal(null, error);
						dbhandle.close();
					}
				);
			} else if (messageObjectArray[0].favouritedBy.indexOf(request.session.userID) != -1){
				dbhandle.collection("messages").update(
					{'_id': messageID},
					{
						$pull: {"favouritedBy": request.session.userID}
					},
					function (error, result){
						assert.equal(null, error);
						dbhandle.close();
					}
				);
			}
		});	
	});
	retrieveData(request, response);
};

// Return account information and messages for requested user
var getUserProfile = function(request, response){
	var viewingPageID = request.params.id;
	viewingPageID = viewingPageID.slice(1);
	viewingPageID = parseInt(viewingPageID,10);
	queryDBForUserInfo(request, response, viewingPageID);
};

// Add a user to your friends; i.e. follow the user
var addFriendship = function(request, response){
	var usernameToAddRaw = request.params.username;
	var usernameToAdd = usernameToAddRaw.slice(1);
	
	MongoClient.connect(connectStr, {server:{poolSize:1}}, function(error, dbhandle) {
		dbhandle.collection("users").findOne({'username': usernameToAdd},{_id:1}, (function(error, userIDToFollowObject){
			dbhandle.collection("friendships").insert(
				{
					userID: request.session.userID,
					friendID:userIDToFollowObject._id
				},
				function (error, result){
					assert.equal(null, error);
					dbhandle.close();
				}
			);
		}));
	});
	retrieveData(request, response);
};

// Remove a user from your friends; i.e. unfollow a user
var deleteFriendship = function(request, response){
	var usernameToDeleteRaw = request.params.username;
	var usernameToDelete = usernameToDeleteRaw.slice(1);
	MongoClient.connect(connectStr, {server:{poolSize:1}}, function(error, dbhandle) {
		dbhandle.collection("users").findOne({'username': usernameToDelete},{_id:1}, (function(error, userIDToUnfollowObject){
			dbhandle.collection("friendships").remove(
				{
					userID: request.session.userID,
					friendID: userIDToUnfollowObject._id
				},
				function (error, result){
					assert.equal(null, error);
					dbhandle.close();
				}
			);
		}));
	});
	retrieveData(request, response);
};

// Log out user
var userLogout = function(request, response){
	delete request.session.userID;
	
	if('jsonp' in request.query){
		response.jsonp("Logged out");
	} else {
		response.json("Logged out");
	}
};

// Uploads a JPG file to be used as the user's profile picture
var saveFile = function(request, response){
	var oldPath = request.files.file.path;
	var serverPath = "\\content\\images\\profilePic-"+ request.session.userID  + ".jpg";
	var newPath = __dirname + serverPath;
	var fs = require('fs');
	fs.readFile(oldPath, function(err,data){
		fs.writeFile(newPath, data, function(err){
			fs.unlink(oldPath, function(){
				if(err) throw err;
				MongoClient.connect(connectStr, {server:{poolSize:1}}, function(error, dbhandle) {
					dbhandle.collection("users").update(
						{"_id":request.session.userID}, 
						{$set: 
							{"picUploaded": true}
						},
						function (error, result){
							assert.equal(null, error);
							dbhandle.close();
						}
					);
				});			
				response.redirect("back");
			});
		});
	});
};

craicServer.startUp();