// ==================== VIEWORATION.JS - V1.2 FINAL ====================

document.addEventListener("DOMContentLoaded", () => {

    let currentUserUid = null;

    auth.onAuthStateChanged(user => {

        if (!user) {
            location.href = "login.html";
            return;
        }

        currentUserUid = user.uid;
        loadPosts();

    });

    // ================= CREATE POST =================

    window.createPost = function () {

        const text = document.getElementById("postText").value.trim();
        const imageUrl = document.getElementById("imageUrl").value.trim();

        if (!text) {
            alert("Please write something!");
            return;
        }

        db.ref("users/" + currentUserUid).once("value").then(snap => {

            const u = snap.val() || {};

            const postId = db.ref("posts").push().key;

            db.ref("posts/" + postId).set({

                uid: currentUserUid,
                name: u.name || "User",
                username: u.username || "@user",
                profilePhoto: u.profilePhoto || "non.jpg",

                text: text,

                imageUrl: imageUrl || "",

                createdAt: Date.now(),

                likes: 0

            }).then(() => {

                document.getElementById("postText").value = "";
                document.getElementById("imageUrl").value = "";

                if (typeof showToast === "function") {
                    showToast("✅ Post Created");
                } else {
                    alert("Post Created");
                }

            });

        });

    };


    // ================= LOAD POSTS =================

    function loadPosts() {

        const container = document.getElementById("postsList");

        if (!container) return;

        db.ref("posts")
        .orderByChild("createdAt")
        .on("value", snapshot => {

            let posts = [];

            snapshot.forEach(child => {

                posts.push({

                    id: child.key,

                    ...child.val()

                });

            });

            posts.reverse();

            let html = "";

            posts.forEach(post => {

                const media = post.mediaUrl || post.imageUrl;

                html += `

                <div class="post" style="background:#1b1b1b;padding:16px;margin:15px;border-radius:15px;">

                    <div style="display:flex;align-items:center;gap:10px;">

                        <img src="${post.profilePhoto || 'non.jpg'}"

                        style="width:45px;height:45px;border-radius:50%;object-fit:cover;">

                        <div>

                            <b>${post.name || "User"}</b><br>

                            <small>${post.username || "@user"}</small>

                        </div>

                    </div>

                    <p style="margin-top:12px;">
                        ${post.text || ""}
                    </p>

                    ${
                        media ?

                        `<img src="${media}"

                        style="width:100%;border-radius:12px;margin-top:10px;"

                        onerror="this.style.display='none'">`

                        : ""
                    }

                    <small style="color:#777;">
                    ${new Date(post.createdAt).toLocaleString()}
                    </small>

                    <div style="margin-top:15px;display:flex;gap:20px;">

                        <span onclick="toggleLike('${post.id}')">

                        ❤️ ${post.likes || 0}

                        </span>

                        <span onclick="showComments('${post.id}',false)">

                        💬 Comment

                        </span>

                        ${
                            post.uid===currentUserUid ?

                            `<span onclick="deletePost('${post.id}')">

                            🗑️ Delete

                            </span>`

                            : ""
                        }

                    </div>

                </div>

                `;

            });

            container.innerHTML = html || `
            <p style="text-align:center;padding:60px;">
            No Posts Yet
            </p>`;

        });

    }


    // ================= LIKE =================

    window.toggleLike = function(postId){

        const ref = db.ref(`postLikes/${postId}/${currentUserUid}`);

        ref.once("value").then(snap=>{

            if(snap.exists()){

                ref.remove();

                db.ref("posts/"+postId+"/likes")

                .transaction(v=>Math.max((v||0)-1,0));

            }

            else{

                ref.set(true);

                db.ref("posts/"+postId+"/likes")

                .transaction(v=>(v||0)+1);

            }

        });

    };


    // ================= DELETE =================

    window.deletePost = function(postId){

        if(!confirm("Delete this post?")) return;

        db.ref("comments/"+postId).remove();

        db.ref("postLikes/"+postId).remove();

        db.ref("posts/"+postId).remove();

    };

});