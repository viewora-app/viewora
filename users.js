// ==================== USERS.JS V1.2 ====================

let allUsers = [];
let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {

    auth.onAuthStateChanged(user => {
        if (!user) {
            location.href = "login.html";
            return;
        }

        currentUser = user;
        loadUsers();
    });

});

// ================= LOAD USERS =================

function loadUsers() {

    const container = document.getElementById("usersList");

    container.innerHTML = `
        <p style="text-align:center;padding:40px;color:#888;">
            Loading users...
        </p>
    `;

    db.ref("users").on("value", snapshot => {

        allUsers = [];

        snapshot.forEach(child => {

            allUsers.push({
                uid: child.key,
                ...child.val()
            });

        });

        // Alphabetical order
        allUsers.sort((a,b)=>
            (a.name || "").localeCompare(b.name || "")
        );

        renderUsers(allUsers);

    });

}
// ================= RENDER USERS =================

function renderUsers(users){

    const container = document.getElementById("usersList");

    if(users.length===0){
        container.innerHTML=`
        <p style="text-align:center;padding:60px;color:#888;">
            No users found.
        </p>`;
        return;
    }

    let html="";

    users.forEach(user=>{

        if(currentUser && user.uid===currentUser.uid){
            return;
        }

        html+=`

        <div class="user-card"
        onclick="viewProfile('${user.uid}')"
        style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:15px;
        margin:12px;
        background:#1b1b1b;
        border-radius:15px;
        cursor:pointer;
        ">

            <div style="display:flex;align-items:center;gap:15px;">

                <img
                src="${user.profilePhoto || 'users.jpg'}"
                onerror="this.src='non.jpg'"
                style="
                width:60px;
                height:60px;
                border-radius:50%;
                object-fit:cover;
                border:2px solid #00aaff;
                ">

                <div>

                    <h3 style="margin:0;">
                        ${user.name || "User"}
                    </h3>

                    <p style="margin:5px 0;color:#aaa;">
                        @${user.username || "unknown"}
                    </p>

                    <small id="followers-${user.uid}" style="color:#777;">
                        Loading followers...
                    </small>

                </div>

            </div>

            <button
            onclick="event.stopPropagation();toggleFollow('${user.uid}')"
            id="followBtn-${user.uid}"
            style="
            padding:10px 18px;
            border:none;
            border-radius:25px;
            background:#00aaff;
            color:white;
            font-weight:bold;
            cursor:pointer;
            ">
            Follow
            </button>

        </div>

        `;

    });

    container.innerHTML=html;

    users.forEach(user=>{
        if(currentUser && user.uid!==currentUser.uid){
            loadFollowers(user.uid);
            checkFollowing(user.uid);
        }
    });

}
// ================= FOLLOW SYSTEM =================

function loadFollowers(uid){

    db.ref("followers/" + uid).on("value", snap => {

        const count = snap.numChildren();

        const el = document.getElementById("followers-" + uid);

        if(el){
            el.innerHTML = count + " Followers";
        }

    });

}

function checkFollowing(uid){

    if(!currentUser) return;

    db.ref("following/" + currentUser.uid + "/" + uid).once("value")
    .then(snap=>{

        const btn=document.getElementById("followBtn-"+uid);

        if(!btn) return;

        if(snap.exists()){
            btn.innerHTML="Following";
            btn.style.background="#555";
        }else{
            btn.innerHTML="Follow";
            btn.style.background="#00aaff";
        }

    });

}

window.toggleFollow=function(uid){

    if(!currentUser) return;

    const followingRef=db.ref("following/"+currentUser.uid+"/"+uid);
    const followerRef=db.ref("followers/"+uid+"/"+currentUser.uid);

    followingRef.once("value").then(snap=>{

        if(snap.exists()){

            followingRef.remove();
            followerRef.remove();

            checkFollowing(uid);

        }else{

            followingRef.set(true);
            followerRef.set(true);

            checkFollowing(uid);

        }

    });

};

// ================= SEARCH =================

window.searchUsers=function(){

    const keyword=document
        .getElementById("search")
        .value
        .toLowerCase()
        .trim();

    if(keyword===""){
        renderUsers(allUsers);
        return;
    }

    const filtered=allUsers.filter(user=>{

        return (
            (user.name||"").toLowerCase().includes(keyword) ||
            (user.username||"").toLowerCase().includes(keyword)
        );

    });

    renderUsers(filtered);

};

// ================= PROFILE =================

window.viewProfile=function(uid){

    location.href="profile.html?uid="+uid;

};