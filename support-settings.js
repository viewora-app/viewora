<!-- ========================================= -->
<!-- SUPPORT SETTINGS CONTENT -->
<!-- PART 2 -->
<!-- ========================================= -->

<div class="support-container">

<div class="support-card fade">

<h2>❓ Help Center</h2>

<p>
Need help using Viewora?
Read FAQs or contact our support team.
</p>

<button onclick="openFAQ()">
📖 Open FAQ
</button>

</div>

<div class="support-card fade">

<h2>📧 Email Support</h2>

<p>
support@viewora.com
</p>

<button onclick="sendEmail()">
Send Email
</button>

</div>

<div class="support-card fade">

<h2>💬 Live Chat</h2>

<p>
Talk with Viewora Team
</p>

<button onclick="startChat()">
Start Chat
</button>

</div>

<div class="support-card fade">

<h2>🐞 Report Bug</h2>

<textarea
id="bugText"
placeholder="Describe your issue..."
></textarea>

<button onclick="reportBug()">
Submit Report
</button>

</div>

<div class="support-card fade">

<h2>💡 Suggest Feature</h2>

<textarea
id="featureText"
placeholder="Write your idea..."
></textarea>

<button onclick="sendFeature()">
Send Suggestion
</button>

</div>

<div class="support-card fade">

<h2>📱 App Version</h2>

<p id="versionText">
Viewora Premium V5.0
</p>

</div>

</div>

<script>

// =========================
// Open FAQ
// =========================

function openFAQ(){

location.href="faq.html";

}

// =========================
// Email
// =========================

function sendEmail(){

location.href=
"mailto:support@viewora.com";

}

// =========================
// Live Chat
// =========================

function startChat(){

location.href=
"chat-support.html";

}

// =========================
// Report Bug
// =========================

async function reportBug(){

const text=
document.getElementById("bugText").value.trim();

if(!text){

alert("Write your issue.");

return;

}

const user=auth.currentUser;

if(!user){

alert("Login Required");

return;

}

const id=db.ref("support/bugs").push().key;

await db.ref("support/bugs/"+id).set({

uid:user.uid,

message:text,

time:Date.now(),

status:"Pending"

});

alert("✅ Bug Report Sent");

document.getElementById("bugText").value="";

}

// =========================
// Feature Request
// =========================

async function sendFeature(){

const text=
document.getElementById("featureText").value.trim();

if(!text){

alert("Write suggestion.");

return;

}

const user=auth.currentUser;

if(!user){

alert("Login Required");

return;

}

const id=
db.ref("support/features").push().key;

await db.ref("support/features/"+id).set({

uid:user.uid,

message:text,

time:Date.now(),

status:"Pending"

});

alert("💙 Suggestion Sent");

document.getElementById("featureText").value="";

}

// =========================
// Fade Animation
// =========================

const observer=new IntersectionObserver(entries=>{

entries.forEach(entry=>{

if(entry.isIntersecting){

entry.target.classList.add("show");

}

});

});

document.querySelectorAll(".fade")

.forEach(card=>observer.observe(card));

</script>