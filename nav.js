// ========================================
// Viewora Navigation V2.0
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    initBottomNavigation();

});

// ========================================
// Bottom Navigation
// ========================================

function initBottomNavigation(){

    const links = document.querySelectorAll(".bottom-nav a");

    const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

    links.forEach(link=>{

        const href = link.getAttribute("href");

        // Remove old active
        link.classList.remove("active");

        // Active Page
        if(href===currentPage){

            link.classList.add("active");

        }

        // Click Animation
        link.addEventListener("click",function(){

            links.forEach(l=>l.classList.remove("active"));

            this.classList.add("active");

            this.style.transform="scale(.90)";

            setTimeout(()=>{

                this.style.transform="scale(1)";

            },150);

            // Mobile Vibration
            if(navigator.vibrate){

                navigator.vibrate(15);

            }

        });

    });

}

// ========================================
// Ripple Effect
// ========================================

document.querySelectorAll(".bottom-nav a").forEach(btn=>{

    btn.addEventListener("click",function(e){

        const ripple=document.createElement("span");

        ripple.className="nav-ripple";

        const rect=this.getBoundingClientRect();

        ripple.style.left=
        (e.clientX-rect.left)+"px";

        ripple.style.top=
        (e.clientY-rect.top)+"px";

        this.appendChild(ripple);

        setTimeout(()=>{

            ripple.remove();

        },600);

    });

});

// ========================================
// Smooth Scroll Top
// ========================================

window.scrollToTop=function(){

    window.scrollTo({

        top:0,

        behavior:"smooth"

    });

};

// ========================================
// Optional Double Tap Home
// ========================================

let navLastTap = 0;

const home = document.querySelector('.bottom-nav a[href="index.html"]');

if(home){

    home.addEventListener("click",()=>{

        const now = Date.now();

        if(now - navLastTap < 300){

            scrollToTop();

        }

        navLastTap = now;

    });

}
// ========================================
// Online / Offline
// ========================================

window.addEventListener("offline",()=>{

console.log("📴 Offline");

});

window.addEventListener("online",()=>{

console.log("🌐 Online");

});

// ========================================
// Finish
// ========================================

console.log("✅ Viewora Navigation Loaded");