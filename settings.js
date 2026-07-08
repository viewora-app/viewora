// ===============================
// SETTINGS.JS
// Viewora
// ===============================

let currentUser = null;

// -------------------------------
// Check Login
// -------------------------------

auth.onAuthStateChanged(function(user){

    if(!user){
        window.location.href = "login.html";
        return;
    }

    currentUser = user;

    loadUserProfile();

});

// -------------------------------
// Load Profile
// -------------------------------

function loadUserProfile(){

    db.ref("users/" + currentUser.uid)
    .once("value")
    .then(function(snapshot){

        const data = snapshot.val();

        const box = document.getElementById("userInfo");

        if(!box) return;

        if(!data){

            box.innerHTML = `
                <img src="non.jpg">
                <h2>User</h2>
                <p>@user</p>
            `;

            return;

        }

        box.innerHTML = `

            <img
            src="${data.profilePhoto || 'non.jpg'}"
            onerror="this.src='non.jpg'">

            <h2>${data.name || "User"}</h2>

            <p>@${data.username || "user"}</p>

        `;

    })
    .catch(function(error){

        console.log(error);

    });

}

// -------------------------------
// Edit Profile
// -------------------------------

window.editProfile = function(){

    location.href = "edit-profile.html";

};

// -------------------------------
// Notifications
// -------------------------------

window.goToNotifications = function(){

    location.href = "notifications.html";

};

// -------------------------------
// Dark Mode
// -------------------------------

window.toggleDarkMode = function(){

    document.body.classList.toggle("light");

    if(document.body.classList.contains("light")){

        localStorage.setItem("theme","light");

    }else{

        localStorage.setItem("theme","dark");

    }

};

// Apply Theme

window.addEventListener("load",function(){

    const theme = localStorage.getItem("theme");

    if(theme==="light"){

        document.body.classList.add("light");

    }

});

// -------------------------------
// Help
// -------------------------------

window.showHelp = function(){

    alert(
`Help Center

Email:
vieworasupport@gmail.com

Thank you for using Viewora ❤️`
);

};

// -------------------------------
// About
// -------------------------------

window.showAbout = function(){

    alert(
`Viewora

Version : 1.0.0

Developed using Firebase

© 2026 Viewora`
);

};

// -------------------------------
// Share App
// -------------------------------

window.shareApp = function(){

    if(navigator.share){

        navigator.share({

            title:"Viewora",

            text:"Join me on Viewora!",

            url:window.location.origin

        });

    }else{

        alert("Sharing is not supported.");

    }

};

// -------------------------------
// Rate App
// -------------------------------

window.rateApp = function(){

    alert("Viewora will be available on Google Play soon.");

};

// -------------------------------
// Logout
// -------------------------------

window.logout = function(){

    if(!confirm("Logout from Viewora?")) return;

    auth.signOut()
    .then(function(){

        location.href = "login.html";

    })
    .catch(function(error){

        alert(error.message);

    });

};

// -------------------------------
// Version
// -------------------------------

console.log("✅ Settings Loaded");