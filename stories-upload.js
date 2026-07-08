// ==========================================
// VIEWORA STORIES UPLOAD V3.0
// PART 1
// Firebase Storage + Gallery Picker
// ==========================================

// Firebase Storage
const storage = firebase.storage();

// Current Selected File
let selectedStoryFile = null;

// ==========================================
// Open Gallery
// ==========================================

window.openStoryGallery = function () {

    const picker =
    document.getElementById("storyFile");

    if (!picker) {

        console.error("storyFile input not found");

        return;

    }

    picker.click();

};

// ==========================================
// File Selected
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const picker =
    document.getElementById("storyFile");

    if (!picker) return;

    picker.addEventListener(

        "change",

        selectStoryFile

    );

});

// ==========================================
// Select Story File
// ==========================================

function selectStoryFile(e){

    const file = e.target.files[0];

    if(!file) return;

    // Maximum 100 MB
    if(file.size > 100 * 1024 * 1024){

        alert("Maximum file size is 100MB");

        e.target.value = "";

        return;

    }

    const allowed = [

        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",

        "video/mp4",
        "video/webm",
        "video/quicktime"

    ];

    if(!allowed.includes(file.type)){

        alert("Unsupported file type");

        e.target.value = "";

        return;

    }

    selectedStoryFile = file;

    previewStory(file);

}

// ==========================================
// Preview
// ==========================================

function previewStory(file){

    const preview =
    document.getElementById("storyPreview");

    if(!preview) return;

    preview.innerHTML = "";

    const url =
    URL.createObjectURL(file);

    if(file.type.startsWith("image")){

        preview.innerHTML = `

        <img
        src="${url}"
        style="
        width:100%;
        max-height:420px;
        object-fit:cover;
        border-radius:20px;
        ">

        `;

    }

    else{

        preview.innerHTML = `

        <video
        controls
        autoplay
        muted
        style="
        width:100%;
        max-height:420px;
        border-radius:20px;
        ">

        <source src="${url}">

        </video>

        `;

    }

    showToast("Story Ready");

}

// ==========================================

console.log("✅ Stories Upload Part 1 Loaded");
// ==========================================
// VIEWORA STORIES UPLOAD V3.0
// PART 2
// Firebase Storage Upload
// ==========================================

// Upload Task
let storyUploadTask = null;

// ==========================================
// Upload Story
// ==========================================

window.uploadStory = async function () {

    if (!selectedStoryFile) {

        alert("Please select a photo or video.");

        return;

    }

    if (!currentUser) {

        alert("Login required.");

        return;

    }

    showUploadLoader(true);

    const extension =
    selectedStoryFile.name
    .split(".")
    .pop();

    const fileName =
    Date.now() +
    "_" +
    currentUser.uid +
    "." +
    extension;

    const storageRef =
    storage.ref(
        "stories/" + fileName
    );

    storyUploadTask =
    storageRef.put(selectedStoryFile);

    storyUploadTask.on(

        "state_changed",

        // Upload Progress
        (snapshot)=>{

            const percent = Math.floor(

                snapshot.bytesTransferred /

                snapshot.totalBytes * 100

            );

            updateUploadProgress(percent);

        },

        // Error
        (error)=>{

            console.error(error);

            showUploadLoader(false);

            alert(error.message);

        },

        // Complete
        async ()=>{

            try{

                const downloadURL =
                await storageRef.getDownloadURL();

                await saveStoryToDatabase(

                    downloadURL,

                    selectedStoryFile.type

                );

            }

            catch(error){

                console.error(error);

                alert(error.message);

            }

        }

    );

};

// ==========================================
// Upload Progress
// ==========================================

function updateUploadProgress(percent){

    const bar =
    document.getElementById(
        "storyUploadBar"
    );

    const text =
    document.getElementById(
        "storyUploadText"
    );

    if(bar){

        bar.style.width =
        percent + "%";

    }

    if(text){

        text.innerText =
        percent + "% Uploaded";

    }

}

// ==========================================
// Loading
// ==========================================

function showUploadLoader(show){

    const box =
    document.getElementById(
        "storyUploadBox"
    );

    if(!box) return;

    box.style.display =
    show
    ? "block"
    : "none";

}

// ==========================================
// Cancel Upload
// ==========================================

window.cancelStoryUpload = function(){

    if(storyUploadTask){

        storyUploadTask.cancel();

        showUploadLoader(false);

        showToast("Upload Cancelled");

    }

};

// ==========================================

console.log("✅ Stories Upload Part 2 Loaded");
// ==========================================
// VIEWORA STORIES UPLOAD V3.0
// PART 3
// Save Story to Firebase
// ==========================================

// ==========================================
// Save Story
// ==========================================

async function saveStoryToDatabase(downloadURL, mimeType){

    try{

        const snap = await db
        .ref("users/" + currentUser.uid)
        .once("value");

        const user = snap.val() || {};

        const storyId =
        db.ref("stories").push().key;

        const type =
        mimeType.startsWith("video")
        ? "video"
        : "image";

        await db.ref("stories/" + storyId).set({

            storyId:storyId,

            uid:currentUser.uid,

            name:user.name || "User",

            username:user.username || "",

            profilePhoto:
            user.profilePhoto || "non.jpg",

            mediaUrl:downloadURL,

            type:type,

            createdAt:Date.now(),

            expiresAt:
            Date.now()+86400000,

            views:0,

            reactions:0,

            replies:0

        });

        uploadFinished();

    }

    catch(error){

        console.error(error);

        showUploadLoader(false);

        alert(error.message);

    }

}

// ==========================================
// Upload Finished
// ==========================================

function uploadFinished(){

    showUploadLoader(false);

    selectedStoryFile = null;

    const picker =
    document.getElementById("storyFile");

    if(picker){

        picker.value = "";

    }

    const preview =
    document.getElementById("storyPreview");

    if(preview){

        preview.innerHTML = "";

    }

    updateUploadProgress(100);

    refreshStoryRing();

    showSuccessAnimation();

    showToast("Story Uploaded Successfully");

}

// ==========================================
// Success Animation
// ==========================================

function showSuccessAnimation(){

    let success =
    document.getElementById(
        "storySuccess"
    );

    if(!success){

        success =
        document.createElement("div");

        success.id="storySuccess";

        success.style.cssText=`
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.75);
        display:flex;
        justify-content:center;
        align-items:center;
        font-size:80px;
        z-index:99999;
        opacity:0;
        transition:.35s;
        `;

        success.innerHTML="✅";

        document.body.appendChild(success);

    }

    success.style.display="flex";

    setTimeout(()=>{

        success.style.opacity="1";

    },50);

    setTimeout(()=>{

        success.style.opacity="0";

    },1500);

    setTimeout(()=>{

        success.style.display="none";

    },1900);

}

// ==========================================
// Retry Upload
// ==========================================

window.retryStoryUpload=function(){

    if(selectedStoryFile){

        uploadStory();

    }

};

// ==========================================
// Auto Refresh Story Ring
// ==========================================

setTimeout(()=>{

    refreshStoryRing();

},1000);

// ==========================================

console.log("✅ Stories Upload Part 3 Loaded");
// ==========================================
// VIEWORA STORIES UPLOAD V3.0
// PART 4
// Premium Finish
// ==========================================

// ==========================================
// Drag & Drop Upload (Desktop)
// ==========================================

document.addEventListener("DOMContentLoaded",()=>{

    const preview =
    document.getElementById("storyPreview");

    if(!preview) return;

    preview.addEventListener("dragover",(e)=>{

        e.preventDefault();

        preview.classList.add("drag-active");

    });

    preview.addEventListener("dragleave",()=>{

        preview.classList.remove("drag-active");

    });

    preview.addEventListener("drop",(e)=>{

        e.preventDefault();

        preview.classList.remove("drag-active");

        const file=e.dataTransfer.files[0];

        if(!file) return;

        selectedStoryFile=file;

        previewStory(file);

    });

});

// ==========================================
// Image Compression
// ==========================================

window.compressStoryImage=function(file){

    return new Promise((resolve)=>{

        if(!file.type.startsWith("image")){

            resolve(file);

            return;

        }

        const reader=new FileReader();

        reader.onload=function(e){

            const img=new Image();

            img.onload=function(){

                const canvas=
                document.createElement("canvas");

                let width=img.width;
                let height=img.height;

                const max=1080;

                if(width>max){

                    height*=max/width;

                    width=max;

                }

                canvas.width=width;
                canvas.height=height;

                const ctx=
                canvas.getContext("2d");

                ctx.drawImage(
                    img,
                    0,
                    0,
                    width,
                    height
                );

                canvas.toBlob(

                function(blob){

                    resolve(blob);

                },

                "image/jpeg",

                0.85

                );

            };

            img.src=e.target.result;

        };

        reader.readAsDataURL(file);

    });

};

// ==========================================
// Generate Video Thumbnail
// ==========================================

window.createVideoThumbnail=function(file){

    return new Promise((resolve)=>{

        if(!file.type.startsWith("video")){

            resolve(null);

            return;

        }

        const video=
        document.createElement("video");

        video.preload="metadata";

        video.src=
        URL.createObjectURL(file);

        video.currentTime=1;

        video.onloadeddata=function(){

            const canvas=
            document.createElement("canvas");

            canvas.width=video.videoWidth;

            canvas.height=video.videoHeight;

            canvas
            .getContext("2d")
            .drawImage(

                video,

                0,

                0

            );

            resolve(

                canvas.toDataURL("image/jpeg")

            );

        };

    });

};

// ==========================================
// Premium Upload Animation
// ==========================================

window.animateUploadComplete=function(){

    const preview=
    document.getElementById("storyPreview");

    if(!preview) return;

    preview.animate(

    [

    {

        transform:"scale(.9)",

        opacity:.4

    },

    {

        transform:"scale(1.08)",

        opacity:1

    },

    {

        transform:"scale(1)"

    }

    ],

    {

        duration:700

    });

};

// ==========================================
// Clear Preview
// ==========================================

window.clearStoryPreview=function(){

    const preview=
    document.getElementById("storyPreview");

    if(preview){

        preview.innerHTML="";

    }

    selectedStoryFile=null;

};

// ==========================================
// Premium Success
// ==========================================

window.storyUploadSuccess=function(){

    animateUploadComplete();

    showToast("🎉 Story Uploaded");

    refreshStoryRing();

};

// ==========================================
// Auto Refresh Stories
// ==========================================

setInterval(()=>{

    if(typeof loadUserStories==="function"){

        loadUserStories();

    }

},300000);

// ==========================================
// Upload Box Animation
// ==========================================

const uploadBox=
document.getElementById("storyUploadBox");

if(uploadBox){

uploadBox.animate(

[

{

opacity:0,

transform:"translateY(30px)"

},

{

opacity:1,

transform:"translateY(0)"

}

],

{

duration:500

});

}

// ==========================================

console.log("✅ VIEWORA STORIES UPLOAD V3.0 FINAL LOADED");