/* Click-to-play YouTube: <a class="yt" href="https://www.youtube.com/watch?v=ID" data-yt="ID">…</a>
   Swaps in the privacy-enhanced embed only when clicked, so pages with many videos stay fast. */
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a.yt[data-yt]");
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var id = a.getAttribute("data-yt");
    if (!/^[\w-]{6,20}$/.test(id)) return;
    e.preventDefault();
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
    f.title = a.getAttribute("data-title") || "YouTube video";
    f.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    f.allowFullscreen = true;
    f.className = "yt-frame";
    a.replaceWith(f);
  });
})();
