// ============================================
// DELETE ACCOUNT V2.0
// PART 2
// Password Verification + Re-Authentication
// ============================================

let currentUser = null;

// ============================================
// Check Login
// ============================================

auth.onAuthStateChanged((user) => {

    if (!user) {

        location.href = "login.html";

        return;

    }

    currentUser = user;

});

// ============================================
// Start Delete Process
// ============================================

window.startDeleteProcess = async function () {

    if (!currentUser) return;

    const password =
        document.getElementById("deletePassword").value.trim();

    if (!password) {

        showToast("Enter your password");

        return;

    }

    const confirmDelete = confirm(

`Delete your Viewora account permanently?

This action cannot be undone.`

    );

    if (!confirmDelete) return;

    verifyPassword(password);

};

// ============================================
// Verify Password
// ============================================

async function verifyPassword(password){

    try{

        loading(true);

        const credential =

        firebase.auth.EmailAuthProvider.credential(

            currentUser.email,

            password

        );

        await currentUser.reauthenticateWithCredential(

            credential

        );

        showToast("Password Verified");

        beginDeleteDatabase();

    }

    catch(error){

        loading(false);

        alert(error.message);

    }

}

// ============================================
// Loading Button
// ============================================

function loading(state){

    const btn=document.getElementById("deleteBtn");

    if(!btn) return;

    if(state){

        btn.disabled=true;

        btn.innerHTML="Deleting...";

    }

    else{

        btn.disabled=false;

        btn.innerHTML="Delete My Account";

    }

}

// ============================================

console.log("✅ Delete Account Part 2 Loaded");
// ============================================
// DELETE ACCOUNT V2.0
// PART 3
// Database Cleanup
// ============================================

async function beginDeleteDatabase() {

    try {

        const uid = currentUser.uid;

        // ===============================
        // User Profile
        // ===============================

        await db.ref("users/" + uid).remove();

        // ===============================
        // Followers
        // ===============================

        await db.ref("followers/" + uid).remove();

        // ===============================
        // Following
        // ===============================

        await db.ref("following/" + uid).remove();

        // ===============================
        // Notifications
        // ===============================

        await db.ref("notifications/" + uid).remove();

        // ===============================
        // Online Status
        // ===============================

        await db.ref("status/" + uid).remove();

        // ===============================
        // Block List
        // ===============================

        await db.ref("blockedUsers/" + uid).remove();

        // ===============================
        // Typing Status
        // ===============================

        await db.ref("typing").once("value")
        .then((snapshot)=>{

            snapshot.forEach((chat)=>{

                chat.ref.child(uid).remove();

            });

        });

        // ===============================
        // User Posts
        // ===============================

        const posts = await db.ref("posts")
        .orderByChild("uid")
        .equalTo(uid)
        .once("value");

        posts.forEach((child)=>{

            child.ref.remove();

        });

        // ===============================
        // User Shorts
        // ===============================

        const shorts = await db.ref("shorts")
        .orderByChild("uid")
        .equalTo(uid)
        .once("value");

        shorts.forEach((child)=>{

            child.ref.remove();

        });

        // ===============================
        // User Stories
        // ===============================

        const stories = await db.ref("stories")
        .orderByChild("uid")
        .equalTo(uid)
        .once("value");

        stories.forEach((child)=>{

            child.ref.remove();

        });

        // ===============================
        // Comments
        // ===============================

        const comments = await db.ref("comments")
        .once("value");

        comments.forEach((post)=>{

            post.forEach((comment)=>{

                if(comment.val().uid===uid){

                    comment.ref.remove();

                }

            });

        });

        // ===============================
        // Likes
        // ===============================

        const likes = await db.ref("postLikes")
        .once("value");

        likes.forEach((post)=>{

            post.child(uid).ref.remove();

        });

        // ===============================
        // Continue Final Delete
        // ===============================

        finishDeleteAccount();

    }

    catch(error){

        console.error(error);

        loading(false);

        alert(error.message);

    }

}

console.log("✅ Delete Account Part 3 Loaded");
// ============================================
// DELETE ACCOUNT V2.0
// PART 4
// Final Delete + Logout
// ============================================

async function finishDeleteAccount() {

    try {

        const uid = currentUser.uid;

        // ===============================
        // Remove User From Chats
        // ===============================

        const chats = await db.ref("chats").once("value");

        chats.forEach((chat) => {

            const data = chat.val();

            if (
                data.participants &&
                data.participants[uid]
            ) {

                chat.ref.child("participants/" + uid).remove();

            }

        });

        // ===============================
        // Remove User Status
        // ===============================

        await db.ref("status/" + uid).remove();

        // ===============================
        // Delete Firebase Auth Account
        // ===============================

        await currentUser.delete();

        // ===============================
        // Logout
        // ===============================

        await auth.signOut();

        loading(false);

        showSuccess();

    }

    catch (error) {

        console.error(error);

        loading(false);

        alert(error.message);

    }

}

// ============================================
// Success Screen
// ============================================

function showSuccess() {

    document.body.innerHTML = `

    <div style="
        height:100vh;
        display:flex;
        flex-direction:column;
        justify-content:center;
        align-items:center;
        background:#0f0f0f;
        color:white;
        text-align:center;
        animation:fade .5s;
    ">

        <div style="
            font-size:90px;
            color:#00ff88;
            margin-bottom:20px;
        ">
            ✅
        </div>

        <h1>
            Account Deleted
        </h1>

        <p style="
            color:#aaa;
            margin-top:15px;
            max-width:320px;
            line-height:1.7;
        ">
            Your Viewora account has been permanently deleted.
            Thank you for using Viewora.
        </p>

    </div>

    <style>

    @keyframes fade{

        from{
            opacity:0;
            transform:scale(.9);
        }

        to{
            opacity:1;
            transform:scale(1);
        }

    }

    </style>

    `;

    setTimeout(() => {

        location.href = "login.html";

    }, 3000);

}

// ============================================

console.log("✅ Delete Account Final Loaded");