/*
*
* ------------------------------------------ craic module ------------------------------------------
*
*/
var craic = (function() {

	//Check whether a session has already been established
	var onPageLoaded = function(){
		checkForSession();		
	};
	
	
	/*
	*
	* ------------------------------------------ Independent AJAX call functions ------------------------------------------
	*
	*/

	
	/*
	* ------- Check for session -------
	*/
	var checkForSession = function(){
		$.ajax({
			url:"/sessionCheck",
			type: "GET",
			success: function(response){
				if(response){
					loggedInDisplay(response);
				} else {
					loggedOutDisplay();
				}
				$("#followUser").hide();
				$("#unfollowUser").hide();
			}
		});
	};

	
	/*
	* ------- Register -------
	*/
	$(function() {
		$("#registerButton").on("click", function(){
			var usernameInput = $("#headerFormUsername").val(),
				passwordInput = $("#headerFormPassword").val(),
				firstnameInput = $("#headerFormFirstname").val(),
				lastnameInput = $("#headerFormLastname").val(),
				descriptionInput = $("#headerFormDetails").val()
			;
			
			$.ajax({
				type: "POST",
				url: "/register",
				data: 
					{
					username: usernameInput,
					pass: passwordInput,
					firstname: firstnameInput,
					lastname: lastnameInput,
					description: descriptionInput
					},
				success: function(response){
					if (response.indexOf("successful")!=-1){
						alert(response);
						$("#loginRegisterArea input").val("");
						$(".hidden").fadeToggle("slow");
						$("#loginButton").fadeToggle("slow");
						$("#createAccountButton").html("Create account");
					} else {
						alert(response);
					}
				}
			});
		});
	});


	/* 
	* ------- Login -------
	*/
	$(function() {
		$("#loginButton").on("click", function(){
			var usernameInput = $("#headerFormUsername").val(),
				passwordInput = $("#headerFormPassword").val(),
				userInfoObject
			;
			
			$.ajax({
				type: "POST",
				url: "/login",
				data: 
					{	
					username: usernameInput, 
					pass: passwordInput
					},
				dataType: "json",
				success: function (response) {
					if(response){
						loggedInDisplay(response);
					} else {
						alert("Login failed. Please try again or register");
					}
				}
			});
		});
	});


	/* 
	* ------- Logout -------
	*/
	$(function() {
		$("#logoutButton").on("click", function(){
			$.ajax({
				type:"GET",
				url:"/logout",
				success: function(response){
					if(response == "Logged out"){
						loggedOutDisplay();
					}
				}
			});
		});
	});


	/* 
	* ------- Submit message -------
	*/
	$(function() {
		$("#submitCraic").on("click", function(){
			var craicText = $("#composeCraic").val(),
				craicDate = new Date()
			;				
			
			$.ajax({
				type: "POST",
				url: "/postCraic",
				data: 
					{ 
					text: craicText,
					date: craicDate
					},
				success: function(response){
					$("#composeCraic").val("");
					$("#messages div").remove();
					populateUserInfo(response);
					populateCraics(response);
					populateViewedUserInfo(response);
				}
			});
		});
	});

	
	/* 
	* ------- Upload profile picture -------
	*/
	$(function() {
		$('#uploadPicForm').on('submit' , function() {
			$(this).ajaxSubmit({			
				url:"/uploadFile",
				error: function(xhr) {
					status('Error: ' + xhr.status);
				}
			});
		});
	});
	
	
	/* 
	* ------- Follow user -------
	*/
	$(function() {
		$("#followUser").on("click", function() {
			var usernameToFollow = $("#userDetailsUsername").text();
			$.ajax({
				type: "POST",
				url: "/followUser/:" + usernameToFollow,
				success: function(response){
					//Even though populateCraics is called in loggedInDisplay, calling it here helped solve some malfunctioning
					populateCraics(response); 
					loggedInDisplay(response);				
				}			
			});
		});
	});
	
	
	/* 
	* ------- Unfollow user -------
	*/
	$(function() {
		$("#unfollowUser").on("click", function() {
			var usernameToUnfollow = $("#userDetailsUsername").text();
			$.ajax({
				type: "POST",
				url: "/unfollowUser/:" + usernameToUnfollow,
				success: function(response){
					loggedInDisplay(response);				
				}			
			});
		});
	});

	
	/* 
	* ------- View other user -------
	*/
	var setOnclickFunctionalityUserlist = function(){
		$(".otherUser").on("click", function(){
			var userID = $(this).attr("id");
			$.ajax({
				type: "GET",
				url: "/userProfile/:" + userID,
				success: function(response){
					populateCraics(response);
					populateViewedUserInfo(response);
					checkFriendshipStatus(response);
					$("#userDetails").show();
				}
			});
		});
	};
	
	
	
	/*
	*
	* ------------------------------------------ Primary interface functions ------------------------------------------
	*
	*/
	
	/* 
	* Populate data into the current user's profile area (left div)
	*/
	var populateUserInfo = function(responseObject){
		$("#currentUserName").text(responseObject[0].firstname + " " + responseObject[0].lastname);
		$("#currentUserUsername").text(responseObject[0].username);
		$("#numberCraics").text(responseObject[1]);
		$("#numberFollowers").text(responseObject[2]);
		$("#numberFollowing").text(responseObject[3]);
		
		if(responseObject[0].picUploaded){
			$("#currentUserPicture").attr("src", "/images/profilePic-" + responseObject[0].loggedInUserID + ".jpg");
		} else if (!responseObject[0].picUploaded){
			$("#currentUserPicture").attr("src", "profilePlaceholder.png");
		}
	};

	
	/* 
	* Populate data into the viewed user's information area (upper middle div)
	*/
	var populateViewedUserInfo = function(responseObject){
		$("#userDetailsName").text(responseObject[0].firstname + " " + responseObject[0].lastname);
		$("#userDetailsUsername").text(responseObject[0].username);
		$("#userDetailsInfo").text(responseObject[0].description);
		$("#numberCraicsViewedUser").text(responseObject[1]);
		$("#numberFollowersViewedUser").text(responseObject[2]);
		$("#numberFollowingViewedUser").text(responseObject[3]);
		
		if(responseObject[0].picUploaded){
			$("#userDetailsPicture").attr("src", "/images/profilePic-" + responseObject[0].userID + ".jpg");
		} else if (!responseObject[0].picUploaded){
			$("#userDetailsPicture").attr("src", "profilePlaceholder.png");
		}
	};

	/* 
	* Populate messages into the messages area (lower middle div)
	*/
	var populateCraics = function(responseObject){
		var i,
			j
		;
		
		$("#messages .message").remove();
		
		//Check for available messages. Important for when application is started for the first time with no messages in place
		if(responseObject[5]){
		
			//Loop through the messages and append each message to the div
			for (i=0; i<responseObject[5].length; i++){
				var replies = responseObject[5][i].replies;
				
				$("#messages").append(
					$("<div>").addClass("message").append(
						$("<span>").addClass("messageAuthor").text(responseObject[5][i].username + " ")
					).append(
						$("<span>").addClass("messageDate").text(responseObject[5][i].date)
					).append(
						$("<div>").addClass("iconsDiv").append(
							$("<span>").addClass("favouriteIcon").text("☆")
						).append(
							$("<span>").addClass("spreadIcon").attr("title", "Spread message").text("✉")
						).append(
							$("<span>").addClass("replyIcon").attr("title", "Reply").text("✎")
						)
					).append(
						$("<p>").addClass("messageText").attr("id", "messageID: " + responseObject[5][i]._id).text(responseObject[5][i].text)
					)
				);		
				
				//Check for replies and if there are any, append them to the message element
				if(replies.length > 0){
					for(j=0; j<replies.length; j++){
						$("#messages").children(".message").eq(i).append(
							$("<div>").addClass("replyDisplay").text(replies[j].replyAuthorUsername + ": " + replies[j].text)
						);
					}
				}
			}
		}
		
		setOnclickFunctionalityButtons();
		toggleFavourite(responseObject);
	};


	/* 
	* Populate users into the list of all users (right div)
	*/
	var populateUserlist = function(responseObject){
		var i;
		$("#usersOverviewList").empty();

		for (i=0; i<responseObject[4].length; i++){
			var j = i+1;
			if(responseObject[4][i].picUploaded) {				
				$("#usersOverviewList").append(
					$("<li>").addClass("otherUser").attr("id", i+1).text(responseObject[4][i].firstname + " " + responseObject[4][i].lastname).append(
						$("<span>").addClass("helper")
					).append(
						$("<img>").attr("src", "/images/profilePic-" + j + ".jpg").addClass("smallProfilePic")
					)
				);
			} else {
				$("#usersOverviewList").append(
					$("<li>").addClass("otherUser").attr("id", i+1).text(responseObject[4][i].firstname + " " + responseObject[4][i].lastname).append(
						$("<span>").addClass("helper")
					).append(
						$("<img>").attr("src", "profilePlaceholder.png").addClass("smallProfilePicPlaceholder")
					)
				);
			}
		}
			
		searchUsers(responseObject);
		setOnclickFunctionalityUserlist();
	};


	
	/*
	*
	* --------------------- Dependent/callback ajax call function and secondary/auxiliary interface functions ---------------------
	*
	*/

	
	/* 
	* ------- File upload change event handler -------
	*/	
	//Call checkFileType on the change event of the upload form
	$(function(){
		$("#picFile").on("change", function(){
			checkFileType();
			var file = this.files[0];
			var name = file.name;
			var size = file.size;
			var type = file.type;
		});
	});
	
	//Alert that the currently selected file is not a .jpg file, if it is not
	var checkFileType = function(){
		var typeString = "";
		typeString = $('#picFile').val().slice($('#picFile').val().indexOf(".") + 1).toLowerCase();
		if(typeString != "jpg"){
			alert(typeString + " files are not supported. Please upload a .jpg file");
			$("#picFileSubmit").hide();
			return;
		}
		if(typeString == "jpg"){
			$("#picFileSubmit").show();
			return;
		}
	};

	
	
	//Set onclick functionalities for dynamically generated icon buttons
	var setOnclickFunctionalityButtons = function() {
		setOnclickFunctionalityReply();
		setOnclickFunctionalitySpread();
		setOnclickFunctionalityFavourite();
	};

	
	/* 
	* ------- Reply to message -------
	*/	
	//Onclick event handler function for replying to messages
	var setOnclickFunctionalityReply = function() {
		$(".replyIcon").on("click", function() {
			
			//Only allow one reply textarea window
			if($(this).parent().parent().children(".replyEdit").length === 0) {
				$(this).parent().parent().append(
					$("<div>").addClass("replyEdit").append(
						$("<textarea>").addClass("replyTextarea")
					).append(
						$("<button>").
							addClass("replyButton").
							attr({"type": "button", "name": "reply", "value": "reply"}).
							html("Reply").
							on("click", function() {
								var replyTextPass = $(this).siblings("textarea").val();
								var	messageIDPass = parseInt($(this).parent().siblings(".messageText").attr("id").slice(11), 10);
								setOnclickFunctionalityDoReply(messageIDPass, replyTextPass);
							})
					)
				);
			}
			$(this).parent().siblings(".replyEdit").children(".replyTextarea").focus();
		});
	};

	//Callback AJAX call function to post the reply
	var setOnclickFunctionalityDoReply = function(messageID, replyText){	
		$.ajax({
			type: "POST",
			url: "/addReply/:" + messageID,
			data:
			{
				reply: replyText
			},
			success: function(response){
				populateCraics(response);
			}
		});
	};
	
	
	
	//Onclick event handler function for spreading/sharing messages
	var setOnclickFunctionalitySpread = function() {
		$(".spreadIcon").on("click", function() {
			var messageToSpread = $(this).parent().siblings(".messageText").text(),
				messageBy = $(this).parent().siblings(".messageAuthor").text()
			;
			
			//Populates message's text and author's username into current user's composeCraic textarea
			$("#composeCraic").val("From " + messageBy + ": " + messageToSpread);
			$("#composeCraic").focus();
		});
	};

	

	/* 
	* ------- Mark message as favourite -------
	*/	
	//AJAX call function that adds/deletes a message from the current user's favourites
	var setOnclickFunctionalityFavourite = function() {
		$(".favouriteIcon").on("click", function() {		
			var	messageIDPass = parseInt($(this).parent().siblings(".messageText").attr("id").slice(11), 10);
			
			$.ajax({
				type: "POST",
				url: "/favouriteMessage/:" + messageIDPass,
				success: function(response){
					populateViewedUserInfo(response);
					checkFriendshipStatus(response);
					populateCraics(response);
				}
			});
		});
	};
	
	//Toggle favourite icon display
	var toggleFavourite = function (responseObject){	
		var currentUserUserID = responseObject[0].loggedInUserID,
			numberOfMessages = responseObject[5].length,
			i
		;
		
		//Go through the array of messages returned from the server
		for(i=0;i<numberOfMessages;i++){
			var messageFavouritedByUserIDs = responseObject[5][i].favouritedBy;
			
			//Check for messages marked as favourite by the current user and highlight them (=highlight toggle)
			if(messageFavouritedByUserIDs.indexOf(currentUserUserID) !== -1){
				$("#messages").children(".message").eq(i).children(".iconsDiv").children(".favouriteIcon").
					attr("title", "Demark as favourite").addClass("favouriteIconActive");
			} else if(messageFavouritedByUserIDs.indexOf(currentUserUserID) == -1){
				$("#messages").children(".message").eq(i).children(".iconsDiv").children(".favouriteIcon").
					attr("title", "Mark as favourite").removeClass("favouriteIconActive");
			}
		}
	};

	
	
	//Enable case-insensitive search-users functionality
	var searchUsers = function(responseObject) {
		var usersArrayInit = responseObject[4],
			usersArrayFiltered = [],
			usersArrayLengthInit = responseObject[4].length,
			i,
			j
		;

		$("#searchUsersInput").on("keyup", function(){
			var searchValue = $("#searchUsersInput").val();
			usersArrayFiltered.length = 0;
			
			//Check and push into an array all users that contain input text
			for (i=0;i<usersArrayLengthInit;i++){
				if ((usersArrayInit[i].firstname + " " + usersArrayInit[i].lastname).toUpperCase().indexOf(searchValue.toUpperCase()) !== -1){
					usersArrayFiltered.push(usersArrayInit[i]);
				}
			}

			//Remove all user <li> elements and add only the ones of users matching the content in the input field.
			//Also check whether there is a profile picture and if not, display a placeholder picture
			$("#usersOverviewList").empty();
			for (j=0;j<usersArrayFiltered.length;j++){
				if(usersArrayFiltered[j].picUploaded) {	
					$("#usersOverviewList").append(
						$("<li>").text(usersArrayFiltered[j].firstname + " " + usersArrayFiltered[j].lastname).addClass("otherUser").attr("id", usersArrayFiltered[j]._id).append(
							$("<span>").addClass("helper")
						).append(
							$("<img>").attr("src", "/images/profilePic-" + usersArrayFiltered[j]._id + ".jpg").addClass("smallProfilePic")
						)
					);
				} else {
					$("#usersOverviewList").append(
						$("<li>").text(usersArrayFiltered[j].firstname + " " + usersArrayFiltered[j].lastname).addClass("otherUser").attr("id", usersArrayFiltered[j]._id).append(
							$("<span>").addClass("helper")
						).append(
							$("<img>").attr("src", "profilePlaceholder.png").addClass("smallProfilePicPlaceholder")
						)
					);
				}
			}
			setOnclickFunctionalityUserlist();		
		});
	};

	
	
	//Show and populate page for somebody who is logged in
	var loggedInDisplay = function(responseObject){
		$("#loginRegisterArea").hide();
		$("#logoutArea").show();
		$("#displayUsername").text();
		$("#mainLoggedOut").hide();
		$("#mainLoggedIn").show();
		displayLoggedinUsername(responseObject);
		populateUserInfo(responseObject);
		populateCraics(responseObject);
		toggleFavourite(responseObject);
		populateUserlist(responseObject);
		populateViewedUserInfo(responseObject);
		checkFriendshipStatus(responseObject);
	};
	
	
	
	//Show page for somebody who is not logged in
	var loggedOutDisplay = function(){
		$("#loginRegisterArea").show();
		$("#logoutArea").hide();
		$("#mainLoggedOut").show();
		$("#mainLoggedIn").hide();
	};

	
	
	//Handle follow and unfollow icons
	var checkFriendshipStatus = function (responseObject){
		//Do not show follow or unfollow icons on your own page
		if($("#userDetailsName").text() == $("#currentUserName").text()){
			$("#followUser").hide();
			$("#unfollowUser").hide();
		} else {
			//Show only "unfollow" for users you are following, and only "follow" for users you are not yet following
			if(responseObject[6]){
				$("#followUser").hide();
				$("#unfollowUser").show();
			} else {
				$("#followUser").show();
				$("#unfollowUser").hide();
			}
		}
	};
	
	
	
	//Display current username in header area
	var displayLoggedinUsername = function(responseObject){
		$("#displayUsername").text(responseObject[0].username);
	};
	
	
	
	//Toggle between login and register display
	$(function() {
		$("#createAccountButton").on("click", function(){
			$(".hidden").fadeToggle("slow");
			$("#loginButton").fadeToggle("slow");
			toggleCreateAccountText();			
		});
	});

	//Check text content of createAccountButton to toggle update its content
	var toggleCreateAccountText = function(){
		if($("#createAccountButton").html() == "Create account"){
			$("#createAccountButton").html("Back to login");
		} else if($("#createAccountButton").html() == "Back to login"){
			$("#createAccountButton").html("Create account");
		}
	};
	
	
	//Switch background design functionality
	$(function() {
		$("#designSelect").on("change", function(){
			$("body").css("background-image", "url('/background/" + ($(this).val() + ".png')"));
		});
	});
	
	
	
	//Enable jQuery UI Tooltip functionality
	$(function() {
		$(document).tooltip();
	});

	
	
	//Function returned by the module. Gets called on the document.ready event
	var startCraic = function(){
		onPageLoaded();
	};
	
	
	//The module returns only startCraic as an externally accessible function
	return {
		startCraic: startCraic
	};
	
})();

$(document).ready(function(){
	craic.startCraic();
});
