/*=========================================
        Viewora Splash
        splash.js
=========================================*/

//==============================
// Elements
//==============================

const splash = document.querySelector(".splash");
const loaderFill = document.querySelector(".loaderFill");
const loadingText = document.getElementById("loadingText");
const logo = document.querySelector(".logo");

//==============================
// Loading Messages
//==============================

const loadingMessages = [

"Initializing Viewora...",
"Loading Assets...",
"Connecting Firebase...",
"Loading User Data...",
"Preparing Experience...",
"Almost Ready..."

];

let msgIndex = 0;

const loadingInterval = setInterval(()=>{

loadingText.textContent =
loadingMessages[msgIndex];

msgIndex++;

if(msgIndex >= loadingMessages.length){

msgIndex = loadingMessages.length-1;

}

},600);

//==============================
// Logo Animation
//==============================

logo.addEventListener("click",()=>{

logo.style.transform="scale(1.15) rotate(8deg)";

setTimeout(()=>{

logo.style.transform="";

},350);

});

//==============================
// Progress Animation
//==============================

let progress=0;

const progressInterval=setInterval(()=>{

progress+=2;

loaderFill.style.width=progress+"%";

if(progress>=100){

clearInterval(progressInterval);

}

},60);

//==============================
// Splash Finish
//==============================

function finishSplash(){

clearInterval(loadingInterval);

splash.classList.add("fadeOut");

setTimeout(()=>{

if(window.firebase){

firebase.auth().onAuthStateChanged(user=>{

if(user){

window.location.replace("index.html");

}else{

window.location.replace("login.html");

}

});

}else{

window.location.replace("index.html");

}

},700);

}

//==============================
// Auto Start
//==============================

setTimeout(finishSplash,3200);

//==============================
// Skip Animation
//==============================

document.addEventListener("keydown",e=>{

if(e.key==="Enter"){

finishSplash();

}

});

let tapCount=0;

document.body.addEventListener("click",()=>{

tapCount++;

if(tapCount>=2){

finishSplash();

}

setTimeout(()=>{

tapCount=0;

},500);

});

//==============================
// Online Check
//==============================

window.addEventListener("offline",()=>{

loadingText.textContent="No Internet Connection";

});

window.addEventListener("online",()=>{

loadingText.textContent="Connection Restored";

});

//==============================
// Prevent Back Button
//==============================

history.pushState(null,null,location.href);

window.onpopstate=function(){

history.go(1);

};

//==============================
// Console
//==============================

console.clear();

console.log(

"%cViewora V1.0",
"color:#6366f1;font-size:22px;font-weight:bold;"

);

console.log(

"%cSplash Loaded Successfully 🚀",
"color:#22c55e;font-size:15px;"

);