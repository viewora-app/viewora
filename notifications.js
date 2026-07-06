auth.onAuthStateChanged((user) => {
    if (!user) {
        location.href = "login.html";
        return;
    }
    loadNotifications(user.uid);
});

function loadNotifications(uid) {
    const container = document.getElementById("notificationsList");

    db.ref("notifications/" + uid).orderByChild("time").limitToLast(30).on("value", (snapshot) => {
        container.innerHTML = "";

        if (!snapshot.exists()) {
            container.innerHTML = `
                <p style="text-align:center; padding:80px; color:#666;">
                    No notifications yet<br>
                    <small>Activity will appear here</small>
                </p>`;
            return;
        }

        let html = "";
        snapshot.forEach(child => {
            const notif = child.val();
            html += `
                <div class="notif-card">
                    <img src="non.jpg" class="notif-avatar">
                    <div class="notif-content">
                        <strong>${notif.fromName || 'Someone'}</strong> ${notif.message}
                        <div class="notif-time">${new Date(notif.time).toLocaleString()}</div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    });
}