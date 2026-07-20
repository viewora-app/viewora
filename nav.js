document.addEventListener("DOMContentLoaded",()=>{

const links=document.querySelectorAll(".bottomNav a");

const page=location.pathname.split("/").pop()||"index.html";

links.forEach(link=>{

const href=link.getAttribute("href");

if(href===page){

link.classList.add("active");

}

link.addEventListener("click",function(e){

links.forEach(l=>l.classList.remove("active"));

this.classList.add("active");

const ripple=document.createElement("span");

ripple.className="navRipple";

const rect=this.getBoundingClientRect();

ripple.style.left=(e.clientX-rect.left)+"px";

ripple.style.top=(e.clientY-rect.top)+"px";

this.appendChild(ripple);

setTimeout(()=>{

ripple.remove();

},600);

this.animate([

{transform:"scale(.88)"},

{transform:"scale(1)"}

],{

duration:180

});

if(navigator.vibrate){

navigator.vibrate(15);

}

});

});

let lastTap=0;

const home=document.querySelector('a[href="index.html"]');

if(home){

home.addEventListener("click",()=>{

const now=Date.now();

if(now-lastTap<300){

window.scrollTo({

top:0,

behavior:"smooth"

});

}

lastTap=now;

});

}

});