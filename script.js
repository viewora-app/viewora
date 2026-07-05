alert("Welcome to Viewora!");
 function subscribe(){

document.getElementById("sub-btn")
.innerHTML="Subscribed ✅";
}
function addComment(){

let comment =
document.getElementById("comment-input").value;

if(comment !== ""){

document.getElementById("comments").innerHTML +=
"<p>💬 " + comment + "</p>";

document.getElementById("comment-input").value = "";

}

}
let likes = 0;

function likeVideo() {

    likes++;

    document.getElementById("likeCount").innerHTML =
    "Likes: " + likes;

}
let subscribed = false;

function subscribe(){

if(subscribed == false){

document.getElementById("sub-btn").innerHTML =
"Subscribed ✅";

subscribed = true;

}else{

document.getElementById("sub-btn").innerHTML =
"Subscribe";

subscribed = false;

}

}
function notify(){
 alert("New Notification!");
}
function toggleMenu(){

let menu =
document.getElementById("sidebar");

if(menu.style.left === "0px"){

menu.style.left = "-250px";

}else{

menu.style.left = "0px";

}

}
function darkMode(){
    document.body.style.background = "black";
    document.body.style.color = "white";
}
function searchVideo(){

let search =
document.getElementById("searchInput")
.value.toLowerCase();

if(search === "viewora"){

window.location.href =
"video1.html";

}else{

alert("Video not found");

}

}
function login(){

let username =
document.getElementById("username").value;

let password =
document.getElementById("password").value;

if(username !== "" && password !== ""){

window.location.href = "index.html";

}else{

alert("Please fill all fields");

}

}
function signup(){

alert("Account Created Successfully!");

window.location.href =
"login.html";

}