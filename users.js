// ==========================================
// VIEWORA USERS.JS
// Premium Users Page
// ==========================================

let currentUser = null;
let users = [];

const list = document.getElementById("allUsers");
const suggested = document.getElementById("suggestedUsers");

// ==========================================
// Auth
// ==========================================

auth.onAuthStateChanged(user=>{

    if(!user){

        location.href="login.html";
        return;

    }

    currentUser=user;

    loadUsers();

});

// ==========================================
// Load Users
// ==========================================

function loadUsers(){

    db.ref("users")

    .on("value",snapshot=>{

        users=[];

        list.innerHTML="";
        suggested.innerHTML="";

        snapshot.forEach(child=>{

            if(child.key===currentUser.uid)
            return;

            users.push({

                uid:child.key,

                ...child.val()

            });

        });

        users.sort(()=>Math.random()-.5);

        renderUsers();

    });

}

// ==========================================
// Render Users
// ==========================================

function renderUsers(){

    list.innerHTML="";
    suggested.innerHTML="";

    users.forEach((user,index)=>{

        const card=createUserCard(user);

        list.appendChild(card);

        if(index<5){

            suggested.appendChild(
                createUserCard(user)
            );

        }

    });

}

// ==========================================
// Create Card
// ==========================================

function createUserCard(user){

    const div=document.createElement("div");

    div.className="userCard";

    div.innerHTML=`

<div class="userLeft">

<div class="userPhoto">

<img src="${
user.profilePhoto||'users.jpg'
}">

${
user.online?

'<div class="onlineDot"></div>'

:''

}

</div>

<div class="userInfo">

<h3>

${user.name||"User"}

${
user.verified?

'<span class="verified">✔</span>'

:''

}

</h3>

<p>

${user.username||""}

</p>

</div>

</div>

<button

class="followBtn"

onclick="event.stopPropagation();followUser('${user.uid}',this)"

>

Follow

</button>

`;

    div.onclick=()=>{

        location.href=

        "profile.html?uid="+user.uid;

    };

    return div;

}

// ==========================================
// Search
// ==========================================

window.searchUsers=function(){

    const value=

    document

    .getElementById("searchInput")

    .value

    .toLowerCase();

    document

    .querySelectorAll(".userCard")

    .forEach(card=>{

        card.style.display=

        card.innerText

        .toLowerCase()

        .includes(value)

        ?"flex"

        :"none";

    });

};

// ==========================================
// Follow
// ==========================================

window.followUser=async function(uid,btn){

if(!currentUser) return;

await db.ref(

"following/"+

currentUser.uid+

"/"+uid

).set(true);

await db.ref(

"followers/"+

uid+

"/"+currentUser.uid

).set(true);

btn.innerHTML="Following";

btn.classList.add("following");

};

// ==========================================
// Scroll Button
// ==========================================

window.addEventListener("scroll",()=>{

const btn=

document.getElementById("scrollTopBtn");

if(window.scrollY>300){

btn.style.display="block";

}else{

btn.style.display="none";

}

});

console.log("=================================");
console.log("👥 Viewora Users Loaded");
console.log("🔍 Search Ready");
console.log("➕ Follow Ready");
console.log("⭐ Suggested Users Ready");
console.log("=================================");