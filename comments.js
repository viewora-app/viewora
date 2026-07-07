// =======================================
// Viewora Comments V1.2 - Part 1
// Modal + Load Comments
// =======================================

window.showComments = function(postId, isShort = false){

    const old = document.getElementById("commentsModal");

    if(old) old.remove();

    document.body.insertAdjacentHTML("beforeend",`

    <div id="commentsModal" style="
    position:fixed;
    inset:0;
    background:rgba(0,0,0,.9);
    display:flex;
    align-items:flex-end;
    z-index:9999;">

        <div style="
        width:100%;
        height:80%;
        background:#1b1b1b;
        border-radius:20px 20px 0 0;
        display:flex;
        flex-direction:column;">

            <div style="
            padding:16px;
            display:flex;
            justify-content:space-between;
            border-bottom:1px solid #333;">

                <b>
                    Comments
                    <span id="commentCount">(0)</span>
                </b>

                <span
                onclick="closeComments()"
                style="font-size:30px;cursor:pointer;">
                ×
                </span>

            </div>

            <div id="commentsList"
            style="
            flex:1;
            overflow:auto;
            padding:15px;">

                Loading...

            </div>

            <div style="
            padding:15px;
            border-top:1px solid #333;
            display:flex;
            gap:10px;">

                <input
                id="newCommentInput"
                placeholder="Write a comment..."
                style="
                flex:1;
                padding:14px;
                border:none;
                border-radius:30px;
                background:#2a2a2a;
                color:white;">

                <button
                onclick="postComment('${postId}',${isShort})"
                style="
                padding:0 22px;
                border:none;
                border-radius:30px;
                background:#00aaff;
                color:white;">

                Send

                </button>

            </div>

        </div>

    </div>

    `);

    loadComments(postId,isShort);

};


// =========================
// LOAD COMMENTS
// =========================

function loadComments(postId,isShort){

    const path=isShort?

    `shorts/${postId}/comments`

    :

    `posts/${postId}/comments`;

    db.ref(path)
    .orderByChild("timestamp")
    .on("value",snapshot=>{

        let list=[];

        snapshot.forEach(child=>{

            list.push({

                id:child.key,

                ...child.val()

            });

        });

        list.reverse();

        document.getElementById("commentCount").innerText=
        "("+list.length+")";

        let html="";

        if(list.length===0){

            html=`
            <p style="
            text-align:center;
            margin-top:70px;
            color:#888;">
            No comments yet
            </p>`;

        }

        list.forEach(c=>{

            html+=`

            <div style="
            display:flex;
            gap:12px;
            margin-bottom:18px;">

                <img
                src="${c.profilePhoto||'non.jpg'}"
                style="
                width:42px;
                height:42px;
                border-radius:50%;
                object-fit:cover;">

                <div>

                    <b>

                    ${c.username||"User"}

                    </b>

                    <p>

                    ${c.text}

                    </p>

                    <small style="color:#777;">

                    ${new Date(c.timestamp).toLocaleString()}

                    </small>

                </div>

            </div>

            `;

        });

        document.getElementById("commentsList").innerHTML=html;

    });

}
// =======================================
// Viewora Comments V1.2 - Part 2
// Post + Delete
// =======================================

// POST COMMENT
window.postComment = function(postId, isShort = false){

    const input = document.getElementById("newCommentInput");

    const text = input.value.trim();

    if(!text) return;

    const user = auth.currentUser;

    if(!user){

        alert("Please login first");

        return;

    }

    db.ref("users/"+user.uid).once("value").then(snap=>{

        const u = snap.val() || {};

        const path = isShort
            ? `shorts/${postId}/comments`
            : `posts/${postId}/comments`;

        db.ref(path).push({

            uid:user.uid,

            username:u.username || u.name || "User",

            profilePhoto:u.profilePhoto || "non.jpg",

            text:text,

            timestamp:Date.now()

        }).then(()=>{

            input.value="";

            if(typeof showToast==="function"){

                showToast("✅ Comment Posted");

            }

        });

    });

};


// DELETE COMMENT
window.deleteComment = function(postId, commentId, isShort = false){

    const user = auth.currentUser;

    if(!user) return;

    const path = isShort
        ? `shorts/${postId}/comments/${commentId}`
        : `posts/${postId}/comments/${commentId}`;

    db.ref(path).once("value").then(snap=>{

        if(!snap.exists()) return;

        const comment = snap.val();

        if(comment.uid !== user.uid){

            alert("You can delete only your own comment.");

            return;

        }

        if(confirm("Delete this comment?")){

            db.ref(path).remove();

            if(typeof showToast==="function"){

                showToast("🗑️ Comment Deleted");

            }

        }

    });

};


// ENTER KEY TO SEND
document.addEventListener("keydown",function(e){

    if(e.key!=="Enter") return;

    const modal=document.getElementById("commentsModal");

    if(!modal) return;

    const btn=modal.querySelector("button");

    if(btn){

        btn.click();

    }

});


// CLOSE MODAL
window.closeComments=function(){

    const modal=document.getElementById("commentsModal");

    if(modal){

        modal.remove();

    }

};
// =======================================
// Viewora Comments V1.2 - Part 3
// Final Polish
// =======================================

// TIME AGO
function timeAgo(time){

    const seconds=Math.floor((Date.now()-time)/1000);

    const minutes=Math.floor(seconds/60);

    const hours=Math.floor(minutes/60);

    const days=Math.floor(hours/24);

    if(seconds<60) return "Just now";

    if(minutes<60) return minutes+"m ago";

    if(hours<24) return hours+"h ago";

    if(days<7) return days+"d ago";

    return new Date(time).toLocaleDateString();

}


// AUTO SCROLL TO BOTTOM AFTER POST
function scrollCommentsBottom(){

    const list=document.getElementById("commentsList");

    if(list){

        list.scrollTop=list.scrollHeight;

    }

}


// ESC CLOSE
document.addEventListener("keydown",e=>{

    if(e.key==="Escape"){

        closeComments();

    }

});


// CLICK OUTSIDE TO CLOSE
document.addEventListener("click",e=>{

    const modal=document.getElementById("commentsModal");

    if(!modal) return;

    if(e.target===modal){

        closeComments();

    }

});


// AUTO FOCUS INPUT
document.addEventListener("DOMContentLoaded",()=>{

    const input=document.getElementById("newCommentInput");

    if(input){

        input.focus();

    }

});


// CLEANUP
window.addEventListener("beforeunload",()=>{

    const modal=document.getElementById("commentsModal");

    if(modal){

        modal.remove();

    }

});

console.log("✅ Viewora Comments V1.2 Loaded");